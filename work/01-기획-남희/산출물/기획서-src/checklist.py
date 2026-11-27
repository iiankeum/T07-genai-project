# 기획서 기능 쪽의 완료 기준을 개발 방 대조용 체크리스트(Markdown)로 뽑는다
# 쓰는 법: python checklist.py v1 > ../../../03-개발-태림/받은자료/기획서-v1-완료기준.md
import sys
sys.stdout.reconfigure(encoding="utf-8")
from features import FEATURES, P1, SCREEN

v = sys.argv[1] if len(sys.argv) > 1 else "v1"
print(f"# 기획서 {v} 기능별 완료 기준 — 구현 대조용 체크리스트\n")
print(f"> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 남희(기획) 작업방 · 검토 전")
print(f"> 기획서 {v} PDF 의 기능 쪽에서 자동으로 뽑았다(`기획서-src/checklist.py`). 구현-대조표에서 같은 ID 로 「동작 / 일부 / 안 됨」을 적어 주면 기획서를 거기에 맞춘다.\n")
for f in FEATURES:
    print(f"## {f['id']} {f['name']} · {f['pri']} · 화면 `{SCREEN.get(f['id'], '')}`\n")
    print(f"- 목적: {f['purpose']}")
    print(f"- 데모 범위: {f['demo']}")
    print("- 화면 흐름:")
    for i, st in enumerate(f["flow"], 1):
        print(f"  {i}. {st}")
    print("- 완료 기준:")
    for d in f["done"]:
        print(f"  - [ ] {d}")
    print()
print("## P1\n")
for p in P1:
    print(f"### {p['id']} {p['name']} · 화면 `{SCREEN.get(p['id'], '')}`\n")
    print(f"- 목적: {p['purpose']}")
    print(f"- 데모 범위: {p['demo']}")
    print(f"- [ ] {p['done']}\n")
print("## 모든 화면 공통\n")
for c in ["휴대폰 · 태블릿 · PC 어디서나 열린다. 로그인 없이 누구나 데모를 본다",
          "AI 가 채운 칸은 「AI 초안」으로 보이고, 사람이 고치거나 확정하면 표시가 바뀐다",
          "품번은 통화에서 불러 준 것만 적는다. AI 가 찾거나 지어내지 않는다",
          "사람이 고친 칸은 「다시 정리」해도 AI 가 덮어쓰지 않는다",
          "본문 글씨는 크게(17px 이상), 버튼은 손가락으로 누르기 쉽게, 말은 현장 말로",
          "데모의 통화는 모두 가짜다. 「가짜 통화」 표시, 올리기 화면에 「실제 녹음은 올리지 마세요」 확인"]:
    print(f"- [ ] {c}")
