# 대리점 생태계 · 하루 · 고충 쪽 (자료/조사-대리점-생태계.md, 조사-대리점-업무흐름-일반화.md 를 줄인 것)
import svg_dealer

U = {  # 출처 (자료/조사-대리점-생태계.md 의 번호)
    "S1": "https://www.hyundaimotorgroup.com/ko/news/CONT0000000000177810",
    "S2": "https://www.hyundaimotorgroup.com/en/story/hyundai-mobis-global-parts-overhaul",
    "S3": "https://www.mobis.com/upload/202506241133228380.pdf",
    "S4": "https://www.hyundaimotorgroup.com/ko/news/CONT0000000000179659",
    "S9": "https://www.khan.co.kr/article/202302082151005",
    "S10": "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156363142",
}


def s(n):
    return f'<a class="src" href="{U[n]}">[{n}]</a>' if n in U else f'<span class="src">[{n}]</span>'


STRUCT_SVG = """<svg viewBox="0 0 900 330" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">
<defs><marker id="m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1E6E6E"/></marker>
<marker id="mo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#F28C28"/></marker></defs>
<g font-size="12.5">
<rect x="10" y="40" width="130" height="80" rx="10" fill="#F6F7F8" stroke="#D5DAE0"/><text x="22" y="66" font-weight="800" font-size="14" fill="#23395B">부품 협력사</text><text x="22" y="88" fill="#5F6B76">만드는 곳</text>
<rect x="165" y="40" width="150" height="80" rx="10" fill="#F6F7F8" stroke="#D5DAE0"/><text x="177" y="66" font-weight="800" font-size="14" fill="#23395B">모비스 물류센터</text><text x="177" y="88" fill="#5F6B76">국내 허브(아산 · 경주 등)</text><text x="177" y="106" fill="#5F6B76">긴급분 다음 날 아침</text>
<rect x="340" y="40" width="170" height="80" rx="10" fill="#F6F7F8" stroke="#D5DAE0"/><text x="352" y="66" font-weight="800" font-size="14" fill="#23395B">부품사업소 · 부품팀</text><text x="352" y="88" fill="#5F6B76">22곳 · 40여 곳(직영)</text><text x="352" y="106" fill="#5F6B76">대리점에 도매 · 직영 소매</text>
<rect x="535" y="20" width="185" height="120" rx="12" fill="#FDEBD8" stroke="#F2C08D" stroke-width="2"/><text x="549" y="48" font-weight="800" font-size="15" fill="#B5600F">부품 대리점</text><text x="549" y="70" fill="#1F2933">1,000~1,200여 곳</text><text x="549" y="90" fill="#1F2933">독립 자영업 · 도매 성격</text><text x="549" y="110" fill="#1F2933">프론트(접수) 부장이 전화를</text><text x="549" y="128" fill="#B5600F" font-weight="700">받는다 = 우리 사용자</text>
<rect x="745" y="40" width="145" height="80" rx="10" fill="#E3F1EF" stroke="#BFDCD8"/><text x="757" y="66" font-weight="800" font-size="14" fill="#1E6E6E">정비업체</text><text x="757" y="88" fill="#1F2933">전국 약 3.6만 곳</text><text x="757" y="106" fill="#5F6B76">공업사 · 카센터 등</text>
<line x1="140" y1="80" x2="163" y2="80" stroke="#1E6E6E" stroke-width="2" marker-end="url(#m)"/><line x1="315" y1="80" x2="338" y2="80" stroke="#1E6E6E" stroke-width="2" marker-end="url(#m)"/><line x1="510" y1="80" x2="533" y2="80" stroke="#1E6E6E" stroke-width="2" marker-end="url(#m)"/>
<path d="M745 62 L722 62" stroke="#F28C28" stroke-width="2.4" marker-end="url(#mo)"/><text x="745" y="142" fill="#B5600F" font-weight="700" font-size="12">주문: 전화 · 사진</text>
<path d="M722 100 L743 100" stroke="#1E6E6E" stroke-width="2.4" marker-end="url(#m)"/><text x="745" y="160" fill="#1E6E6E" font-weight="700" font-size="12">배송: 대리점 자체 · 퀵</text>
<rect x="535" y="200" width="185" height="70" rx="10" fill="#E8ECF4" stroke="#C3CCDD"/><text x="549" y="226" font-weight="800" font-size="14" fill="#23395B">손해보험사</text><text x="549" y="248" fill="#1F2933">사고 수리 부품값 청구 · 감액 지급</text>
<line x1="610" y1="140" x2="610" y2="198" stroke="#23395B" stroke-width="2" marker-end="url(#m)"/><line x1="650" y1="198" x2="650" y2="142" stroke="#23395B" stroke-width="2" marker-end="url(#m)"/>
<rect x="745" y="200" width="145" height="70" rx="10" fill="#F6F7F8" stroke="#D5DAE0"/><text x="757" y="226" font-weight="800" font-size="14" fill="#23395B">차주</text><text x="757" y="248" fill="#5F6B76">정비소에 수리를 맡김</text>
<line x1="878" y1="198" x2="878" y2="122" stroke="#1E6E6E" stroke-width="2" marker-end="url(#m)"/>
<rect x="340" y="200" width="170" height="70" rx="10" fill="#fff" stroke="#D5DAE0" stroke-dasharray="5 4"/><text x="352" y="226" font-weight="800" font-size="14" fill="#5F6B76">비순정 부품상</text><text x="352" y="248" fill="#5F6B76">대리점도 일부 취급 가능(2019~)</text>
</g>
<text x="10" y="300" font-size="11.5" fill="#7A858F">숫자: 사업소 · 팀 · 대리점 [S1 · 2025-05] · 정비업체 36,184곳 [2024년 4분기 국토부 집계 보도] · 긴급분 다음 날 아침 [S2 · 2025-07]</text><text x="10" y="318" font-size="11.5" fill="#7A858F">비순정 취급 허용은 2019-12 표준대리점계약서 보도. 대리점 수는 출처마다 1,000~1,800 으로 다르다.</text>
</svg>"""


def timeline_svg():
    x0, x1 = 90, 880
    h0, h1 = 8, 19

    def X(h):
        return x0 + (h - h0) / (h1 - h0) * (x1 - x0)
    rows = [
        ("주문 전화", [(8.5, 9.0, 1), (9.0, 11.5, 3), (11.5, 13, 1), (13, 16, 2), (16, 18.5, 1)], "#F28C28"),
        ("입고 · 검수", [(8.5, 9.6, 2)], "#23395B"),
        ("배송", [(10, 12, 2), (13, 16, 2)], "#1E6E6E"),
        ("본사 주문 마감", [(16, 17, 2)], "#8A949E"),
        ("마감 · 정리", [(17, 18.5, 2)], "#5F6B76"),
    ]
    o = ['<svg viewBox="0 0 900 318" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">']
    for h in range(h0, h1 + 1):
        o.append(f'<line x1="{X(h):.0f}" y1="22" x2="{X(h):.0f}" y2="214" stroke="#E6E9EC"/>')
        o.append(f'<text x="{X(h):.0f}" y="16" font-size="11" fill="#7A858F" text-anchor="middle">{h}시</text>')
    for r, (name, segs, col) in enumerate(rows):
        y = 30 + r * 37
        o.append(f'<text x="8" y="{y+19}" font-size="12.5" font-weight="700" fill="#1F2933">{name}</text>')
        for a, b, lv in segs:
            op = {1: .3, 2: .6, 3: 1}[lv]
            o.append(f'<rect x="{X(a):.0f}" y="{y+4}" width="{X(b)-X(a):.0f}" height="22" rx="6" fill="{col}" opacity="{op}"/>')
    hooks = [(8.6, "F10 아침 브리핑", 0), (10.2, "F04 · F05 통화마다 카드", 1), (14.3, "F08 · F09 「언제 된다 했지?」", 0), (17.3, "F10 마감 요약", 1)]
    for h, t, row in hooks:
        y = 238 + row * 30
        w = len(t) * 12.6 + 22
        x = min(X(h) - 4, 892 - w)
        o.append(f'<line x1="{X(h):.0f}" y1="216" x2="{X(h):.0f}" y2="{y}" stroke="#1E6E6E" stroke-width="2"/>')
        o.append(f'<rect x="{x:.0f}" y="{y}" width="{w}" height="25" rx="12.5" fill="#E3F1EF" stroke="#BFDCD8"/>')
        o.append(f'<text x="{x+8:.0f}" y="{y+17}" font-size="12" font-weight="700" fill="#1E6E6E">{t}</text>')
    o.append('<text x="8" y="312" font-size="11" fill="#7A858F">진한 색일수록 바쁘다. 출근 · 토요일 근무는 구인 공고, 긴급분 다음 날 아침 입고는 모비스 자료로 확인했다. 시간대별 몰림은 [추정] — 현장 확인 필요.</text>')
    o.append('</svg>')
    return "".join(o)


def pages(page, img):
    eco = page(f"""
<div class="kicker">대리점 생태계</div><h2 class="sec">현대모비스 순정부품이 정비소까지 가는 길</h2>
<p class="lead">대리점은 모비스 직영이 아닌 독립 자영업자이고, 손님은 개인보다 정비업체가 주력이다. 정비소 주문은 대부분 전화로 들어와 「프론트 부장」이 받는다.</p>
<div class="tiles">
 <div class="tile"><div class="big-number">1,000~1,200</div><div class="lbl">모비스 부품 대리점</div><span class="src">2025 · 모비스 발표 두 건</span></div>
 <div class="tile"><div class="big-number">3.6만</div><div class="lbl">전국 자동차 정비업체</div><span class="src">36,184곳 · 2024년 4분기</span></div>
 <div class="tile"><div class="big-number">약 80%</div><div class="lbl">대리점 매출 중 보험 수리</div><span class="src">2023 기사 · 대리점 쪽 주장</span></div>
 <div class="tile"><div class="big-number">155명</div><div class="lbl">본사가 교육한 프론트 부장</div><span class="src">2024 실적 · 2025 보고서</span></div>
</div>
<div class="svgfig">{STRUCT_SVG}</div>
<div class="grid2" style="margin-top:2mm">
<div>
<h4>확인한 사실</h4>
<table class="tight">
<tr><th>사실</th><th style="width:26%">근거</th></tr>
<tr><td>부품사업소 22곳 · 부품팀 40곳 · 대리점 1천 개 이상</td><td>현대차그룹 뉴스 2025-05 {s('S1')}</td></tr>
<tr><td>지역 밖 긴급 부품은 다음 날 아침 도착</td><td>현대차그룹 2025-07 {s('S2')}</td></tr>
<tr><td>「고객 응대를 총괄하는 대리점 프론트 부장」 155명 대상 10차수 교육, 「부품 공급 문제 정보 교류 및 고객 갈등 예방」 힐링 교육</td><td>모비스 지속가능성보고서 2025 {s('S3')}</td></tr>
<tr><td>대리점 매출의 약 80% 가 보험 수리 관련, 부품값은 보험사에 청구</td><td>경향신문 2023-02 (대리점 쪽 주장) {s('S9')}</td></tr>
<tr><td>대리점 온라인 매출 비중 「1% 내외로 극히 미미」</td><td>공정위 서면실태조사 2019 {s('S10')}</td></tr>
<tr><td>대리점 피드백을 「AI 를 활용한 오더 시스템」 등에 활용할 방침(2025 대리점 컨퍼런스)</td><td>현대차그룹 뉴스 2025-06 {s('S4')}</td></tr>
</table></div>
<div>
<h4>주문 채널</h4>
<table class="tight">
<tr><th style="width:22%">채널</th><th>알아낸 것</th></tr>
<tr><td><b>전화</b></td><td>주 채널로 보는 근거가 여럿(카센터 전화가 많아 개인 손님이 기다린다는 후기, 「방문 전 유선 확인」 안내). 국내 비율 통계는 <b>확인 못 함</b>. 미국 정비소 약 700곳 설문에선 절반이 전화를 「주요 주문 방법 중 하나」로 꼽음(2026 기사).</td></tr>
<tr><td><b>문자 · 카톡 사진</b></td><td>차대번호 · 부품 사진을 따로 보낼 것으로 본다 [추정].</td></tr>
<tr><td><b>온라인</b></td><td>아직 작다(2019 조사 1% 내외).</td></tr>
<tr><td><b>방문</b></td><td>개인 손님 위주, 소수.</td></tr>
</table>
<div class="box yellow" style="margin-top:2mm;font-size:8.4pt"><b>그래서</b> — 대리점은 이미 본사 통합 전산을 쓴다. 우리는 그 전산을 바꾸지 않고 <b>전화와 전산 입력 사이의 빈칸</b>을 메운다.</div>
</div></div>
<p class="src">자세한 표 · 출처 50여 개: 자료/조사-대리점-생태계.md. 대리점 수는 1천 개 이상(2025-05) · 1,200여 개(2025-06) · 1,807곳(2017 기사)처럼 세는 기준마다 다르다.</p>
""", foot="대리점 생태계")

    day = page(f"""
<div class="kicker">대리점의 하루</div><h2 class="sec">부장님의 하루</h2>
<p class="lead">아침 입고 · 검수 → 오전 주문 몰림 → 배송 → 오후 주문 · 반품 → 본사 주문 마감 → 마감. 오전에 정비소가 사고 차를 뜯어 보고 부품 목록이 나오면 전화가 몰린다.</p>
<figure><img src="{img('d01-day')}" alt="" style="height:96mm;object-fit:cover"><figcaption>하루 네 장면(가짜 인물) — 아침 입고 검수 · 오전 전화 몰림 · 오후 배송 · 저녁 마감.</figcaption></figure>
<div class="svgfig">{timeline_svg()}</div>
<p class="src">근거: 출근 08:30 · 토요일 반나절은 구인 공고 [확인], 지역 밖 긴급 부품 다음 날 아침 도착은 모비스 자료 [확인], 2013년 한 대리점의 긴급 차량 하루 2회 · 배송 10~15분 [기사]. 시간대별 몰림은 [추정].</p>
""", foot="대리점의 하루")

    flow = page(f"""
<div class="kicker">대리점의 하루</div><h2 class="sec">전화 한 통이 지나가는 길과, 우리가 끼는 자리</h2>
<p class="lead">접수 담당은 전화를 받으며 품번을 찾고, 본사 전산에 넣고, 창고에 지시한다 — 통화 중에 따로 메모할 틈이 없다.</p>
<div class="svgfig">{svg_dealer.svg()}</div>
<div class="box teal" style="margin-top:3mm"><b>핵심</b> — 주문을 <b>받는 일</b>(전화 · 메모 · 전산 입력)과 <b>처리하는 일</b>(전표 · 피킹 · 배송 · 반품)이 서로 다른 곳에서 돈다. 통화에서 오간 말(좌우 · 연식 · 「내일 오전 들어오면 보냄」 같은 약속)은 어느 전산에도 구조화되어 남지 않는다. 남는 것은 녹음 파일과 전표뿐이다.</div>
<div class="box orange" style="margin-top:3mm"><h4>통화에서만 오가고 전산에 안 남는 것 — 카드가 붙잡아야 할 정보</h4>
<div class="grid4" style="font-size:8.8pt">
<div><b>연식 · 차대번호 · 사양</b><br>맞는 품번의 근거, 반품 원인과 닿는다</div>
<div><b>좌우 · 앞뒤 · 색상</b><br>품번 뒷자리를 가른다</div>
<div><b>급함 · 언제까지</b><br>퀵을 부를지, 나간 기사에 덧붙일지</div>
<div><b>결품 때의 약속</b><br>못 지키면 정비소가 다른 대리점으로</div>
<div><b>대체 허락</b><br>다른 사양도 되나 — 반품을 줄인다</div>
<div><b>배송지 · 받는 사람</b><br>본점이 아닌 곳으로 갈 때</div>
<div><b>다시 물어볼 것</b><br>품번 확인 뒤 전화, 차 다시 보고 연락</div>
<div><b>누가 말했나</b><br>「두 개라 했다 / 안 했다」를 가릴 때</div>
</div></div>
<div class="box gray"><h4>조심할 점 (현장 문서 · 일반화)</h4><ul>
<li>주문의 정답은 본사 전산이다. 카드는 보조다 — 자동 주문 · 자동 입력은 하지 않는다.</li>
<li>한 통화에 차 여러 대 · 주문 여러 건이 섞이고, 한 주문이 여러 통화로 나뉜다(「아까 그거 하나 더」).</li>
<li>바쁜 때는 화면을 볼 틈이 없다 — 통화가 끝난 뒤 짧게 확인하는 흐름이 맞다. 사실 확인의 근거는 AI 요약이 아니라 원음 구간이다.</li>
<li>녹음 파일은 통화가 끝나야 생긴다. 파일 이름 형식은 녹음 프로그램마다 다르다. 녹음 폴더는 읽기만 하고 원본은 손대지 않는다.</li></ul></div>
<p class="src">근거: 자료/조사-대리점-업무흐름-일반화.md(대리점용 업무 프로그램 문서를 읽기만 하고 일반화 — 원본 비공개) · 자료/조사-대리점-생태계.md.</p>
""", foot="전화 한 통의 길")

    pain = page("""
<div class="kicker">대리점의 하루</div><h2 class="sec">접수 부장님의 고충과 주문 다툼</h2>
<div class="grid2">
<div><h4>고충 → 우리가 돕는 것</h4>
<table class="tight"><tr><th style="width:30%">고충</th><th>모습</th><th style="width:26%">기능</th></tr>
<tr><td><b>전화 동시 다발</b></td><td>카센터 전화가 몰려 방문 손님이 기다린다 [후기]</td><td>통화 끝나면 카드가 쌓인다 F04</td></tr>
<tr><td><b>메모 누락 · 판독</b></td><td>손 메모를 못 읽거나 빠뜨림. 미국 업계지도 종이 주문서 오독을 반품 원인으로 꼽음 [기사]</td><td>녹음 기반 카드 · 다시 듣기 F02 F05</td></tr>
<tr><td><b>품번 되묻기</b></td><td>차대번호 · 연식 · 좌우 · 색상이 빠지면 다시 전화 [후기]</td><td>「다시 물어볼 것」 자동 F04 · F10</td></tr>
<tr><td><b>입고 지연 응대</b></td><td>품절 · 사업소 휴무 · 시스템 오류로 늦으면 불만을 받는다 [후기 · 기사]</td><td>「언제 된다 했지?」 F08 F09</td></tr>
<tr><td><b>감정 노동</b></td><td>본사가 프론트 부장 155명에게 「고객 갈등 예방」 힐링 교육을 할 정도 [확인]</td><td>기억이 아니라 기록으로 말한다 F05</td></tr>
<tr><td><b>디지털 낯섦</b></td><td>고령 담당자에게 새 프로그램은 부담 [추정]</td><td>입력 없이 녹음만, 큰 글씨 F15</td></tr>
<tr><td><b>담당 교대 · 휴무</b></td><td>품번 지식 · 정비소 습관이 사람 머리에 있다 [현장 문서]</td><td>찾기 · 사전 · 브리핑 F07 F08 F10</td></tr></table></div>
<div><h4>주문 다툼이 생기는 상황</h4>
<table class="tight"><tr><th style="width:28%">상황</th><th>흔한 원인</th><th style="width:28%">녹음 · 카드가 있으면</th></tr>
<tr><td><b>수량</b></td><td>통화 중 정정(「두 개 말고 하나」), 세트 · 낱개 혼동 [추정]</td><td>그 구간을 바로 다시 듣는다</td></tr>
<tr><td><b>좌 · 우 / 앞 · 뒤</b></td><td>운전석 · 조수석 말과 좌 · 우 품번이 엇갈림, 말에서 빠짐</td><td>좌우 칸을 따로, 비면 되묻기</td></tr>
<tr><td><b>연식 · 사양 · 색상</b></td><td>같은 차종도 연식 · 엔진 · 옵션에 따라 품번이 다름 [후기 · 기사]</td><td>누가 어떤 사양을 말했는지 남는다</td></tr>
<tr><td><b>말로 한 취소 · 변경</b></td><td>본사에 주문 넣은 뒤 취소, 선입금 요구 [후기]</td><td>「주문 넣는다」 확인 통화가 남는다</td></tr>
<tr><td><b>배송 시각 약속</b></td><td>「점심 전에」와 배송 동선이 안 맞음 [추정]</td><td>약속한 때가 카드에 남는다</td></tr>
<tr><td><b>반품 거부</b></td><td>개봉 · 전기 부품 · 비주류 부품, 기한 [후기]</td><td>주문 때 조건을 말했는지 확인</td></tr>
<tr><td><b>누가 주문했나</b></td><td>한 공업사에서 여러 사람이 여러 번호로 [추정]</td><td>번호 · 거래처로 묶는다 F11 F13</td></tr></table></div>
</div>
<div class="box yellow" style="margin-top:3mm"><h4>그래서 기능에 넣은 것</h4><ul>
<li>카드에 좌우 · 연식 · 차번호 · 급함 · 원하는 때 · 다시 물어볼 것 칸을 둔다(F04). 비면 「다시 물어볼 것」으로 띄운다.</li>
<li>카드의 칸마다 근거 문장과 녹음 위치를 붙인다(F05). 다툼 때 기억이 아니라 기록으로 말한다.</li>
<li>「언제 된다고 했지?」 「몇 개라 했지?」는 지난 통화에 묻는다(F09). 근거가 없으면 지어내지 않는다.</li>
<li>교대 · 휴무 때도 통화를 찾을 수 있게 검색과 브리핑을 둔다(F08 · F10).</li></ul></div>
<p class="src">근거 표시: [확인] 공식 자료 · [기사] 언론 · [후기] 커뮤니티 · 판매처 안내 · [현장 문서] 대리점용 업무 프로그램 문서(비공개, 일반화) · [추정] 판단. 다툼의 실제 빈도는 확인 못 함 — 아침 질문.</p>
""", foot="고충과 주문 다툼")
    return [eco, day, flow, pain]
