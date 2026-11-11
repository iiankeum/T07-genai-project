"""웹 화면. 실행: python app.py → http://localhost:5000

- 담당자 화면  /m/<id>   : 의견 입력, 조건 확인·수정, 후보 3곳 비교, 투표 현황, 결정·예약 안내
                          모임을 만든 브라우저(또는 담당자 링크 ?k=관리 토큰)에서만 열린다
- 투표 화면    /v/<토큰> : 팀원이 공유 링크로 들어와 투표 (로그인 없음, 브라우저마다 한 표)
"""
from __future__ import annotations

import json
import os
import secrets
import uuid

from flask import Flask, abort, flash, redirect, render_template, request, session, url_for

from dining_ai.config import BASE_DIR
from dining_ai.models import KIND_LABEL, WEIGHT_LABEL, Condition, won
from dining_ai.service import Service

SAMPLES_DIR = BASE_DIR / "samples"


def debug_enabled() -> bool:
    """디버그 모드는 FLASK_DEBUG=1일 때만. 다른 사람이 접속할 수 있는 상태에서는 켜지 않는다."""
    return os.getenv("FLASK_DEBUG") == "1"


def _secret_key(svc: Service) -> str:
    """세션 서명 키. 저장소에 고정값을 두지 않고 var/secret_key에 무작위로 만들어 둔다."""
    if os.getenv("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    path = svc.settings.data_dir / "secret_key"
    if path.exists() and path.read_text().strip():
        return path.read_text().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_hex(32)
    path.write_text(key)
    try:
        path.chmod(0o600)
    except OSError:  # 윈도우 등
        pass
    return key


def create_app(service: Service | None = None) -> Flask:
    app = Flask(__name__)
    svc = service or Service()
    app.secret_key = _secret_key(svc)
    app.config.update(SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_HTTPONLY=True)
    app.config["SERVICE"] = svc

    # ── 담당자 권한: 모임을 만든 브라우저의 세션, 또는 담당자 링크(?k=관리 토큰) ──
    def _grant(m: dict) -> None:
        admin = dict(session.get("admin", {}))
        admin[str(m["id"])] = m["admin_token"]
        session["admin"] = admin
        session.permanent = True

    def _is_admin(m: dict) -> bool:
        mine = session.get("admin", {}).get(str(m["id"]), "")
        return bool(m["admin_token"]) and secrets.compare_digest(mine, m["admin_token"])

    def _admin_meeting(mid: int) -> dict:
        m = svc.store.meeting(mid) or abort(404)
        k = request.args.get("k", "")
        if k and secrets.compare_digest(k, m["admin_token"]):
            _grant(m)
        if not _is_admin(m):
            abort(403)
        return m

    @app.errorhandler(403)
    def _forbidden(_e):
        return render_template("forbidden.html"), 403

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
        mine = [m for m in svc.store.meetings() if _is_admin(m)]  # 이 브라우저가 담당자인 모임만
        return render_template("index.html", meetings=mine, samples=samples)

    @app.post("/meetings")
    def create_meeting():
        text = request.form.get("request", "").strip()
        if not text:
            flash("모임 조건을 한 줄 이상 적어 주세요", "error")
            return redirect(url_for("index"))
        mid = svc.create_meeting(request.form.get("title", ""), text, request.form.get("author", "") or "담당자")
        _grant(svc.store.meeting(mid))
        return redirect(url_for("meeting", mid=mid))

    @app.post("/samples/<name>")
    def load_sample(name: str):
        p = SAMPLES_DIR / name
        if p.suffix != ".json" or not p.exists() or p.parent != SAMPLES_DIR:
            abort(404)
        s = json.loads(p.read_text(encoding="utf-8"))
        text = "\n".join(f"{o['author']}: {o['text']}" for o in s["opinions"])
        mid = svc.create_meeting(s["title"], text, suggestions=s.get("next", []))
        _grant(svc.store.meeting(mid))
        return redirect(url_for("meeting", mid=mid))

    @app.get("/m/<int:mid>")
    def meeting(mid: int):
        m = _admin_meeting(mid)
        if request.args.get("k"):  # 담당자 링크로 들어왔으면 주소창에서 토큰을 지운다
            return redirect(url_for("meeting", mid=mid))
        v = _view(mid)
        return render_template("meeting.html", **v, opinions=svc.store.opinions(mid), rounds=svc.store.rounds(mid),
                               booking=svc.booking(mid), restaurants=svc.by_id,
                               vote_url=url_for("vote", token=v["m"]["token"], _external=True),
                               admin_url=url_for("meeting", mid=mid, k=m["admin_token"], _external=True))

    @app.post("/m/<int:mid>/opinions")
    def add_opinion(mid: int):
        _admin_meeting(mid)
        n = svc.add_opinions(mid, request.form.get("text", ""), request.form.get("author", ""))
        if n:
            flash(f"의견 {n}개를 반영해 후보를 다시 골랐습니다", "ok")
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/suggest/<int:i>")
    def use_suggestion(mid: int, i: int):
        m = _admin_meeting(mid)
        if 0 <= i < len(m["suggestions"]):
            svc.add_opinions(mid, m["suggestions"][i])
            rest = [s for j, s in enumerate(m["suggestions"]) if j != i]
            svc.store.set_suggestions(mid, rest)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/opinions/<int:oid>/delete")
    def delete_opinion(mid: int, oid: int):
        _admin_meeting(mid)
        svc.delete_opinion(mid, oid)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/conditions")
    def override(mid: int):
        _admin_meeting(mid)
        svc.set_override(mid, request.form["key"], request.form["value"])
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/votes/<int:vid>/adopt")
    def adopt(mid: int, vid: int):
        _admin_meeting(mid)
        svc.adopt_comment(mid, vid)
        return redirect(url_for("meeting", mid=mid) + "#changes")

    @app.post("/m/<int:mid>/decide")
    def decide(mid: int):
        _admin_meeting(mid)
        svc.decide(mid, request.form.get("rid") or None)
        return redirect(url_for("meeting", mid=mid))

    @app.post("/m/<int:mid>/delete")
    def delete_meeting(mid: int):
        _admin_meeting(mid)
        svc.store.delete_meeting(mid)
        flash("모임을 지웠습니다", "ok")
        return redirect(url_for("index"))

    @app.route("/v/<token>", methods=["GET", "POST"])
    def vote(token: str):
        m = svc.store.meeting_by_token(token) or abort(404)
        v = _view(m["id"])
        if "voter_key" not in session:  # 브라우저마다 한 표 (이름이 같아도 사람을 구분)
            session["voter_key"] = uuid.uuid4().hex
            session.permanent = True
        voted = None
        if request.method == "POST":
            voter = request.form.get("voter", "").strip()[:20]
            rid = request.form.get("rid", "")
            if not voter or rid not in [c["id"] for c in v["cands"]]:
                flash("이름과 식당을 골라 주세요", "error")
            else:
                svc.store.vote(m["id"], session["voter_key"], voter, rid, request.form.get("comment", "").strip()[:200])
                voted = voter
                v = _view(m["id"])
        mine = svc.store.vote_of(m["id"], session["voter_key"])
        return render_template("vote.html", **v, voted=voted, mine=mine, restaurants=svc.by_id)

    return app


if __name__ == "__main__":
    # 같은 와이파이의 팀원 휴대폰에서 투표하려면 HOST=0.0.0.0 (이때 FLASK_DEBUG=1은 쓰지 않는다)
    create_app().run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=debug_enabled())
