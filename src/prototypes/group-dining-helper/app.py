"""웹 화면. 실행: python app.py → http://localhost:5000

- 담당자 화면  /m/<id>   : 의견 입력, 조건 확인·수정, 후보 3곳 비교, 투표 현황, 결정·예약 안내
- 투표 화면    /v/<토큰> : 팀원이 공유 링크로 들어와 투표 (로그인 없음)
"""
from __future__ import annotations

import json

from flask import Flask, abort, flash, redirect, render_template, request, url_for

from dining_ai.config import BASE_DIR
from dining_ai.models import KIND_LABEL, WEIGHT_LABEL, Condition, won
from dining_ai.service import Service

SAMPLES_DIR = BASE_DIR / "samples"


def create_app(service: Service | None = None) -> Flask:
    app = Flask(__name__)
    app.secret_key = "prototype-only"  # 로컬 데모용
    svc = service or Service()
    app.config["SERVICE"] = svc

    app.jinja_env.filters["won"] = won

    @app.context_processor
    def _globals():
        return {"settings": svc.settings, "KIND_LABEL": KIND_LABEL, "WEIGHT_LABEL": WEIGHT_LABEL}

    def _view(mid: int) -> dict:
        m = svc.store.meeting(mid) or abort(404)
        latest = svc.store.latest_round(mid)
        data = latest["data"] if latest else None
        conds = [Condition.from_dict(c) for c in data["conditions"]] if data else []
        cands = data["ranking"]["candidates"] if data else []
        return {"m": m, "round": latest, "data": data, "conds": conds, "cands": cands,
                "tally": svc.tally(mid, [c["id"] for c in cands])}

    @app.get("/")
    def index():
        samples = []
        for p in sorted(SAMPLES_DIR.glob("*.json")):
            samples.append({"file": p.name, **json.loads(p.read_text(encoding="utf-8"))})
        return render_template("index.html", meetings=svc.store.meetings(), samples=samples)

    @app.post("/meetings")
    def create_meeting():
        text = request.form.get("request", "").strip()
        if not text:
            flash("모임 조건을 한 줄 이상 적어 주세요", "error")
            return redirect(url_for("index"))
        mid = svc.create_meeting(request.form.get("title", ""), text, request.form.get("author", "") or "담당자")
        return redirect(url_for("meeting", mid=mid))

    @app.post("/samples/<name>")
    def load_sample(name: str):
        p = SAMPLES_DIR / name
        if p.suffix != ".json" or not p.exists() or p.parent != SAMPLES_DIR:
            abort(404)
        s = json.loads(p.read_text(encoding="utf-8"))
        text = "\n".join(f"{o['author']}: {o['text']}" for o in s["opinions"])
        mid = svc.create_meeting(s["title"], text, suggestions=s.get("next", []))
        return redirect(url_for("meeting", mid=mid))

    @app.get("/m/<int:mid>")
    def meeting(mid: int):
        v = _view(mid)
        return render_template("meeting.html", **v, opinions=svc.store.opinions(mid), rounds=svc.store.rounds(mid),
                               booking=svc.booking(mid), restaurants=svc.by_id,
                               vote_url=url_for("vote", token=v["m"]["token"], _external=True))

    @app.post("/m/<int:mid>/opinions")
    def add_opinion(mid: int):
        svc.store.meeting(mid) or abort(404)
        n = svc.add_opinions(mid, request.form.get("text", ""), request.form.get("author", ""))
        if n:
            flash(f"의견 {n}개를 반영해 후보를 다시 골랐습니다", "ok")
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/suggest/<int:i>")
    def use_suggestion(mid: int, i: int):
        m = svc.store.meeting(mid) or abort(404)
        if 0 <= i < len(m["suggestions"]):
            svc.add_opinions(mid, m["suggestions"][i])
            rest = [s for j, s in enumerate(m["suggestions"]) if j != i]
            svc.store.set_suggestions(mid, rest)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/opinions/<int:oid>/delete")
    def delete_opinion(mid: int, oid: int):
        svc.delete_opinion(mid, oid)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/conditions")
    def override(mid: int):
        svc.store.meeting(mid) or abort(404)
        svc.set_override(mid, request.form["key"], request.form["value"])
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/votes/<int:vid>/adopt")
    def adopt(mid: int, vid: int):
        svc.adopt_comment(mid, vid)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/decide")
    def decide(mid: int):
        svc.store.meeting(mid) or abort(404)
        svc.decide(mid, request.form.get("rid") or None)
        return redirect(url_for("meeting", mid=mid))

    @app.post("/m/<int:mid>/delete")
    def delete_meeting(mid: int):
        svc.store.delete_meeting(mid)
        flash("모임을 지웠습니다", "ok")
        return redirect(url_for("index"))

    @app.route("/v/<token>", methods=["GET", "POST"])
    def vote(token: str):
        m = svc.store.meeting_by_token(token) or abort(404)
        v = _view(m["id"])
        voted = None
        if request.method == "POST":
            voter = request.form.get("voter", "").strip()[:20]
            rid = request.form.get("rid", "")
            if not voter or rid not in [c["id"] for c in v["cands"]]:
                flash("이름과 식당을 골라 주세요", "error")
            else:
                svc.store.vote(m["id"], voter, rid, request.form.get("comment", "").strip()[:200])
                voted = voter
                v = _view(m["id"])
        return render_template("vote.html", **v, voted=voted, restaurants=svc.by_id)

    return app


if __name__ == "__main__":
    import os

    # 같은 와이파이의 팀원 휴대폰에서 투표하려면 HOST=0.0.0.0
    create_app().run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=True)
