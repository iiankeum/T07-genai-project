# 대리점 전화 주문 흐름 그림 (지금 / 우리 서비스가 끼는 자리)

STEPS = [
    ("① 전화 주문", "정비소 → 접수", "짧고 두서없는 말"),
    ("② 메모 · 품번 찾기", "접수 담당", "차종 · 연식 · 좌우"),
    ("③ 전산 입력", "본사 판매 전산", "통화 내용은 안 남음"),
    ("④ 전표 · 피킹", "창고 · 검수", "전표가 주문의 기준"),
    ("⑤ 배송", "기사 · 퀵", "급하면 덧붙임"),
    ("⑥ 반품 · 다툼", "기사 · 접수", "「두 개라 했다」"),
    ("⑦ 마감", "접수 · 사장", "오늘 남은 일"),
]

OURS = [
    (0, "녹음 → 받아쓰기", "F01 F02 F03 F12"),
    (1, "주문 카드 · 근거", "F04 F05 F07 F11"),
    (2, "카드 보며 입력 · 확정", "F06"),
    (4, "출고 목록", "F14"),
    (5, "찾기 · 묻기 · 다시 듣기", "F05 F08 F09 F13"),
    (6, "오늘 브리핑 · 할 일", "F10"),
]

GAPS = [(1, "메모 빠짐"), (2, "이중 입력"), (5, "녹음 찾기 어려움")]


def svg():
    W, x0, gap = 900, 14, 6
    n = len(STEPS)
    bw = (W - 2 * x0 - gap * (n - 1)) / n
    out = [f'<svg viewBox="0 0 {W} 392" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">',
           '<defs><marker id="ad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8A949E"/></marker>'
           '<marker id="at" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E6E6E"/></marker></defs>',
           f'<text x="{x0}" y="22" font-size="15" font-weight="800" fill="#23395B">지금의 흐름</text>',
           f'<text x="{x0}" y="276" font-size="15" font-weight="800" fill="#1E6E6E">우리 서비스가 끼는 자리 (이번 데모)</text>']
    for i, (t, who, note) in enumerate(STEPS):
        x = x0 + i * (bw + gap)
        out.append(f'<rect x="{x:.1f}" y="34" width="{bw:.1f}" height="96" rx="10" fill="#FBF8F2" stroke="#E6DCC8"/>')
        out.append(f'<text x="{x+8:.1f}" y="58" font-size="13" font-weight="800" fill="#1F2933">{t}</text>')
        out.append(f'<text x="{x+8:.1f}" y="80" font-size="11.5" fill="#5F6B76">{who}</text>')
        out.append(f'<text x="{x+8:.1f}" y="100" font-size="11.5" fill="#5F6B76">{note}</text>')
        if i < n - 1:
            out.append(f'<line x1="{x+bw:.1f}" y1="82" x2="{x+bw+gap:.1f}" y2="82" stroke="#8A949E" stroke-width="1.6" marker-end="url(#ad)"/>')
    for i, label in GAPS:
        x = x0 + i * (bw + gap)
        out.append(f'<rect x="{x+6:.1f}" y="140" width="{bw-12:.1f}" height="26" rx="13" fill="#FDE3E0"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="158" font-size="11.5" font-weight="700" fill="#D2463C" text-anchor="middle">빈 곳: {label}</text>')
    for i, t, ids in OURS:
        x = x0 + i * (bw + gap)
        out.append(f'<line x1="{x+bw/2:.1f}" y1="172" x2="{x+bw/2:.1f}" y2="258" stroke="#1E6E6E" stroke-width="1.6" stroke-dasharray="4 3" marker-end="url(#at)"/>')
        out.append(f'<rect x="{x:.1f}" y="286" width="{bw:.1f}" height="96" rx="10" fill="#E3F1EF" stroke="#BFDCD8"/>')
        words = t.split(" ")
        lines, cur = [], ""
        for w in words:
            if len(cur + " " + w) > 9 and cur:
                lines.append(cur); cur = w
            else:
                cur = (cur + " " + w).strip()
        lines.append(cur)
        for k, ln in enumerate(lines[:2]):
            out.append(f'<text x="{x+8:.1f}" y="{310+k*18}" font-size="12.5" font-weight="800" fill="#1E6E6E">{ln}</text>')
        out.append(f'<text x="{x+8:.1f}" y="{360}" font-size="11" fill="#23395B">{ids}</text>')
    out.append('</svg>')
    return "".join(out)
