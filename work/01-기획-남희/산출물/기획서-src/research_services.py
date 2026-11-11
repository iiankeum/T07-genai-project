# 서비스 조사 쪽 (자료/조사-서비스지도-국내.md · 조사-서비스지도-해외.md · 조사-주문접수-부품플랫폼.md · 조사-상위서비스-아키텍처.md 를 줄인 것)

METHOD = """
<div class="kicker">조사 요약</div><h2 class="sec">무엇을, 어떻게 조사했나</h2>
<p class="lead">대표님 요청 순서대로 ① 녹음 · 받아쓰기 · 업무 연동 서비스 지도 → ② 상위 서비스 선정 → ③ 그 구조 → ④ 부품 대리점 업무를 조사하고, 핵심 주장은 반박 담당 에이전트가 다시 확인했다.</p>
<div class="flow">
 <div class="st"><b>A1 국내</b>받아쓰기 앱 · 통신사 AI 전화 · 휴대폰 기본 기능 · 기업 유선 · 콜센터 · 소상공인 AI 전화</div><div class="ar">+</div>
 <div class="st"><b>A2 해외</b>회의 · 영업 통화 AI · 클라우드 전화 · 콜센터 QA</div><div class="ar">+</div>
 <div class="st"><b>A3 주문 · 부품</b>음성 · 문자 주문 자동 접수 AI, 자동차 부품 주문 플랫폼</div><div class="ar">→</div>
 <div class="st hot"><b>B · C</b>상위 서비스 점수표 · 구조</div><div class="ar">→</div>
 <div class="st"><b>V1 반박 검증</b>기획서에 실릴 주장 다시 확인</div>
</div>
<div class="flow">
 <div class="st"><b>D1 대리점 (웹)</b>모비스 자료 · 공정위 · 기사 · 구인 공고 · 후기</div><div class="ar">+</div>
 <div class="st"><b>D2 대리점 (현장 문서)</b>대리점용 업무 프로그램 문서를 읽기만 하고 일반화</div><div class="ar">→</div>
 <div class="st"><b>V2 반박 검증</b>숫자 · 구조 다시 확인</div><div class="ar">→</div>
 <div class="st hot"><b>E 기획</b>세 프로토타입 · 회의록 기능 후보 + 차별점</div>
</div>
<div class="tiles">
 <div class="tile"><div class="big-number">8</div><div class="lbl">조사 · 검증 에이전트</div><span class="src">Workflow 한 번 · 병렬</span></div>
 <div class="tile"><div class="big-number">60+</div><div class="lbl">살펴본 서비스</div><span class="src">국내 20여 · 해외 30 · 주문 · 부품 20여</span></div>
 <div class="tile"><div class="big-number">약 330</div><div class="lbl">출처 URL</div><span class="src">조사 파일 여섯 개의 고유 주소</span></div>
 <div class="tile"><div class="big-number">2회</div><div class="lbl">반박 검증</div><span class="src">서비스(V1) · 대리점(V2)</span></div>
</div>
<div class="grid2">
<div class="box teal"><h4>표시 규칙</h4><ul>
<li><b>[확인]</b> 공식 사이트 · 도움말 · 개발자 문서 · 보고서 · 구인 공고 원문</li>
<li><b>[기사]</b> 언론 · <b>[후기]</b> 커뮤니티 · 블로그 · 판매처 안내</li>
<li><b>[추정]</b> 근거를 엮은 판단 — 현장 확인이 필요하다</li>
<li><b>확인 못 함</b> 근거를 못 찾았다. 없다는 뜻이 아니다</li>
<li>값 · 기능은 조사일(2026-11-11) 기준이고 바뀔 수 있다</li></ul></div>
<div class="box yellow"><h4>반박 검증 결과</h4><ul>
<li><b>서비스(V1)</b> — 주장 58개: 유지 48 · 수정 8 · 확인 불가 2 · 틀림 0. Choco 관련 주장 넷이 출처보다 세게 쓰여 있어 고쳤다(예: 정확도 99% 는 「목표」). 「북미 부품 주문 80% 가 전화」(2017 발언)는 원문 확인이 안 돼 근거로 쓰지 않는다.</li>
<li><b>대리점(V2)</b> — 주장 28개: 유지 17 · 수정 10 · 확인 불가 1 · 틀림 0. 교육 표의 짝 · AI 오더 「방침」 · 「주요 방법 중 하나」 · 대리점 수 표기를 고쳤다.</li></ul></div>
<div class="box yellow"><h4>한계</h4><ul>
<li>조사 도중 에이전트들의 웹 검색 한도가 다 차서, 뒤쪽은 이미 찾은 공식 페이지만 열어 읽었다. 일부 콜센터 솔루션 · 요금 · 대리점 내부 리듬은 「확인 못 함」으로 남았다.</li>
<li>대리점 내부 업무(입고 시각 · 배송 횟수 · 외상 마감)는 공개 자료가 거의 없다. 대부분 [추정]이고 아침 질문에 올렸다.</li>
<li>공개 저장소라 대리점 이름이 드러나는 출처 주소는 뺐다.</li></ul></div>
</div>
<p class="src">조사 원문(출처 URL 포함): 자료/조사-서비스지도-국내.md · 조사-서비스지도-해외.md · 조사-주문접수-부품플랫폼.md · 조사-상위서비스-아키텍처.md · 조사-대리점-생태계.md · 조사-대리점-업무흐름-일반화.md · 조사-검증-서비스.md · 조사-검증-대리점.md</p>
"""


def landscape(page, overseas_rows):
    rows_kr = [
        ("A. 받아쓰기 앱", "티로 · 클로바노트 · 다글로 · 에이닷 노트", "앱 녹음 · 파일 · (티로) 갤럭시 통화 녹음 파일 읽기", "받아쓰기 · 요약 · 검색 · AI 질문 · 용어집"),
        ("B. 통신사 AI 전화", "에이닷 전화(SKT) · 익시오(LG U+)", "통신사 앱이 전화를 건다", "통화 요약 · (익시오) 지난 통화를 질문으로 찾기"),
        ("C. 휴대폰 기본", "갤럭시 AI · 아이폰", "기본 전화 앱", "녹음 · 받아쓰기 · 요약이 무료로 깔려 있다"),
        ("D. 기업 유선 + AI", "KT 통화매니저 · LG U+ AI비즈콜", "회사 유선(인터넷)전화", "대표번호 통화 자동 녹음 · 요약 · (LG) 수신 때 이력 표시"),
        ("E. 콜센터 STT · AICC", "LG U+ AICC · 삼성SDS 브리티 온 · 리턴제로 API · CLOVA Speech 등", "교환기 · 녹취 서버", "화자 분리 · 키워드 검색 · 구간 청취 · 상담 요약"),
        ("F. 소상공인 AI 전화", "KT AI 통화비서 · LG U+ 우리가게 AI 전화 · CLOVA AiCall", "AI 가 매장 전화를 받는다", "예약 · 기본 응대 · 부재중 메모"),
    ]
    rows_order = [
        ("주문 자동 접수 AI", "Choco · Pepper · REKKI · Canals(유통) / Loman · Kea · Slang.ai(식당)", "음성사서함 · 문자 · 이메일 · 전화", "AI 가 주문 초안 → 사람 확인 → ERP · POS"),
        ("부품 주문 플랫폼", "PartsTech · Nexpart · RepairLink · TecDoc · partslink24 / 모비스 부품몰 앱", "정비소가 화면에서 검색 · 주문", "VIN · 품번 · 재고 · 가격. 전화 받아쓰기는 거의 없다"),
        ("부품 주문 AI (신생)", "Partly · Autologue AI counterman · PartsNow.ai", "이메일 · 전화 주문", "AI 가 구조화 → 딜러 전산 (대부분 [추정] 수준 자료)"),
    ]

    def tr(r):
        return f"<tr><td><b>{r[0]}</b></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>"
    body = f"""
<div class="kicker">조사 요약 ① 서비스 지도</div><h2 class="sec">녹음 · 받아쓰기 · 업무 연동 서비스 지도</h2>
<p class="lead">국내외 60여 개 서비스를 아홉 갈래로 나눴다. 받아쓰기 · 요약은 이미 흔하다. 「전화 주문을 업무 카드로」 바꾸는 국내 서비스는 찾지 못했다.</p>
<h4>국내 (A1)</h4>
<table class="tight"><tr><th style="width:15%">갈래</th><th style="width:28%">대표 서비스</th><th style="width:24%">녹음은 어디서</th><th>우리와 닮은 점</th></tr>{''.join(tr(r) for r in rows_kr)}</table>
<h4>해외 회의 · 영업 통화 AI (A2)</h4>
<table class="tight"><tr><th style="width:15%">갈래</th><th style="width:28%">대표 서비스</th><th style="width:24%">녹음은 어디서</th><th>업무와 엮는 방식</th></tr>{''.join(tr(r) for r in overseas_rows)}</table>
<h4>주문 접수 · 부품 (A3)</h4>
<table class="tight"><tr><th style="width:15%">갈래</th><th style="width:28%">대표 서비스</th><th style="width:24%">주문은 어디서</th><th>하는 일</th></tr>{''.join(tr(r) for r in rows_order)}</table>
<p class="src">각 서비스의 실시간 · 화자 분리 · 단어 사전 · 요약 · 추출 · 찾기 · 질문 답 · 연동 · 모바일 · 데이터 위치 · 값은 자료/조사-*.md 의 비교표에 출처와 함께 있다.</p>
"""
    return page(body, foot="조사 요약 · 서비스 지도")


def compare(page, rows):
    """rows: (서비스, 녹음, 실시간, 화자, 사전, 요약, 추출, 찾기·질문, 연동, 데이터 위치, 값)"""
    head = [("서비스", 10), ("녹음 경로", 12), ("실시간", 6), ("화자 분리", 6), ("단어 사전", 8), ("요약", 5), ("업무 칸 추출", 11), ("찾기 · 질문", 9), ("업무 연동", 12), ("데이터 위치", 11), ("값(2026-11)", 10)]
    th = "".join(f"<th style='width:{w}%'>{h}</th>" for h, w in head)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    body = f"""
<div class="kicker">조사 요약 ② 비교표</div><h2 class="sec">주요 서비스 기능 비교</h2>
<p class="lead">○ 있음 · △ 일부 · 조건부 · × 없음 · ? 공식 자료로 확인 못 함. 우리 서비스(맨 아래)는 이번 데모 기준이다.</p>
<table class="tight cmp">{th}{trs}</table>
<div class="grid3" style="margin-top:3mm">
<div class="box teal"><h4>받아쓰기 · 요약은 기본</h4>표의 거의 모든 서비스가 받아쓰기 · 요약을 한다. 값이 무료(갤럭시 · 익시오)부터 있다. 차별점이 될 수 없다.</div>
<div class="box teal"><h4>차이는 「업무 칸」과 「근거」</h4>정해진 칸을 채우는 곳(Gong · Fireflies · Choco)은 영업 · 유통용이다. 전화 주문 카드에 칸별 근거를 붙이는 곳은 없다.</div>
<div class="box teal"><h4>한국어 · 전화 · 대리점</h4>해외 제품은 한국어 지원이 불확실하고(Otter · Dialpad · Aircall), 국내 제품은 휴대폰 · 회의 중심이다. 대리점 유선 녹음 파일을 다루는 곳이 비어 있다.</div>
</div>
<p class="src">출처는 자료/조사-서비스지도-국내.md · 해외.md · 조사-주문접수-부품플랫폼.md 의 표. 반박 검증 결과는 자료/조사-검증-서비스.md.</p>
"""
    return page(body, foot="조사 요약 · 비교표")
