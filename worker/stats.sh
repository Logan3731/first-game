#!/bin/bash
# 증강 밸런스 통계 보기
#
#   ./stats.sh          결과 보기
#   ./stats.sh reset    지금까지 쌓인 걸 지우기 (시험 기록 정리용)
#
# 비밀번호는 파일에 적지 않는다. 환경변수로 넘기거나 물어보게 한다.
#   export CHAIN_STATS_KEY='...'
#
# 서버에 비밀번호를 걸어두는 법 (한 번만):
#   npx wrangler secret put STATS_KEY

set -e
API="https://chain-leaderboard.xheuri123.workers.dev"

KEY="${CHAIN_STATS_KEY:-}"
if [ -z "$KEY" ]; then
  read -r -s -p "통계 비밀번호: " KEY
  echo
fi

if [ "$1" = "reset" ]; then
  curl -s -X POST "$API/stats/reset" -H "X-Stats-Key: $KEY"
  echo
  exit 0
fi

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
curl -s "$API/stats" -H "X-Stats-Key: $KEY" -o "$TMP"

python3 - "$TMP" <<'PYEOF'
import json, sys

d = json.load(open(sys.argv[1]))
if "error" in d:
    print("못 읽었어:", d["error"])
    sys.exit(1)

판수 = d.get("runs", 0)
if not 판수:
    print("아직 쌓인 판이 없어.")
    sys.exit(0)

전체평균 = d["score"] / 판수
평균스테이지 = d["stage"] / 판수
print("판 {:,}개 · 평균 {:,.0f}점 · 평균 {:.1f}스테이지".format(판수, 전체평균, 평균스테이지))
print()

행 = []
for uid, u in d["up"].items():
    뜸, 골 = u["뜸"], u["골라짐"]
    if not 뜸:
        continue
    채택 = 골 / 뜸
    평균 = (u["점수합"] / 골) if 골 else 0
    행.append((채택, uid, 뜸, 골, 평균))
행.sort(reverse=True)

머리 = "{:<12}{:>8}{:>7}{:>7}{:>13}{:>8}   {}".format(
    "증강", "채택률", "뜸", "뽑힘", "뽑은판 평균", "배수", "판정")
print(머리)
print("-" * len(머리))

for 채택, uid, 뜸, 골, 평균 in 행:
    if 뜸 < 20:
        판정 = "표본 부족"
    elif 채택 >= 0.80:
        판정 = "★ 사기 의심 — 뜨면 무조건 집음"
    elif 채택 <= 0.10:
        판정 = "☠ 죽은 증강 — 아무도 안 씀"
    elif 채택 <= 0.20:
        판정 = "약함"
    else:
        판정 = ""
    배 = "{:.2f}배".format(평균 / 전체평균) if 골 else "-"
    print("{:<12}{:>7.0f}%{:>7}{:>7}{:>13,.0f}{:>8}   {}".format(
        uid, 채택 * 100, 뜸, 골, 평균, 배, 판정))

print("""
읽는 법
  채택률 = 뽑힘 ÷ 뜸.  같은 화면에서 3개 중 고른 것이라 조건이 같다.
           교란 요인이 없어서 이 숫자가 제일 믿을 만하다.
  배수(평균점수)는 참고만.  오래 살아남은 판일수록 점수도 높고 증강도 많이
           뽑으니, 늦게 나오는 증강이 저절로 좋아 보인다.
  뜸이 20 미만이면 아직 판단하지 말 것.""")
PYEOF
