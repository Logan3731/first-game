// Cloudflare Worker — 랭킹 저장/조회
//
// 붙여넣는 곳: Cloudflare 대시보드 → Workers & Pages → 만든 Worker → Edit code
// 필요한 연결: KV 네임스페이스를 변수명 SCORES 로 바인딩
//
// 엔드포인트
//   GET  /top?mode=daily&day=12   → 그날 데일리 순위
//   GET  /top?mode=free           → 자유 모드 전체 순위
//   POST /score                   → { mode, day, name, score, stage, combo }

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // ── 순위 조회 ──
    if (request.method === 'GET' && url.pathname === '/top') {
      const mode = url.searchParams.get('mode') === 'daily' ? 'daily' : 'free';
      const day  = Number(url.searchParams.get('day')) || 0;
      const raw  = await env.SCORES.get(boardKey(mode, day));
      return json({ entries: raw ? JSON.parse(raw) : [] });
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
      // 브라우저가 보내는 값이라 완전한 위조 방지는 불가능하다 — 상한선일 뿐.
      if (!Number.isFinite(score) || score < 0 || score > 100000000) return json({ error: 'bad score' }, 400);
      if (!Number.isFinite(stage) || stage < 1 || stage > 200)       return json({ error: 'bad stage' }, 400);
      if (!Number.isFinite(combo) || combo < 0 || combo > 500)       return json({ error: 'bad combo' }, 400);

      const key  = boardKey(mode, day);
      const raw  = await env.SCORES.get(key);
      const list = raw ? JSON.parse(raw) : [];

      const entry = { name, score, stage, combo, at: Date.now() };
      list.push(entry);
      const top = bestPerName(list);

      // 데일리 순위표는 3일 뒤 자동 삭제 (KV 용량 관리)
      const opts = mode === 'daily' ? { expirationTtl: 60 * 60 * 24 * 3 } : {};
      await env.SCORES.put(key, JSON.stringify(top), opts);

      return json({ entries: top, rank: top.indexOf(entry) + 1 || null });
    }

    return json({ error: 'not found' }, 404);
  },
};
