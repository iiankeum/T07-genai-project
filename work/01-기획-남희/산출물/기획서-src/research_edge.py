# E: 프로토타입 · 회의록 기능 후보 → 기능 ID, 그리고 차별점

def proto_page(page):
    Y, P, N = '<span class="y">○</span>', '<span class="p">△</span>', '<span class="n">·</span>'
    rows = [
        ("녹음 파일 넣기 · 폴더 보내기", Y, P, Y, Y, "F01 F12"),
        ("받아쓰기 (PC 안 Whisper)", P, N, Y, Y, "F02"),
        ("실시간 받아쓰기", Y, P, N, N, "F03"),
        ("주문 카드 추출", Y, Y, Y, Y, "F04"),
        ("중요 내용 색 표시 · 원문 연결", Y, Y, Y, N, "F05"),
        ("「들어 보기」 · 원문 미확인 표시", N, P, Y, Y, "F05"),
        ("고치기 · 확정 · 상태", N, Y, Y, P, "F06"),
        ("용어집 · 낱말 사전 · 거래처 목록", Y, Y, Y, Y, "F07"),
        ("통화 찾기", Y, P, P, N, "F08"),
        ("지난 기록에 질문", Y, Y, N, N, "F09"),
        ("대시보드 · 할 일 추천 · 마감 요약", Y, Y, Y, Y, "F10"),
        ("걸려 온 번호로 거래처", N, P, N, P, "F11"),
    ]
    trs = "".join(f"<tr><td><b>{r[0]}</b></td><td class='c'>{r[1]}</td><td class='c'>{r[2]}</td><td class='c'>{r[3]}</td><td class='c'>{r[4]}</td><td><b>{r[5]}</b></td></tr>" for r in rows)
    return page(f"""
<div class="kicker">조사 요약 ⑤ 우리 것</div><h2 class="sec">회의록과 프로토타입 셋에서 가져온 것</h2>
<p class="lead">킥오프 회의록의 목표 경험과 팀이 이미 만든 프로토타입 셋을 기능 후보로 모았다. ○ 있음 · △ 흉내 · 일부 · · 없음.</p>
<table><tr><th>기능 후보</th><th class="c" style="width:12%">회의록<br>(11/11)</th><th class="c" style="width:13%">태림 님 화면 시안</th><th class="c" style="width:13%">남희 님 Python</th><th class="c" style="width:13%">대표님 Whisper + Claude</th><th style="width:11%">기능</th></tr>{trs}</table>
<div class="grid3" style="margin-top:3mm">
<div class="box gray"><h4>태림 님 화면 시안</h4>티로를 참고한 통화 기록 · AI 주문 카드 · 오늘의 브리핑 · 어시스턴트 · 공유 지식(제안 → 승인). 기능 없이 예시 데이터로 움직인다. 팀이 「이 화면을 베이스로」 하기로 했다.</div>
<div class="box gray"><h4>남희 님 Python 프로토타입</h4>업로드 · 폴더 감시, 확정 조건(품번 · 수량 · 다시 물어볼 것)을 서버가 강제, AI 결과를 원문과 대조해 「원문 미확인」 표시, 마감 요약, AI 초안과 사람 수정본을 따로 저장.</div>
<div class="box gray"><h4>대표님 Whisper + Claude</h4>PC GPU 의 Whisper large-v3 로 받아쓰고 Claude 로 카드 추출. 가짜 통화 10건 평가: 부품 · 수량 · 연식 · 급함 전부 맞음, 약한 곳은 거래처 이름 · 차번호 한글 · 품번 자릿수 — 의심 값은 「들어 보기」로 표시.</div>
</div>
<p class="src">회의록: docs/meetings/2026-11-11.md · 시안: src/prototypes/taejs/callnote/ · Python: 가지 feat/phone-order-prototype-kamnamhee · Whisper 프로토타입: 대표님 PC(저장소에 아직 안 올라감, README 와 평가 결과만 읽음).</p>
""", foot="회의록과 프로토타입")


def edge_page(page):
    return page("""
<div class="kicker">조사 요약 ⑥ 차별점</div><h2 class="sec">경쟁 서비스에 없는 「부품 대리점 전화 주문」 자리</h2>
<p class="lead">받아쓰기 · 요약은 이미 공짜에 가깝다(갤럭시 · 아이폰 · 통신사 앱 · 클로바노트). 우리가 파는 것은 받아쓰기가 아니라 <b>확인할 수 있는 주문 카드</b>다.</p>
<table>
<tr><th style="width:24%">우리 자리</th><th>경쟁 서비스는</th><th style="width:30%">우리는</th></tr>
<tr><td><b>① 전화 주문 전용 카드</b></td><td>국내 받아쓰기 앱 · 통신사 AI 전화는 요약까지. 해외 주문 AI 는 식자재 · 산업재 유통용. 부품 플랫폼은 정비소가 화면에서 주문하게 바꾸려 한다.</td><td>거래처 · 차종 · 연식 · 차번호 · 부품 · 수량 · 좌우 · 급함 · 다시 물어볼 것을 칸으로 뽑는다 (F04)</td></tr>
<tr><td><b>② 칸마다 근거 · 「들어 보기」</b></td><td>근거를 보여 주는 모양은 있다(Gong 은 값마다 설명, Plaud 는 답을 원음까지). 그러나 전화 주문 카드의 칸마다 근거 문장과 재생 위치를 붙이는 서비스는 찾지 못했다.</td><td>칸을 누르면 그 말을 한 문장과 그 시각의 소리. 의심 값은 숨기지 않고 표시 (F05 · F09)</td></tr>
<tr><td><b>③ 대표 유선전화의 녹음</b></td><td>휴대폰 앱(통신사 · 제조사)은 대리점 대표 유선전화를 다루지 못한다. 기업 유선 AI 는 요약까지.</td><td>이미 PC 에 쌓이는 녹음 파일을 그대로 쓴다 — 새 전화 장비가 필요 없다 (F01 · F12)</td></tr>
<tr><td><b>④ 현장 말 · 거래처 사전</b></td><td>범용 단어 사전은 있지만 부품 별칭 · 차종 세대 코드 · 정비소 목록이 기본으로 들어 있지 않다.</td><td>휀다 · 쇼바 · 미미 · 차종 세대 · 거래처를 받아쓰기와 카드 정리 둘 다에 쓴다 (F07 · F11)</td></tr>
<tr><td><b>⑤ 부장님이 쓰는 화면</b></td><td>회의 · 영업 AI 는 사무직 · 영업팀용 화면이다.</td><td>입력 없이 녹음만, 큰 글씨, 확인 · 확정 단추 위주 (공통 · F15)</td></tr>
<tr><td><b>⑥ 소리는 PC 안에서</b></td><td>국내 앱 상당수가 받아쓰기 · 요약을 국외 업체에 맡긴다(처리방침에 국외 이전 명시).</td><td>받아쓰기는 PC GPU 의 Whisper. 국외(Claude)로는 글만 간다 — 현장에서는 이것도 바꿀 수 있게 (데이터 쪽)</td></tr>
</table>
<div class="grid2" style="margin-top:3mm">
<div class="box orange"><h4>조심할 점 — 경쟁이 아니라 겹침</h4><ul>
<li>대리점은 이미 본사 통합 전산을 쓴다. 우리는 그 전산을 바꾸거나 자동 주문하지 않는다.</li>
<li>본사도 2025년 대리점 컨퍼런스에서 대리점 피드백을 「AI 를 활용한 오더 시스템」 등에 활용할 방침을 밝혔다(세부 확인 못 함). 우리는 「전화로 들어온 말」에 집중하고, 나중에 연동할 수 있게 둔다.</li>
<li>통신사 기업 전화 부가서비스가 녹취 · 요약을 판다. 회선 · 녹음은 통신사의 일, 우리는 그 녹음을 주문 카드로.</li></ul></div>
<div class="box teal"><h4>값의 기준점 (조사일 기준)</h4><ul>
<li>통신사 유선 부가서비스 회선당 월 3,300~15,400원</li>
<li>개인 받아쓰기 앱 월 1만~2만 원대(티로 · 다글로)</li>
<li>받아쓰기 API 시간당 약 1,000원(리턴제로)</li>
<li>해외 식당 전화 AI 매장당 월 $199~599, 식자재 주문 AI 거래처당 월 £10~$25 [일부 추정]</li>
<li>→ 대리점 한 곳 월 1만~3만 원대가 비교 대상이라는 가설(검증 전)</li></ul></div>
</div>
""", foot="차별점")


SUMMARY_FINDINGS = """<h3>조사에서 얻은 것</h3>
<div class="grid3">
 <div class="box teal"><h4>받아쓰기는 흔하다</h4>갤럭시 · 아이폰 · 통신사 앱 · 클로바노트가 녹음 · 받아쓰기 · 요약을 무료에 가깝게 준다. 전화 주문을 <b>업무 칸(카드)</b>으로 뽑는 국내 서비스는 찾지 못했다.</div>
 <div class="box teal"><h4>업계 표준은 「AI 초안 → 사람 확정」</h4>해외 유통 AI(Choco 등)와 영업 통화 AI(Gong · Fireflies)는 AI 가 정해진 칸을 초안으로 채우고 사람이 승인한다. 전화 주문 카드의 칸마다 원음 근거를 붙이는 곳은 찾지 못했다.</div>
 <div class="box teal"><h4>대리점의 빈칸</h4>주문을 받는 일(전화 · 메모 · 전산)과 처리하는 일이 다른 곳에서 돈다. 통화에서 오간 좌우 · 연식 · 약속은 어디에도 구조화되어 남지 않는다.</div>
</div>"""
