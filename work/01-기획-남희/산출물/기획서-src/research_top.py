# 해외 조사(A2) · 비교표 · 연동 깊이 · 상위 서비스(B·C) 쪽
import research_services as rs

OVERSEAS_ROWS = [
    ("회의 노트 · 봇", "Otter · Fireflies · Fathom · Avoma · Granola · Notta · Read.ai", "화상회의 봇 · PC 소리 · 파일", "요약 · AI 챗 · 할 일, CRM 칸 채우기(사람 승인 뒤)"),
    ("영업 대화 분석", "Gong · Chorus · Salesloft · Outreach · Jiminny", "영업 통화 · 회의 · 이메일", "정해진 CRM 칸 추출 · 후속 메일 · 딜 위험"),
    ("클라우드 전화 AI", "Dialpad · Aircall · RingCentral · Quo", "회사 전화 자체가 클라우드", "통화 요약 · 할 일 → 캘린더 · CRM 기록"),
    ("묶음 · 기기 · 업종", "Zoom · Teams · Meet / Plaud / CallRail · Car Wars", "자기 회의 · 녹음 기기 · 추적 번호", "요약 기본 포함 · 원음까지 거슬러 답(Plaud) · 업종 채점"),
    ("콜센터 QA", "Observe.AI · CallMiner · NICE", "대형 콜센터", "모든 통화 자동 채점 · 코칭"),
]

CMP_ROWS = [
    ("<b>티로</b>", "앱 · 파일 · 갤럭시 통화 녹음 파일", "○", "○ Pro", "○ 용어집", "○", "△ 영업 템플릿", "○ 검색 · AI 챗", "○ Slack · HubSpot · Salesforce · API", "국내(서울) 보관, 처리에 국외 업체", "월 $7~29"),
    ("<b>클로바노트</b>(웍스)", "앱 · PC · 파일", "?", "○", "○ 2,000단어", "○", "?", "?", "△ API", "확인 못 함 · 음원 5년", "월 2만 원~"),
    ("<b>익시오</b>", "통신사 앱 통화", "○ 자막", "?", "?", "○", "△", "○ AI 대화 검색", "?", "녹음은 기기, 글만 서버", "앱 무료"),
    ("<b>갤럭시 AI</b>", "기본 전화 앱", "○ 통역", "△", "?", "○", "?", "?", "?", "기기 안 처리 선택", "무료"),
    ("<b>LG U+ AI비즈콜</b>", "회사 유선전화", "?", "?", "?", "○", "△ 수신 때 이력", "?", "?", "확인 못 함", "회선당 월 3,300원~"),
    ("<b>리턴제로 API</b>", "파일 · 스트리밍", "○", "○", "○ 키워드", "△", "×", "—", "API", "결과 3일 보관", "시간당 약 1,000원"),
    ("<b>Otter</b>", "회의 · 직접 · 파일", "△", "?", "○ 800개", "○", "△", "○ AI Chat", "○ CRM · Slack", "미국", "$0~30"),
    ("<b>Fireflies</b>", "회의 봇 · 다이얼러 · 파일", "?", "?", "?", "○", "○ CRM 칸(승인 뒤)", "○ 검색 · AskFred", "○ HubSpot · Salesforce · Aircall", "미공개(기업은 선택)", "$10~39"),
    ("<b>Gong</b>", "회의 · 전화 · 이메일", "?", "?", "?", "○", "○ 추출기 20개 · 값마다 설명", "○ Assistant", "○ CRM 기존 칸만", "미국 · EU 선택", "비공개"),
    ("<b>Dialpad</b>", "자체 클라우드 전화", "○", "?", "?", "○", "△ 할 일 → 캘린더", "?", "○ Salesforce Task", "?", "$15~35"),
    ("<b>Aircall</b>", "자체 클라우드 전화", "△", "△", "?", "○", "△ 주제 · 할 일", "?", "○ HubSpot · Salesforce", "?", "$30~50"),
    ("<b>Plaud</b>", "녹음 기기 + 앱", "?", "○", "△", "○", "?", "○ 답을 원음까지", "?", "미 · 독 · 싱 · 일", "기기 + 월 $8~30"),
    ("<b>Choco</b>", "음성메시지 · 이메일 · 사진", "△ VoiceAgent", "—", "△ 거래처 과거 주문", "?", "○ 주문 → ERP", "?", "○ ERP 200개+", "AWS · SOC 2", "비공개"),
    ("<b>PartsTech</b>", "정비소 웹 주문(전화 아님)", "—", "—", "—", "—", "—(화면 주문)", "○ VIN 검색", "○ 정비 SW 35개+", "?", "$0~85"),
    ("<b style='color:#B5600F'>우리 (데모)</b>", "대리점 PC 녹음 파일 · 올리기 · 브라우저", "○ 체험", "× 다음 단계", "○ 현장 말 · 거래처 · 차종", "○ 브리핑", "○ 주문 카드 + 칸별 근거", "○ 검색 · 근거 단 답", "△ 복사 · 인쇄", "소리: PC 안 / 글: Claude", "미정"),
]

DEPTH = """
<div class="kicker">조사 요약 ③ 업무 연동</div><h2 class="sec">통화가 업무 칸을 어디까지 채우나 — 네 층</h2>
<p class="lead">해외 서비스를 「통화가 업무 시스템을 얼마나 깊이 건드리나」로 줄 세우면 네 층이 보인다. 우리는 2층(정해진 칸 = 주문 카드)과 4층(다음 행동 = 다시 전화할 곳 · 마감 요약)에 선다. 3층(판단을 대신 갱신)은 하지 않는다.</p>
<div class="svgfig"><svg viewBox="0 0 900 300" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">
<g font-size="13">
<rect x="10" y="230" width="880" height="60" rx="10" fill="#F6F7F8" stroke="#D5DAE0"/><text x="28" y="258" font-weight="800" font-size="15" fill="#23395B">1층 · 기록 붙이기</text><text x="28" y="279" fill="#5F6B76">요약 · 받아쓰기를 CRM 의 통화 기록에 붙인다. 칸은 안 건드린다 — Aircall · Dialpad · RingCentral</text>
<rect x="60" y="160" width="830" height="62" rx="10" fill="#E3F1EF" stroke="#1E6E6E" stroke-width="2"/><text x="78" y="188" font-weight="800" font-size="15" fill="#1E6E6E">2층 · 정해진 칸 채우기  ← 우리 주문 카드 (F04 · F05 · F06)</text><text x="78" y="209" fill="#1F2933">미리 정한 질문의 답을 뽑아 칸에 쓴다 · 사람 승인 · 값마다 근거 — Gong 추출기 · Fireflies Autofill · Fathom</text>
<rect x="110" y="90" width="780" height="62" rx="10" fill="#F6F7F8" stroke="#D5DAE0" stroke-dasharray="6 4"/><text x="128" y="118" font-weight="800" font-size="15" fill="#5F6B76">3층 · 판단 갱신 (우리는 안 함)</text><text x="128" y="139" fill="#5F6B76">다음 단계 · 딜 위험을 판단해 고친다 — Outreach Deal Agent · Avoma. 주문의 정답은 본사 전산이라 넘보지 않는다</text>
<rect x="160" y="20" width="730" height="62" rx="10" fill="#FDEBD8" stroke="#F28C28" stroke-width="2"/><text x="178" y="48" font-weight="800" font-size="15" fill="#B5600F">4층 · 다음 행동 초안  ← 다시 전화할 곳 · 마감 요약 (F10)</text><text x="178" y="69" fill="#1F2933">후속 메일 · 일정 · 작업 · 주문서 — Gong · Salesloft · Dialpad · Choco(주문 → ERP)</text>
</g></svg></div>
<h3>칸 채우기의 공통 모양 → 우리 규칙</h3>
<table><tr><th style="width:26%">해외에서 본 모양</th><th>예 [확인]</th><th style="width:34%">우리 주문 카드에서</th></tr>
<tr><td><b>칸 수를 묶는다</b></td><td>Gong 은 워크스페이스당 추출기 20개</td><td>카드 칸을 고정한다(거래처 · 차 · 부품 줄 · 급함 · 다시 물어볼 것 …)</td></tr>
<tr><td><b>사람이 확인한다</b></td><td>Fireflies 는 승인 전 CRM 에 안 보낸다 · Outreach 는 「확인 뒤에만」 · Choco 는 원문과 나란히</td><td>「확정」 전에는 출고로 안 넘긴다(F06)</td></tr>
<tr><td><b>근거를 보여 준다</b></td><td>Gong 은 값마다 설명 · Outreach 는 근거 없으면 제안 안 함 · Plaud 는 답을 원음까지</td><td>칸마다 근거 문장 · 재생 위치, 의심 값은 「들어 보기」(F05 · F09)</td></tr>
<tr><td><b>기존 칸에만 쓴다</b></td><td>Gong 은 CRM 에 새 칸을 만들지 않는다</td><td>본사 전산은 건드리지 않고 카드 안에서만</td></tr>
<tr><td><b>덮어쓰기 규칙</b></td><td>덧붙이기 · 바꾸기 · 빈칸일 때만</td><td>사람이 고친 칸은 AI 가 다시 정리해도 덮어쓰지 않는다</td></tr></table>
<p class="src">자료/조사-서비스지도-해외.md 3장(연동 깊이) — Gong · Fireflies · Outreach · Avoma · Aircall · Dialpad · RingCentral · Choco 공식 도움말 링크 포함.</p>
"""


def pages(page, img):
    out = [rs.compare(page, CMP_ROWS), page(DEPTH, foot="조사 요약 · 업무 연동 깊이")]
    try:
        import research_arch
        out += research_arch.pages(page, img)
    except ImportError:
        pass
    return out


SOURCES = [
    ("국내 서비스", [
        ("티로 도움말 · 통화 녹음(갤럭시 녹음 파일 읽기 · 자동 변환)", "https://docs.tiro.ooo/en/guide/recording/call-recording"),
        ("티로 보안(AWS 서울 · 학습 안 함)", "https://tiro.ooo/security"),
        ("네이버웍스 클로바노트 요금(자주 쓰는 단어 2,000개 · 화자 식별)", "https://naver.worksmobile.com/pricing/clovanote/"),
        ("LG유플러스 익시오(AI 대화 검색 · 기기 안 받아쓰기)", "https://www.lguplus.com/ixi-O"),
        ("LG유플러스 AI비즈콜 · 통화 매니저(요금)", "https://www.lguplus.com/biz/all/telecom/lines/biz-call/B000000130"),
        ("LG유플러스 AI 대화록(키워드 검색 · 구간 청취)", "https://www.lguplus.com/biz/all/telecom/phones-others/aicc/B000000150"),
        ("리턴제로 STT 옵션(keywords · domain CALL · 화자 분리)", "https://developers.rtzr.ai/docs/stt-file/"),
        ("삼성 Galaxy AI(통화 · 기기 안 처리)", "https://www.samsung.com/sec/galaxy-ai/"),
        ("다글로 개인정보처리방침(국외 위탁)", "https://daglo.ai/privacy"),
    ]),
    ("해외 서비스", [
        ("Gong AI Data Extractor(추출기 20개 · 기존 칸만)", "https://help.gong.io/docs/ai-data-extractor"),
        ("Fireflies Autofill CRM(승인 뒤 반영)", "https://guide.fireflies.ai/articles/1729159683-autofill-crm-for-salesforce-automatically-extract-and-sync-meeting-data-to-contacts-accounts-and-opportunities"),
        ("Outreach Deal Agent(근거 없으면 제안 안 함)", "https://support.outreach.io/hc/en-us/articles/39330939992859-Deal-Agent-Overview"),
        ("Dialpad AI Recap(할 일 → 일정)", "https://help.dialpad.com/docs/AI-recap"),
        ("Aircall 요약 → CRM", "https://support.aircall.io/en-gb/articles/13480661185309"),
        ("RingCentral RingSense", "https://www.ringcentral.com/ringsense.html"),
        ("Otter 요금(사용자 단어 800개)", "https://otter.ai/pricing"),
        ("Plaud Intelligence(답을 원음까지)", "https://ca.plaud.ai/pages/plaud-intelligence"),
    ]),
    ("주문 접수 · 부품", [
        ("Choco OrderAgent", "https://choco.com/us/orderagent"),
        ("Canals 유통 주문 입력", "https://www.canals.ai/products/distributor-order-entry"),
        ("PartsTech 요금", "https://partstech.com/pricing/"),
        ("Partly(딜러 부품 주문 AI)", "https://www.partly.com/solutions/dealerships"),
    ]),
    ("부품 대리점", [
        ("현대차그룹 뉴스 — 영남물류센터(사업소 22 · 팀 40 · 대리점 1천+)", "https://www.hyundaimotorgroup.com/ko/news/CONT0000000000177810"),
        ("현대차그룹 — Hyundai Mobis Overhauls the Global Parts Game", "https://www.hyundaimotorgroup.com/en/story/hyundai-mobis-global-parts-overhaul"),
        ("현대모비스 지속가능성보고서 2025(프론트 부장 교육 · 130~131쪽)", "https://www.mobis.com/upload/202506241133228380.pdf"),
        ("현대차그룹 뉴스 — 2025 대리점 컨퍼런스", "https://www.hyundaimotorgroup.com/ko/news/CONT0000000000179659"),
        ("현대모비스 A/S 부품 — 대리점 찾기", "https://www.mobis-as.com/shop_agent.do"),
        ("공정위 2019 대리점 서면실태조사(정책브리핑)", "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156363142"),
        ("경향신문 2023-02 — 부품 대리점 보험 5% 감액", "https://www.khan.co.kr/article/202302082151005"),
        ("Ratchet+Wrench 2026-06 — OEC 정비소 설문", "https://www.ratchetandwrench.com/running-a-shop/operations/article/55379580/oec-general-auto-repair-shop-survey-puts-spotlight-on-industry-hurdles"),
        ("더모빌리언스 — 2024년 4분기 정비업체 36,184곳", "http://www.themobilians.com/news/articleView.html?idxno=3063"),
    ]),
]


def appendix(page):
    blocks = ""
    for title, items in SOURCES:
        lis = "".join(f'<li>{t}<br><a class="src" href="{u}">{u}</a></li>' for t, u in items)
        blocks += f'<div><h4>{title}</h4><ul class="srclist">{lis}</ul></div>'
    body = f"""
<div class="kicker">부록 B</div><h2 class="sec">출처 (주요 30개)</h2>
<p class="lead">조사 파일 여섯 개에 고유 출처 URL 약 330개가 있다. 이 기획서 본문에 직접 쓴 것만 골랐다. 모두 2026-11-11 조회.</p>
<div class="grid2">{blocks}</div>
<p class="src">전체 출처와 [확인] · [기사] · [후기] · [추정] 표시는 work/01-기획-남희/자료/조사-*.md 에 있다. 대리점 이름이 드러나는 구인 공고 · 온라인몰 주소는 공개 저장소 규칙에 따라 뺐다.</p>
"""
    return [page(body, foot="부록 B · 출처")]
