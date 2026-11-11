# B · C: 상위 서비스 점수표 · 구조(아키텍처) · 가져올 패턴
# 자료/조사-상위서비스-아키텍처.md 를 줄인 것. TOP / ARCH_ROWS / PATTERNS 는 그 파일에서 옮겨 적는다.

STAGES = [
    ("수집", "회의 봇 · 클라우드 전화 · 앱 녹음 · 녹음 기기 · 이미 있는 녹음 파일", "PC 녹음 폴더(F12) · 올리기(F01) · 브라우저 마이크(F03)"),
    ("받아쓰기", "실시간 / 일괄 · 화자 분리 · 단어 사전(키워드 부스팅) · 외부 STT 엔진", "Whisper large-v3 일괄(PC GPU) + 사전 힌트 · 브라우저 실시간 · 화자 분리는 다음 단계"),
    ("AI 처리", "요약 · 정해진 칸 추출 · 분류 · 할 일 · 감정", "Claude 정해진 칸(주문 카드) + 근거 문장 + 의심 표시"),
    ("저장 · 찾기", "키워드 검색 · 의미 검색 · 질문 답(근거 인용)", "통화 · 글 · 카드 저장 · 검색 · 근거 단 질문 답(F08 · F09)"),
    ("업무 연동", "CRM 칸 갱신 · 캘린더 · 메신저 · 웹훅 · API", "확정 → 출고 목록 · 마감 요약 복사(F06 · F10 · F14) · 전산 연동은 다음 단계"),
    ("화면", "웹 · 모바일 · 하이라이트 · 원문 시점 재생", "반응형 웹 · 큰 글씨 · 칸 → 문장 → 재생(F05)"),
    ("보안", "암호화 · 데이터 위치 선택 · 보관 기간 · 학습 안 함 · 인증(SOC 2 · ISO)", "가짜 데이터만 · 비밀값은 서버 · 빈도 제한 · 소리는 PC 안"),
]


def ref_svg():
    W = 900
    n = len(STAGES)
    gap = 6
    bw = (W - 20 - gap * (n - 1)) / n
    o = [f'<svg viewBox="0 0 {W} 470" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">',
         '<defs><marker id="ra" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E6E6E"/></marker></defs>',
         '<text x="10" y="18" font-size="12.5" font-weight="800" fill="#5F6B76">업계에서 흔한 방식 (조사)</text>',
         '<text x="10" y="262" font-size="13" font-weight="800" fill="#1E6E6E">우리 데모</text>']

    def wrap(t, n):
        out, cur = [], ""
        for w in t.split(" "):
            if len(cur) + len(w) + 1 > n and cur:
                out.append(cur); cur = w
            else:
                cur = (cur + " " + w).strip()
        out.append(cur)
        return out
    for i, (name, ind, ours) in enumerate(STAGES):
        x = 10 + i * (bw + gap)
        o.append(f'<rect x="{x:.1f}" y="26" width="{bw:.1f}" height="36" rx="8" fill="#23395B"/>')
        o.append(f'<text x="{x+bw/2:.1f}" y="49" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">{name}</text>')
        if i < n - 1:
            o.append(f'<line x1="{x+bw:.1f}" y1="44" x2="{x+bw+gap:.1f}" y2="44" stroke="#1E6E6E" stroke-width="2" marker-end="url(#ra)"/>')
        o.append(f'<rect x="{x:.1f}" y="68" width="{bw:.1f}" height="180" rx="8" fill="#F6F7F8" stroke="#D5DAE0"/>')
        for k, ln in enumerate(wrap(ind, 7)[:9]):
            o.append(f'<text x="{x+6:.1f}" y="{90+k*18}" font-size="13" fill="#1F2933">{ln}</text>')
        o.append(f'<rect x="{x:.1f}" y="270" width="{bw:.1f}" height="196" rx="8" fill="#E3F1EF" stroke="#BFDCD8"/>')
        for k, ln in enumerate(wrap(ours, 7)[:10]):
            o.append(f'<text x="{x+6:.1f}" y="{292+k*18}" font-size="13" fill="#1E6E6E" font-weight="600">{ln}</text>')
    o.append('</svg>')
    return "".join(o)


def pages(page, img):
    try:
        import research_arch_data as d
    except ImportError:
        d = None
    out = []
    if d:
        out.append(page(d.SCORE_HTML, foot="조사 요약 · 상위 서비스"))
        out.append(page(f"""
<div class="kicker">조사 요약 ④ 구조</div><h2 class="sec">상위 서비스의 구조와 우리 구조</h2>
<p class="lead">상위 서비스들은 모두 「수집 → 받아쓰기 → AI 처리 → 저장 · 찾기 → 업무 연동 → 화면」을 거치고, 그 바닥에 보안이 깔린다. 같은 칸에 우리 데모가 무엇을 쓰는지 나란히 놓았다.</p>
<div class="svgfig">{ref_svg()}</div>
{d.ARCH_TABLE_HTML}
""", foot="조사 요약 · 구조"))
        out.append(page(d.PATTERNS_HTML, foot="조사 요약 · 가져올 패턴"))
    return out
