// Cloudflare Worker — 랭킹 저장/조회
//
// 배포: cd worker && npx wrangler deploy   (대시보드에 붙여넣지 말 것)
//
// 엔드포인트
//   GET  /top?mode=daily&day=12   → 그날 데일리 순위
//   GET  /top?mode=free           → 자유 모드 전체 순위
//   POST /score                   → { mode, day, name, score, stage, combo, key }
//
// 저장은 Durable Object가 맡는다. KV로 하면 동시에 들어온 점수가 서로를 덮어써서
// 사라진다 (20개를 동시에 보냈더니 1개만 남았다). Durable Object는 한 순위표에
// 인스턴스 하나뿐이라 요청이 한 줄로 서고, 그래서 도배 횟수도 정확히 셀 수 있다.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const TOP_N = 50;
const boardKey = (mode, day) => (mode === 'daily' ? `board:daily:${day}` : 'board:free');

// ── 앞뒤가 맞는 기록인가 ──
// 점수는 브라우저가 보내므로 위조를 완전히 막을 수는 없다.
// 대신 "게임 규칙상 불가능한 조합"은 걸러낸다.

// 스테이지 N에서 끝났다면 1~N-1 스테이지의 목표를 전부 넘겼어야 한다.
// 그 합계가 최소 점수다. (게임의 targetFor와 같은 식)
function minScoreFor(stage) {
  let sum = 0;
  for (let n = 1; n < stage; n++) sum += Math.floor(300 * Math.pow(1.6, n - 1) / 10) * 10;
  return sum;
}

// 반대쪽 상한. 스테이지에 비해 터무니없이 높은 점수를 막는다.
// 실제 기록은 minScoreFor의 2~4배 범위였으므로 20배는 정상 플레이를 안 건드린다.
// (이게 없으면 '3스테이지 / 9900만점'이 그대로 1위가 된다 — 실제로 통과했었다)
const maxScoreFor = stage => Math.max(100000, 20 * minScoreFor(stage + 1));

// 연쇄 상한은 10에서 시작하고 업그레이드로 3씩 오른다.
// 업그레이드는 스테이지를 깰 때마다 하나뿐이므로 이보다 높을 수 없다.
const maxComboFor = stage => 10 + 3 * Math.max(0, stage - 1);

// ── 이름 주인 확인 ──
// 브라우저가 처음 점수를 낼 때 만든 비밀값을 계속 같이 보낸다.
// 서버는 그 해시만 저장해두고, 같은 이름으로 다른 비밀값이 오면 거절한다.
// 순위표에 올라 있는 동안 그 이름은 그 사람 것이다 — 사칭 방지.
async function ownerHash(secret) {
  if (!secret) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(secret)));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// own(주인 해시)은 서버만 아는 값이라 내보내지 않는다.
const publicList = list => list.map(({ own, ...rest }) => rest);

// 한 사람당 최고 기록 하나만 남긴다.
// 안 그러면 많이 한 사람 이름으로 순위표가 도배된다.
function bestPerName(list) {
  list.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const out = [];
  for (const e of list) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
    if (out.length >= TOP_N) break;
  }
  return out;
}

// ══════════════════════════════════════════════
//  순위표 하나 = Durable Object 하나
// ══════════════════════════════════════════════

const WINDOW_MS   = 60 * 1000;
const MAX_PER_MIN = 5;        // 한 판이 10분 넘게 걸리니 정상 플레이는 여기 안 걸린다

export class Board {
  constructor(state, env) {
    this.state = state;
    this.env   = env;
    this.hits  = new Map();   // IP → 최근 등록 시각들
  }

  // 예전에 KV에 쌓아둔 기록을 한 번만 옮겨온다. 그 뒤로는 여기가 원본이다.
  async load(key) {
    let list = await this.state.storage.get('list');
    if (!list) {
      const raw = key ? await this.env.SCORES.get(key) : null;
      list = raw ? JSON.parse(raw) : [];
      await this.state.storage.put('list', list);
    }
    return list;
  }

  // 인스턴스가 하나뿐이라 이 카운터는 정확하다.
  rateOk(ip) {
    if (this.hits.size > 1000) this.hits.clear();   // 메모리가 무한히 늘지 않게
    const now = Date.now();
    const arr = (this.hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
    this.hits.set(ip, arr);
    if (arr.length >= MAX_PER_MIN) return false;
    arr.push(now);
    return true;
  }

  // 데일리 순위표는 3일 뒤 통째로 지운다 (KV의 expirationTtl을 대신하는 것)
  async alarm() {
    await this.state.storage.deleteAll();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || '';

    if (url.pathname === '/read') {
      return json({ entries: publicList(await this.load(key)) });
    }

    const body  = await request.json();
    const daily = !!body.daily;

    // 인스턴스가 하나여도 그것만으로는 부족하다. 저장소를 기다리는 사이에
    // 다른 요청이 끼어들어서 같은 목록을 읽고 서로를 덮어쓴다 —
    // 동시에 5개를 보냈더니 1개만 남았다. 여기서 확실히 잠근다.
    const out = await this.state.blockConcurrencyWhile(async () => {
      if (!this.rateOk(body.ip || 'unknown')) return [429, { error: 'too many requests' }];

      const list = await this.load(key);

      // 이미 순위표에 있는 이름이면 주인만 덮어쓸 수 있다.
      const 기존 = list.find(e => e.name === body.name);
      if (기존 && 기존.own && 기존.own !== body.own) return [409, { error: 'name taken' }];

      const entry = {
        name: body.name, score: body.score, stage: body.stage,
        combo: body.combo, own: body.own, at: Date.now(),
      };
      list.push(entry);
      const top = bestPerName(list);

      await this.state.storage.put('list', top);
      if (daily) await this.state.storage.setAlarm(Date.now() + 3 * 24 * 60 * 60 * 1000);

      return [200, { entries: publicList(top), rank: top.indexOf(entry) + 1 || null }];
    });

    return json(out[1], out[0]);
  }
}

// ══════════════════════════════════════════════
//  입구 — 값 검사만 하고 순위표로 넘긴다
// ══════════════════════════════════════════════

const boardStub = (env, key) => env.BOARD.get(env.BOARD.idFromName(key));
const inner = (path, key) => `https://board/${path}?key=${encodeURIComponent(key)}`;

// Durable Object가 식어 있으면 첫 호출이 그냥 실패할 때가 있다.
// Cloudflare가 내부 오류를 던지고 우리 코드는 실행조차 안 된다.
// 재보니 30번 중 5번이 이걸로 실패했고, 전부 식은 직후에 몰려 있었다.
// 조금 기다렸다 다시 두드리면 붙는다.
//
// 등록(write)도 재시도한다. 같은 기록이 두 번 들어가도 이름당 최고 하나만
// 남기므로 결과가 달라지지 않는다. 반대로 점수를 잃는 쪽이 훨씬 나쁘다.
const 대기 = [200, 500, 1000];   // 재보니 450ms로는 모자랐다

async function callBoard(env, key, path, init) {
  let 마지막;
  for (let n = 0; n <= 대기.length; n++) {
    try {
      return await boardStub(env, key).fetch(inner(path, key), init);
    } catch (e) {
      마지막 = e;
      if (n < 대기.length) await new Promise(r => setTimeout(r, 대기[n]));
    }
  }
  throw 마지막;
}

// 순위표를 미리 깨워둔다.
// 플레이어가 적어서 순위표는 대부분 식어 있고, 식은 첫 호출이 실패한다.
// 5분마다 한 번씩 읽어주면 사람이 들어왔을 때 이미 깨어 있다.
// (데일리는 시간대 차이로 회차가 하루 어긋날 수 있어 앞뒤로 같이 깨운다)
async function warmBoards(env) {
  const 오늘 = Math.floor((Date.now() - Date.UTC(2026, 7, 10)) / 86400000) + 1;
  const 키들 = ['board:free', ...[오늘 - 1, 오늘, 오늘 + 1].map(d => `board:daily:${d}`)];
  await Promise.allSettled(키들.map(k => callBoard(env, k, 'read')));
}

export default {
  // Cloudflare가 5분마다 부른다 (wrangler.toml의 triggers)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(warmBoards(env));
  },

  async fetch(request, env) {
   try {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // ── 순위 조회 ──
    if (request.method === 'GET' && url.pathname === '/top') {
      const mode = url.searchParams.get('mode') === 'daily' ? 'daily' : 'free';
      const day  = Number(url.searchParams.get('day')) || 0;
      const key  = boardKey(mode, day);
      const res  = await callBoard(env, key, 'read');
      return json(await res.json(), res.status);
    }

    // ── 점수 등록 ──
    if (request.method === 'POST' && url.pathname === '/score') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

      const mode  = body.mode === 'daily' ? 'daily' : 'free';
      const day   = Number(body.day) || 0;
      const score = Math.floor(Number(body.score));
      const stage = Math.floor(Number(body.stage));
      const combo = Math.floor(Number(body.combo));
      const name  = (String(body.name || '').trim().slice(0, 12)) || '???';

      // 말이 안 되는 값은 거른다.
      if (!Number.isFinite(score) || score < 0 || score > 100000000) return json({ error: 'bad score' }, 400);
      if (!Number.isFinite(stage) || stage < 1 || stage > 200)       return json({ error: 'bad stage' }, 400);
      if (!Number.isFinite(combo) || combo < 0 || combo > 500)       return json({ error: 'bad combo' }, 400);

      // 게임 규칙상 불가능한 조합을 거른다.
      // (실제로 'stage 77 / combo 77 / score 777891' 같은 장난 기록이 올라왔다)
      if (score < minScoreFor(stage))   return json({ error: 'score too low for stage' }, 400);
      if (score > maxScoreFor(stage))   return json({ error: 'score too high for stage' }, 400);
      if (combo > maxComboFor(stage))   return json({ error: 'combo too high for stage' }, 400);

      const key = boardKey(mode, day);
      const res = await callBoard(env, key, 'write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, score, stage, combo,
          daily: mode === 'daily',
          own: await ownerHash(body.key),
          ip:  request.headers.get('CF-Connecting-IP') || 'unknown',
        }),
      });
      return json(await res.json(), res.status);
    }

    return json({ error: 'not found' }, 404);

   } catch (e) {
     // 재시도까지 실패했다는 뜻. 여기서 그냥 터지면 Cloudflare가 HTML
     // 오류 페이지를 돌려주고, 클라이언트는 그걸 JSON으로 읽다 또 터진다.
     // JSON으로 돌려줘야 "순위를 못 불러왔어"까지만 뜨고 끝난다.
     return json({ error: 'board unavailable' }, 503);
   }
  },
};
