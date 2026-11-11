# 조사 쪽 모음: 서비스(A·B·C) → 대리점(D) → 우리 것 · 차별점(E)
import research_dealer
import research_edge
import research_services as rs

try:
    import research_top as rt  # B·C 결과(상위 서비스 · 구조 · 패턴)
except ImportError:
    rt = None

SUMMARY_FINDINGS = research_edge.SUMMARY_FINDINGS
PROBLEM_EVIDENCE = """<div class="box teal" style="margin-top:2mm"><h4>조사로 확인한 것</h4><ul>
<li>대리점은 모비스 직영이 아닌 독립 자영업이고, 손님은 정비업체가 주력이다. 국내 대리점은 약 1,000~1,200곳(2025, 모비스 발표) — 대리점의 전화 주문은 대부분 「프론트 부장」이 받는다(모비스 지속가능성보고서 2025: 「고객 응대를 총괄하는 대리점 프론트 부장」 교육).</li>
<li>본사가 프론트 부장 155명에게 「부품 공급 문제 정보 교류 및 고객 갈등 예방」 힐링 교육을 할 만큼 응대 부담이 크다(같은 보고서).</li>
<li>반품 원인으로 「모델 · 연식 차이를 무시한 주문」과 「종이 주문서를 잘못 읽은 주문」이 꼽힌다(미국 업계지 MOTOR, 2023).</li>
<li>국내 대리점에서 다툼이 한 달에 몇 번 나는지, 녹음을 실제로 다시 듣는지는 <b>확인 못 함</b> — 현장 인터뷰로 확인한다(아침 질문).</li></ul></div>"""

DATA_EXTRA = """<div class="box gray" style="margin-top:3mm"><h4>다른 서비스는 어떻게 하나 (조사)</h4><ul>
<li>티로: AWS 서울 리전에 두고 음성은 받아쓴 뒤 버린다. 받아쓰기 · 요약에 미국 업체를 쓰되 보관하지 않는 조건 — 처리방침에 국외 이전을 적는다.</li>
<li>익시오: 녹음은 기기에만 두고, 받아쓴 글만 요약을 위해 서버로 보낸 뒤 바로 버린다(통화 기록 · 요약은 6개월 서버 저장).</li>
<li>다글로: 처리방침상 미국 업체(AWS · Google · OpenAI · Anthropic 등)에 위탁, 온프레미스 선택 가능.</li>
<li>→ 국내 관행은 「어디서 무엇을 처리하고 얼마나 보관하는지」를 처리방침에 적는 것이다. 현장 도입 때 우리도 같은 표를 만든다.</li></ul>
<p class="src">자료/조사-서비스지도-국내.md 5장(데이터 보관 위치).</p></div>"""

MORNING_QUESTIONS = """<h3>아침 질문 (팀 · 대표님께)</h3>
<ol class="q">
<li><b>등장인물</b> — 박 부장(61) · 김 사장(48) · 이 기사(34)라는 가짜 인물과 그림이 괜찮은가? 현장에서 접수 담당을 정말 「부장님」이라 부르나?</li>
<li><b>P1 기능</b> — 사이트에 못 들어간 P1 은 부록으로 옮겼다. 다음 버전에 무엇부터 살릴까?</li>
<li><b>실제 녹음 시험</b> — 받아쓴 글을 해외 AI(Claude)로 보내도 되는가: 대리점 동의 / 이름 · 번호 가리기 / 국내 · PC 안 AI 중 무엇으로 갈까?</li>
<li><b>현장 녹음 형식</b> — 녹음 파일에 걸려 온 번호 · 수신/발신이 남는가? 양쪽 목소리가 한 채널인가?</li>
<li><b>대리점 숫자</b> — 하루 주문 전화 수, 몰리는 시간, 카톡 · 문자 사진 주문 비율, 다툼 빈도.</li>
<li><b>숫자 표기</b> — 대리점 수를 「1천 개 이상(2025)」으로 쓸까, 「1,000~1,200여 곳」으로 쓸까?</li>
<li><b>값</b> — 대리점 한 곳 월 1만~3만 원대 가설로 체험 신청 페이지를 써도 될까?</li>
</ol>"""

NEXT_EXTRA = ""


def pages(page, img):
    out = [page(rs.METHOD, foot="조사 요약")]
    overseas = rt.OVERSEAS_ROWS if rt else []
    out.append(rs.landscape(page, overseas))
    if rt:
        out += rt.pages(page, img)
    out += research_dealer.pages(page, img)
    out += [research_edge.proto_page(page), research_edge.edge_page(page)]
    return out


def after_overview(page, img):
    return []


def appendix_pages(page, img):
    return rt.appendix(page) if rt and hasattr(rt, "appendix") else []
