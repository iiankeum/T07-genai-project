# 기능 페이지 밖의 쪽들. 조사 쪽(research_pages)은 research.py 에 있다.
import research

DATE = "2026-11-12"

P1_NOTE = """<div class="box gray" style="margin-top:4mm"><h4>P1 을 P0 와 나눈 까닭</h4>
<ul><li>F11 은 받아쓰기로 가장 자주 틀리는 거래처 이름을 확실히 하는 길이지만, 현장 녹음 파일에 번호가 남는지부터 확인해야 한다(아침 질문).</li>
<li>F12 는 현장 도입의 핵심이지만 데모에서는 F01(손으로 올리기)로 같은 흐름을 볼 수 있다.</li>
<li>F13 · F14 · F15 는 P0 화면 위에 얹는 보기 기능이라 순서를 뒤로 뒀다.</li></ul></div>
<div class="box teal"><h4>기능 외 데모 화면</h4>사이트에는 기능 목록 밖의 화면이 둘 더 있다 — <b>무료 체험 신청</b>(프리마케팅용, 최소 항목 + 개인정보 동의)과 <b>관리자</b>(암호로 데모 초기화 · 통화 지우기 · 신청 보기). 사용자 기능이 아니라서 기능 번호를 붙이지 않았다.</div>"""


def front_pages(page, img):
    cover = f"""<section class="page cover">
<div class="stamp">AI 초안 · 돌린 사람: 배*결 · 검토 전</div>
<div class="title">
  <div class="kicker">T07 · 인간-인공지능협업제품서비스설계 · 7번 아이템</div>
  <h1>AI 전화 주문 받아쓰기<br>기능 요청 · 기획서</h1>
  <span class="name">제품명: 투표로 정함</span>
  <div class="meta">대상: 현대모비스 부품 대리점의 주문 접수 담당(부장님)<br>
  받는 사람: 개발 신*림 · 기획 담당: 김*희(검토 전) · 버전: v1 · {DATE}<br>
  이 문서는 기획 담당이 직접 쓴 것이 아니다. 배*결이 돌린 AI(Claude Code)가 조사 · 작성한 초안이다.</div>
</div>
<div class="art" style="background-image:url({img('s00-cover')})"></div>
</section>"""

    summary = page(f"""
<div class="kicker">한 장 요약</div><h2 class="sec">걸려 온 주문 전화를, 확인할 수 있는 주문 카드로</h2>
<p class="lead">대리점 전화는 이미 녹음되고 있다. 그 녹음을 받아써서 주문 카드로 정리하고, 지난 통화를 찾고 물어서 「몇 개라고 했지?」를 녹음으로 바로 확인하게 돕는다.</p>
<div class="grid3">
 <div class="box orange"><h4>문제 ① 메모와 이중 입력</h4>통화하며 메모지에 적고, 끊은 뒤 전산에 다시 옮긴다. 바쁠 때 빠진다.</div>
 <div class="box orange"><h4>문제 ② 녹음은 있는데 못 찾는다</h4>파일이 시간순으로만 쌓여 이름만으로 내용을 모른다. 찾으려면 처음부터 들어야 한다.</div>
 <div class="box orange"><h4>문제 ③ 「두 개라 했다 / 안 했다」</h4>수량 · 좌우 · 연식 착오가 다툼이 된다. 지금은 기억과 메모에 기댄다.</div>
</div>
<h3>하루 흐름 위에 놓은 기능 10개 (P0 · 데모 필수)</h3>
<div class="flow">
 <div class="st"><b>통화</b>녹음 올리기 F01<br>실시간 체험 F03</div><div class="ar">→</div>
 <div class="st"><b>받아쓰기</b>통화 글 F02<br>낱말 사전 F07</div><div class="ar">→</div>
 <div class="st hot"><b>주문 카드</b>자동 정리 F04<br>근거 · 들어 보기 F05</div><div class="ar">→</div>
 <div class="st"><b>확정 · 출고</b>고치기 · 확정 F06</div><div class="ar">→</div>
 <div class="st"><b>나중에</b>찾기 F08 · 묻기 F09<br>오늘 브리핑 F10</div>
</div>
{research.SUMMARY_FINDINGS}
<div class="grid2">
 <div class="box teal"><h4>데모에서 진짜로 되는 것</h4>녹음 올리기 → PC GPU 받아쓰기(Whisper) → Claude 카드 정리 → 근거 재생 → 확정 → 찾기 · 묻기 · 브리핑. 휴대폰 · 태블릿 · PC 어디서나, 로그인 없이. 통화는 모두 <b>가짜</b>다.</div>
 <div class="box gray"><h4>이번 데모 밖 (부록)</h4>전화기 · 교환기 연동(통화 중 받아쓰기), 양쪽 목소리 나누기, 부품 카탈로그 · 품번 자동 조회, 대리점 전산 자동 입력, 알림톡, PC 안 AI, 여러 대리점 계정.</div>
</div>
@@TOC@@
<div class="box yellow"><b>원칙</b> — AI 는 초안까지, 사람이 확정한다 · 품번은 AI 가 지어내지 않는다 · 틀릴 수 있는 값은 숨기지 않고 「들어 보기」로 표시한다 · 글씨는 크게, 말은 현장 말로.</div>
""", foot="한 장 요약")

    people = page(f"""
<div class="kicker">문제와 사용자</div><h2 class="sec">누가, 어떤 순간에 곤란한가</h2>
<p class="lead">세 사람 모두 가짜 인물이다. 기능 쪽의 장면 그림에 같은 모습으로 다시 나온다.</p>
<figure><img src="{img('char-sheet')}" alt="" style="height:112mm;object-fit:contain;background:#FBF8F2"></figure>
<div class="persona">
 <div class="card"><h4>박 부장 (61)</h4><div class="role">부품 대리점 접수 담당 · 20년</div>
  <ul><li>하루 종일 정비소 주문 전화를 받아 메모하고 전산에 옮긴다.</li><li>전화가 몰리는 아침 · 점심 뒤에 메모가 빠진다.</li><li>작은 글씨와 복잡한 화면이 부담이다.</li><li><b>바라는 것</b>: 메모 빠짐 없이, 「아까 몇 개라 했지」를 바로 확인.</li></ul></div>
 <div class="card"><h4>김 사장 (48)</h4><div class="role">정비소(카센터) 사장</div>
  <ul><li>차를 리프트에 올려 놓고 급하게 전화로 주문한다.</li><li>차종 · 연식 · 부품을 짧고 두서없이 말한다(「그 아반떼 앞범퍼 하나, 급해요」).</li><li><b>바라는 것</b>: 한 번 말하면 맞게, 제때 오는 것.</li></ul></div>
 <div class="card"><h4>이 기사 (34)</h4><div class="role">대리점 출고 · 배송 담당</div>
  <ul><li>확정된 주문을 챙겨 노선대로 배달한다.</li><li>메모 글씨를 못 읽거나 좌우 · 수량이 틀리면 다시 다녀와야 한다.</li><li><b>바라는 것</b>: 무엇을 · 어디에 · 언제까지 가져갈지 한눈에.</li></ul></div>
</div>
""", foot="문제와 사용자")

    problem = page(f"""
<div class="kicker">문제와 사용자</div><h2 class="sec">지금의 전화 주문 — 두 장면</h2>
<figure><img src="{img('s01-rush')}" alt="" style="height:80mm;object-fit:cover"><figcaption>① 아침 주문이 몰릴 때. 전화를 받으며 메모지에 적고, 끊은 뒤 전산에 다시 옮긴다. 메모가 빠지고, 글씨를 못 알아본다.</figcaption></figure>
<figure><img src="{img('s02-dispute')}" alt="" style="height:80mm;object-fit:cover"><figcaption>② 「하나만 시켰는데요?」 — 수량을 두고 기억이 엇갈린다. 녹음은 PC 에 있어도 파일 이름만으로는 어느 통화인지 몰라 찾아 듣기 어렵다.</figcaption></figure>
{research.PROBLEM_EVIDENCE}
""", foot="문제와 사용자")
    return [cover, summary, people, problem]


def research_pages(page, img):
    return research.pages(page, img)


def overview_pages(page, img, FEATURES, P1):
    from features import SCREEN
    rows = "".join(
        f"<tr><td><b>{f['id']}</b></td><td><b>{f['name']}</b></td><td>{f['purpose']}</td><td class='c'><span class='chip p0'>P0</span></td><td class='c'><span class='chip real'>{f['demo']}</span></td><td class='small'>{SCREEN.get(f['id'], '')}</td></tr>"
        for f in FEATURES)
    rows += "".join(
        f"<tr><td><b>{p['id']}</b></td><td><b>{p['name']}</b></td><td>{p['purpose']}</td><td class='c'><span class='chip p1'>P1</span></td><td class='c'><span class='chip {'real' if p['demo'].startswith('실제') else 'fake'}'>{p['demo']}</span></td><td class='small'>{SCREEN.get(p['id'], '')}</td></tr>"
        for p in P1)
    ov = page(f"""
<div class="kicker">기능 한눈에</div><h2 class="sec">기능 목록</h2>
<p class="lead">P0 는 아침 데모 사이트에 꼭 있어야 하는 것, P1 은 있으면 좋은 것이다. ID 는 개발 쪽 구현-대조표와 같다.</p>
<table><tr><th style="width:7%">ID</th><th style="width:19%">이름</th><th>한 줄 목적</th><th class="c" style="width:7%">순위</th><th class="c" style="width:15%">데모 범위</th><th style="width:14%">사이트 화면</th></tr>{rows}</table>
<div class="box gray" style="margin-top:4mm"><h4>모든 화면에 공통</h4>
<ul><li>휴대폰 · 태블릿 · PC 어디서나 열린다. 로그인 없이 누구나 데모를 본다.</li>
<li>AI 가 채운 칸은 「AI 초안」으로 보이고, 사람이 고치거나 확정하면 표시가 바뀐다.</li>
<li>품번은 통화에서 불러 준 것만 적는다. AI 가 찾거나 지어내지 않는다.</li>
<li>본문 글씨는 크게(17px 이상), 버튼은 손가락으로 누르기 쉽게, 말은 현장 말로.</li>
<li>데모의 통화는 모두 가짜다. 「가짜 통화」 표시를 붙이고, 올리기 화면에서 「실제 녹음은 올리지 마세요」 확인을 받는다.</li></ul></div>
""", foot="기능 한눈에")
    return [ov] + research.after_overview(page, img)


SYSTEM_SVG = """<svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" font-family="SUIT, Malgun Gothic, sans-serif">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1E6E6E"/></marker>
<marker id="o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#F28C28"/></marker></defs>
<rect x="10" y="10" width="250" height="400" rx="16" fill="#FBF8F2" stroke="#E6DCC8"/>
<text x="30" y="40" font-size="17" font-weight="800" fill="#23395B">대리점 · 사용자 쪽</text>
<rect x="30" y="60" width="210" height="58" rx="10" fill="#fff" stroke="#CBD2D9"/><text x="45" y="84" font-size="14" font-weight="700" fill="#1F2933">상담 전화기 · 녹음</text><text x="45" y="104" font-size="12" fill="#5F6B76">이미 통화를 녹음한다(현장)</text>
<rect x="30" y="140" width="210" height="58" rx="10" fill="#fff" stroke="#CBD2D9"/><text x="45" y="164" font-size="14" font-weight="700" fill="#1F2933">PC 녹음 폴더</text><text x="45" y="184" font-size="12" fill="#5F6B76">새 파일 → 보내기 프로그램 F12</text>
<line x1="135" y1="118" x2="135" y2="138" stroke="#1E6E6E" stroke-width="2" marker-end="url(#a)"/>
<rect x="30" y="230" width="210" height="160" rx="10" fill="#fff" stroke="#CBD2D9"/><text x="45" y="254" font-size="14" font-weight="700" fill="#1F2933">웹 브라우저</text><text x="45" y="274" font-size="12" fill="#5F6B76">휴대폰 · 태블릿 · PC · 로그인 없음</text>
<text x="45" y="300" font-size="12.5" fill="#1F2933">· 녹음 올리기 F01</text><text x="45" y="320" font-size="12.5" fill="#1F2933">· 실시간 체험 F03</text><text x="58" y="337" font-size="11" fill="#5F6B76">(브라우저 음성 인식)</text><text x="45" y="360" font-size="12.5" fill="#1F2933">· 카드 · 찾기 · 묻기 · 브리핑</text><text x="58" y="377" font-size="11" fill="#5F6B76">F02 F04~F10 화면</text>
<rect x="300" y="10" width="300" height="400" rx="16" fill="#E3F1EF" stroke="#BFDCD8"/>
<text x="320" y="40" font-size="17" font-weight="800" fill="#1E6E6E">데모 서버 (작은 서버 · RAM 1GB)</text>
<rect x="320" y="60" width="260" height="58" rx="10" fill="#fff" stroke="#BFDCD8"/><text x="335" y="84" font-size="14" font-weight="700" fill="#1F2933">녹음 받기 · 바꾸기</text><text x="335" y="104" font-size="12" fill="#5F6B76">가짜만 받음 · 16kHz 모노 WAV 로</text>
<rect x="320" y="132" width="260" height="58" rx="10" fill="#fff" stroke="#BFDCD8"/><text x="335" y="156" font-size="14" font-weight="700" fill="#1F2933">받아쓰기 줄</text><text x="335" y="176" font-size="12" fill="#5F6B76">일감을 일꾼에게 빌려 줌 · 다시 시도</text>
<rect x="320" y="204" width="260" height="58" rx="10" fill="#fff" stroke="#BFDCD8"/><text x="335" y="228" font-size="14" font-weight="700" fill="#1F2933">저장</text><text x="335" y="248" font-size="12" fill="#5F6B76">통화 · 글(시각) · 카드 · 사전 · 상태</text>
<rect x="320" y="276" width="260" height="114" rx="10" fill="#fff" stroke="#BFDCD8"/><text x="335" y="300" font-size="14" font-weight="700" fill="#1F2933">업무 처리</text>
<text x="335" y="322" font-size="12.5" fill="#1F2933">· 카드 정리 · 들어 보기 판정</text><text x="335" y="342" font-size="12.5" fill="#1F2933">· 찾기(글 · 카드 검색)</text><text x="335" y="362" font-size="12.5" fill="#1F2933">· 묻기(근거 붙은 답)</text><text x="335" y="382" font-size="12.5" fill="#1F2933">· 오늘 브리핑 · 마감 요약</text>
<line x1="240" y1="169" x2="318" y2="94" stroke="#1E6E6E" stroke-width="2" marker-end="url(#a)"/>
<line x1="240" y1="300" x2="318" y2="100" stroke="#1E6E6E" stroke-width="2" marker-end="url(#a)"/>
<line x1="318" y1="333" x2="242" y2="345" stroke="#1E6E6E" stroke-width="2" marker-end="url(#a)" marker-start="url(#a)"/>
<rect x="640" y="40" width="250" height="150" rx="16" fill="#FDEBD8" stroke="#F2C08D"/>
<text x="658" y="70" font-size="16" font-weight="800" fill="#B5600F">받아쓰기 일꾼</text><text x="658" y="92" font-size="12.5" fill="#1F2933">대표님 PC 의 GPU</text><text x="658" y="112" font-size="12.5" fill="#1F2933">Whisper large-v3 (PC 안)</text><text x="658" y="134" font-size="11.5" fill="#5F6B76">일꾼이 서버에 접속만 한다</text><text x="658" y="152" font-size="11.5" fill="#5F6B76">(방화벽을 열지 않는다)</text><text x="658" y="174" font-size="11.5" fill="#5F6B76">사전 → 받아쓰기 힌트</text>
<path d="M640 110 C 610 120, 600 150, 582 158" stroke="#F28C28" stroke-width="2.4" fill="none" marker-end="url(#o)"/>

<path d="M582 170 C 610 190, 630 180, 640 160" stroke="#F28C28" stroke-width="2.4" fill="none" marker-end="url(#o)"/>
<text x="640" y="210" font-size="11.5" fill="#B5600F">⇄ 일감을 가져가고, 받아쓴 글 · 시각을 돌려준다</text>
<rect x="640" y="240" width="250" height="150" rx="16" fill="#E8ECF4" stroke="#C3CCDD"/>
<text x="658" y="270" font-size="16" font-weight="800" fill="#23395B">Claude API</text><text x="658" y="292" font-size="12.5" fill="#1F2933">카드 정리 · 요약 · 질문 답</text><text x="658" y="314" font-size="11.5" fill="#5F6B76">글만 보낸다(소리는 안 감)</text><text x="658" y="334" font-size="11.5" fill="#5F6B76">사전 · 거래처 목록을 함께 준다</text><text x="658" y="354" font-size="11.5" fill="#5F6B76">답은 정해진 칸(JSON)으로</text><text x="658" y="374" font-size="11.5" fill="#5F6B76">해외 서버 → 실제 녹음은 미결</text>
<path d="M582 320 L638 320" stroke="#23395B" stroke-width="2.4" marker-end="url(#a)" marker-start="url(#a)"/>
<rect x="10" y="440" width="880" height="150" rx="16" fill="#fff" stroke="#E6E9EC"/>
<text x="30" y="470" font-size="16" font-weight="800" fill="#23395B">한 통화가 지나가는 길</text>
<g font-size="12.5" fill="#1F2933">
<rect x="30" y="488" width="150" height="80" rx="10" fill="#FBF8F2"/><text x="45" y="512" font-weight="700">① 녹음 들어옴</text><text x="45" y="532">폴더 · 올리기</text><text x="45" y="550">「받아쓰는 중」</text>
<rect x="200" y="488" width="150" height="80" rx="10" fill="#FDEBD8"/><text x="215" y="512" font-weight="700">② 받아쓰기</text><text x="215" y="532">PC GPU · 수 초</text><text x="215" y="550">문장마다 시각</text>
<rect x="370" y="488" width="150" height="80" rx="10" fill="#E8ECF4"/><text x="385" y="512" font-weight="700">③ 카드 정리</text><text x="385" y="532">Claude · 10초 안팎</text><text x="385" y="550">의심 값 표시</text>
<rect x="540" y="488" width="150" height="80" rx="10" fill="#E3F1EF"/><text x="555" y="512" font-weight="700">④ 사람 확인</text><text x="555" y="532">고치기 · 확정</text><text x="555" y="550">근거 재생</text>
<rect x="710" y="488" width="160" height="80" rx="10" fill="#E2F4E9"/><text x="725" y="512" font-weight="700">⑤ 출고 · 나중에</text><text x="725" y="532">출고 완료</text><text x="725" y="550">찾기 · 묻기 · 브리핑</text>
</g>
<g stroke="#1E6E6E" stroke-width="2" marker-end="url(#a)"><line x1="180" y1="528" x2="198" y2="528"/><line x1="350" y1="528" x2="368" y2="528"/><line x1="520" y1="528" x2="538" y2="528"/><line x1="690" y1="528" x2="708" y2="528"/></g>
</svg>"""


def back_pages(page, img):
    system = page(f"""
<div class="kicker">전체 시스템 구조</div><h2 class="sec">녹음 → 서버 → 받아쓰기 일꾼 → Claude → 화면</h2>
<p class="lead">작은 서버(RAM 1GB)는 무거운 일을 하지 않는다. 소리는 PC GPU 일꾼이, 글 정리는 Claude 가 맡고, 서버는 받고 · 줄 세우고 · 저장하고 · 보여 준다.</p>
<div class="svgfig">{SYSTEM_SVG}</div>
<div class="grid2" style="margin-top:3mm">
 <div class="box teal"><h4>나눈 까닭</h4><ul><li>받아쓰기는 GPU 가 있어야 빠르다(통화 10건 4분 41초 → 17초). CPU 로는 24초 통화 한 건에 28초.</li><li>음성 받아쓰기는 Claude API 로 할 수 없다. 카드 정리 · 요약 · 질문 답만 Claude 가 한다.</li><li>일꾼이 서버에 접속만 하므로 대표님 PC 는 밖에서 들어오는 길을 열지 않는다.</li></ul></div>
 <div class="box gray"><h4>현장으로 갈 때 바뀌는 것</h4><ul><li>녹음은 대리점 PC 의 보내기 프로그램(F12)이 자동으로 보낸다.</li><li>받아쓰기 일꾼을 대리점 PC 나 회사 서버에 둘 수 있다(PC 안 처리).</li><li>카드 정리 AI 를 국내 서비스나 PC 안 모델로 바꾸는 선택지(데이터 쪽 참고).</li></ul></div>
</div>
<div class="box yellow"><h4>실시간 체험(F03)은 다른 길로 간다</h4>브라우저 음성 인식(Web Speech API)은 브라우저 회사의 서버가 받아쓴다(크롬이면 구글). 받아쓴 글만 우리 서버를 거쳐 Claude 로 가서 카드가 된다. 그래서 체험에서는 지어낸 주문만 말하게 안내하고, 현장의 통화 녹음은 이 길로 보내지 않는다.</div>
<p class="src">근거: 태림(개발) 방 「받아쓰기 일꾼 API · 녹음 넣기 API v1」, 대표님 프로토타입 평가(2026-11-11 · 합성 가짜 통화 10건).</p>
""", foot="전체 시스템 구조")

    data = page("""
<div class="kicker">데이터 · 보안 · 개인정보</div><h2 class="sec">무엇이 어디로 가고, 어디에 남는가</h2>
<table><tr><th style="width:18%">데이터</th><th style="width:27%">어디로 가나</th><th style="width:25%">데모(지금)</th><th>현장(다음)</th></tr>
<tr><td><b>녹음 원본</b></td><td>대리점 PC → 데모 서버(16kHz WAV 로 바꿔 저장)</td><td>가짜 녹음만 받는다(가짜 표시 없는 것은 거절)</td><td>대리점 안 서버나 PC 에만 두는 구성 검토</td></tr>
<tr><td><b>받아쓰기용 소리</b></td><td>서버 → 받아쓰기 일꾼(PC GPU)</td><td>16kHz 모노 WAV 만 일꾼에게 간다. 원본 파일은 안 간다</td><td>일꾼을 대리점 안에 두면 소리가 밖으로 안 나간다</td></tr>
<tr><td><b>받아쓴 글</b></td><td>일꾼 → 서버 → Claude API(해외)</td><td>가짜 통화라 문제없음</td><td><b>미결</b> — 동의 받기 / 이름 · 번호를 가리고 보내기 / 국내 · PC 안 AI 로 바꾸기 중 정해야 한다</td></tr>
<tr><td><b>카드 · 사전</b></td><td>서버 저장</td><td>누구나 보는 데모라 실제 정보 금지</td><td>대리점별 계정 · 권한, 보관 기간</td></tr>
<tr><td><b>전화번호 · 차번호</b></td><td>카드 칸</td><td>가짜 번호만, 화면에서 가운데를 가린다</td><td>표시 범위 · 가림 규칙</td></tr></table>
<div class="grid2" style="margin-top:4mm">
 <div class="box yellow"><h4>짚어 둘 법 · 규칙 (법률 검토 전)</h4><ul>
 <li>통화 당사자가 자기 통화를 녹음하는 것은 일반적으로 허용된다고 알려져 있다. 다만 녹음을 외부 서비스로 보내 처리하면 <b>개인정보 처리 위탁</b>, 해외 서버면 <b>국외 이전</b> 문제가 생긴다(아이디어 문서).</li>
 <li>그래서 실제 통화로 시험하기 전에 대리점 동의, 고지 문구, 처리 위탁 · 국외 이전 고지 방법을 정해야 한다.</li>
 <li>이 쪽의 법률 설명은 AI 가 정리한 일반 정보다. 실제 도입 전에 전문가 확인이 필요하다.</li></ul></div>
 <div class="box teal"><h4>데모에서 지키는 것</h4><ul>
 <li>저장소 · 사이트에 실제 통화 녹음 · 받아쓴 글 · 진짜 이름 · 전화번호 · 차번호 · 거래처 이름을 넣지 않는다.</li>
 <li>API 키 · 일꾼 토큰은 서버 환경변수에만 둔다. 저장소에는 키 이름만(.env.example).</li>
 <li>공개 올리기는 IP 별 빈도 제한 · 하루 상한 · 길이 제한(5분 · 10MB)을 둔다.</li>
 <li>AI 가 지어낸 값이 사실처럼 보이지 않게 「AI 초안」 「들어 보기」 표시를 지운 채 내보내지 않는다.</li></ul></div>
</div>
""" + research.DATA_EXTRA, foot="데이터 · 보안 · 개인정보")

    schedule = page("""
<div class="kicker">일정 · 미결 · 아침 질문</div><h2 class="sec">일정</h2>
<table><tr><th style="width:22%">언제</th><th>무엇</th><th style="width:18%">누가</th></tr>
<tr><td>11/11 (수) 밤</td><td>킥오프 · 아이템 확정 · 역할 분담. 밤사이 AI 작업방이 기능 목록 v0 → 기획서 v1 → 데모 사이트</td><td>모두 · AI 작업방</td></tr>
<tr><td>11/12 (목) 아침</td><td>기획서 v1(이 문서)과 데모 사이트 확인, 기획서 · 사이트 1:1 대조</td><td>배*결 → 팀</td></tr>
<tr><td>11/12 ~ 11/14</td><td>실제 녹음 1~2개월분 확보(테스트용), 녹음 폴더 → 서버 프로그램 현장 설치, 갤럭시 통화 전사 vs Whisper 비교</td><td>배*결</td></tr>
<tr><td>11/14 ~ 11/16 (월) 오전</td><td>기획 담당이 이 초안을 검토 · 고쳐 기능 요청서 확정, 제품명 후보</td><td>김*희</td></tr>
<tr><td>11/16 ~ 11/22 (47주차)</td><td>프리마케팅 — 데모 · 소개 페이지, 무료 체험 신청</td><td>금*현</td></tr>
<tr><td>11/18 (수) 22:00</td><td>회의 — 기획서 · 프로토타입 확인, 제품명 투표, 프리마케팅 점검</td><td>모두</td></tr>
<tr><td>~ 49주차</td><td>개발 마무리 · 사람 목소리(역할극 · 실제 30건)로 다시 재기</td><td>신*림 · 배*결</td></tr></table>
<h3>미결 (회의록 + 이 기획에서 새로 생긴 것)</h3>
<ul>
<li>실시간 녹음을 시작하는 기준(스피커 출력 / 마이크 입력)과 업무 환경별 통일 — 이번 데모는 브라우저 체험(F03)으로 대신했다.</li>
<li>녹음 전송 세부 — 저장 폴더 위치, 파일 형식, 새 파일 감지, 실패 처리(F12).</li>
<li>현장 녹음이 양쪽 목소리를 한 줄로 담는지, 걸려 온 번호가 파일에 남는지(F11 · 화자 분리).</li>
<li>받아쓴 글을 해외 AI 로 보내도 되는지 — 동의 · 가림 · 국내/PC 안 AI(데이터 쪽).</li>
<li>사람 목소리 평가 데이터와 기준(정확도 · 속도 · 기기).</li>
<li>제품명 후보와 투표 시점.</li>
</ul>
""" + research.MORNING_QUESTIONS, foot="일정 · 미결 · 아침 질문")

    nxt = page(f"""
<div class="kicker">부록 A</div><h2 class="sec">다음 단계 기능 (이번 데모 밖)</h2>
<p class="lead">지금 사이트로 만들 수 없어서 본문 기능에 넣지 않았다. 필요한 것과 먼저 확인할 것을 함께 적었다.</p>
<figure><img src="{img('n01-next')}" alt="" style="height:70mm;object-fit:cover"><figcaption>다음 단계의 모습 — 통화하는 동안 카드가 채워지고, 품번 후보 · 배송 · 확인 메시지가 한 화면에 붙는다(확정은 여전히 사람).</figcaption></figure>
<table class="tight"><tr><th style="width:25%">기능</th><th>왜 · 언제</th><th style="width:30%">필요한 것 · 먼저 확인할 것</th></tr>
<tr><td><b>통화 중 실시간 받아쓰기</b></td><td>통화하는 동안 카드가 채워져, 끊기 전에 빠진 것(좌우 · 연식)을 되묻는다.</td><td>전화기 · 교환기(인터넷 전화) 연동, 소리를 가져올 장치, 시작 기준</td></tr>
<tr><td><b>양쪽 목소리 나누기</b></td><td>누가 말했는지(대리점 / 정비소)를 정확히 나눠 다툼 확인을 더 확실히.</td><td>녹음이 두 채널인지, 화자 분리 모델(GPU)</td></tr>
<tr><td><b>품번 · 호환 자동 조회</b></td><td>카드의 차종 · 연식 · 부품으로 품번 후보를 보여 준다(확정은 사람).</td><td>부품 카탈로그 · 전산 연동 권한, 차대번호 조회</td></tr>
<tr><td><b>재고 · 납기 확인</b></td><td>통화 중 「있어요?」에 바로 답한다.</td><td>대리점 재고 · 상위 물류 연동</td></tr>
<tr><td><b>대리점 전산 자동 입력</b></td><td>확정 카드를 판매 · 출고 프로그램에 바로 넣어 이중 입력을 없앤다.</td><td>전산 업체와의 연동 방식(API · 파일)</td></tr>
<tr><td><b>알림톡 · 문자</b></td><td>확정 · 출발 · 되물음을 정비소에 자동으로 알린다.</td><td>발신 번호 · 알림 서비스 계약, 문구 승인</td></tr>
<tr><td><b>PC 안 AI · 설치형</b></td><td>녹음과 글이 밖으로 나가지 않는 구성.</td><td>PC 안 언어 모델 품질 · 속도(남희 님 프로토타입: CPU 로 한 건 4분 넘음)</td></tr>
<tr><td><b>여러 대리점 · 계정 · 권한</b></td><td>대리점별 데이터 분리, 사장 · 접수 · 출고 역할.</td><td>로그인 · 감사 기록 · 보관 기간</td></tr>
<tr><td><b>되물음 전화 문장 · 통화 품질 코칭</b></td><td>다시 전화할 때 읽을 질문을 만들고, 자주 빠지는 정보를 알려 준다.</td><td>현장 통화 데이터가 쌓인 뒤</td></tr></table>
""" + research.NEXT_EXTRA, foot="부록 A · 다음 단계")
    return [system, data, schedule, nxt] + research.appendix_pages(page, img)
