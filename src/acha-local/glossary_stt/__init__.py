"""단어장 받아쓰기(glossary-stt): 단어장을 끼워 PC 안에서 받아쓰는 도구.

다른 프로그램에서 원리만 갖다 쓸 때:

    from glossary_stt import Glossary, plan_hints, Corrector
    g = Glossary.from_csv("내 단어장", open("words.csv", encoding="utf-8-sig").read())
    plan = plan_hints(g, context="자동차 부품 주문 전화")      # 30초마다 넣을 힌트
    segments, info = model.transcribe(audio, hotwords=plan.hotwords, condition_on_previous_text=False)
    fixes = Corrector(g).find(text)                              # 받아쓴 뒤 고칠 곳
"""
from .glossary import Glossary, Entry
from .hints import plan_hints, HintPlan
from .correct import Corrector, Fix, apply

__version__ = "0.1.0"
__all__ = ["Glossary", "Entry", "plan_hints", "HintPlan", "Corrector", "Fix", "apply", "__version__"]
