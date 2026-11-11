# 조사 쪽 (조사 Workflow 결과를 받아 채운다)
SUMMARY_FINDINGS = ""
PROBLEM_EVIDENCE = ""
DATA_EXTRA = ""
MORNING_QUESTIONS = ""
NEXT_EXTRA = ""


def pages(page, img):
    return [page('<div class="kicker">조사 요약</div><h2 class="sec">(조사 결과를 채우는 중)</h2>', foot="조사 요약")]


def after_overview(page, img):
    return []


def appendix_pages(page, img):
    return []
