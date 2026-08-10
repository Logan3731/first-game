# 배포용 문구 모음

복사해서 붙여넣기용. **게임이 영어/한국어 둘 다 지원**하므로 itch.io와 한국 커뮤니티를
동시에 노려도 된다. 기본 언어는 영어, 우상단 버튼으로 전환.

---

## itch.io 설정값

| 항목 | 값 |
|---|---|
| Title | Chain — Card Roguelite |
| Short description | Your chain only survives if every hand beats the last. ~10 min per run |
| Classification | Game |
| Kind of project | HTML |
| Release status | Released |
| Pricing | No payments (free) |
| Upload | `first-game-itch.zip` → **This file will be played in the browser** 체크 |
| Embed | Manually set size: **760 × 1000**, Fullscreen 허용 |
| Genre | Card Game |
| Tags | `cards`, `roguelite`, `poker`, `singleplayer`, `html5`, `score-attack`, `deckbuilding` |
| Language | English, Korean (둘 다 선택) |

> 프로젝트 **URL(주소)은 반드시 영문**으로. 제목에서 자동 생성되는 주소가
> 한글이면 예약어와 충돌해서 저장이 안 된다. 예: `chain-card-roguelite`

### AI generation disclosure

`Yes`를 고르고, 종류는 **Graphics · Sounds · Text & Dialog · Code 네 개 모두 체크**.
소리도 코드로 합성하므로 Sounds까지 해당된다.

---

## itch.io 본문

```
포커 족보로 점수를 내는 로그라이트입니다. 포커를 몰라도 됩니다 —
화면에 족보표가 있고, 지금 만들 수 있는 조합을 켜서 알려줍니다.

■ 핵심 규칙

점수 = 칩 × 배수 × 연쇄

앞의 둘은 흔한 포커 점수 계산입니다. 다른 건 세 번째입니다.

직전에 낸 핸드보다 칩이 높으면 연쇄가 1씩 쌓이고, 낮으면 1로 떨어집니다.
그래서 센 패를 아무 때나 지를 수 없습니다. 낮은 패부터 순서대로 올려야
사다리가 길어지고, 좋은 패는 아껴둬야 합니다.

"지금 이걸 쓰면 클리어는 되는데, 연쇄가 끊겨서 다음 판이 힘들어진다"
— 이 고민이 이 게임의 전부입니다.

■ 그 외

- 스테이지를 깰 때마다 업그레이드 3개 중 1개 선택 (9종)
- 플러시 특화, 낮은 족보 특화, 덱 압축 등 판마다 다른 빌드
- 한 판 10분 내외, 결과를 복사해서 공유 가능
- 설치 없음, 모바일에서도 됩니다
```

---

## itch.io 본문 — 영어

```
A poker roguelite built on one twist: your chain only survives if every hand
beats the last one.

You don't need to know poker. Every hand type is listed on screen, and the ones
you can currently make light up.

■ THE RULE

Score = Chips × Mult × Chain

The first two are ordinary poker scoring. The third one is the game.

Play a hand worth more chips than your previous hand and the chain goes up by
one. Play a weaker one and it drops back to 1.

So you can't dump your best hand whenever you feel like it. You have to climb —
spend the small hands first and hold the big ones back, or your ladder collapses.

"This clears the stage, but it breaks my chain and the next one gets much harder."
That decision is the entire game.

■ ALSO

- Pick 1 of 3 upgrades after every stage (9 total)
- Flush builds, low-hand builds, deck thinning — runs go in different directions
- About 10 minutes per run, copy your result to share it
- No install, works on mobile
- English and Korean (switch in the top right)
- Every chain step rings one note higher — you can hear the ladder climb
```

---

## 커뮤니티용 짧은 소개

**대상**: 아카라이브 게임 채널, 루리웹 게임포럼, DC 인디게임 갤러리, 개드립

```
포커 족보로 점수 내는 로그라이트 만들어봤습니다. 브라우저에서 바로 됩니다.

점수가 [칩 × 배수 × 연쇄]인데, 세 번째가 좀 다릅니다.
직전 핸드보다 칩이 높아야 연쇄가 쌓이고, 낮으면 초기화됩니다.
그래서 좋은 패를 아껴두고 낮은 것부터 올려야 하는 게 핵심입니다.

한 판 10분쯤 걸리고, 포커 몰라도 족보표 보면서 할 수 있게 해놨습니다.
피드백 주시면 반영하겠습니다.

https://logan3731.github.io/first-game/
```

> 커뮤니티에 올릴 때는 **itch.io 링크가 아니라 GitHub Pages 링크**를 쓰는 게 낫다.
> 클릭 한 번에 바로 게임이 뜨고, itch 페이지를 거치는 마찰이 없다.

---

## 올린 뒤에 볼 것

GoatCounter (https://logan3731.goatcounter.com) 에서:

| 지표 | 읽는 법 |
|---|---|
| `run-start` ÷ 방문 수 | **재시도율.** 1.0 근처면 한 판 하고 나간 것. 2 넘으면 좋은 신호 |
| `gameover-stage-N` 분포 | 벽의 위치. 1~2에 몰리면 초반이 너무 어렵다 |
| `maxcombo-N` 분포 | 1~2에 몰리면 연쇄를 못 알아챈 것 → 안내 문제 |
| `share-copy` ÷ `gameover` | 결과가 자랑할 만한지 |
| `upgrade-*` | 특정 업그레이드만 선택되면 밸런스가 기울어진 것 |

**20~30명은 모여야 패턴이라고 부를 수 있다.** 그 전까지는 숫자보다 직접 받은 반응이 정확하다.
