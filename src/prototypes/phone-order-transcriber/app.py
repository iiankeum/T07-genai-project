"""웹 화면. 실행: python app.py → http://localhost:5000"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from pathlib import Path

from flask import Flask, abort, flash, redirect, render_template, request, send_file, url_for

from order_ai.config import BASE_DIR
from order_ai.models import STATUS_LABELS, OrderCard, OrderItem
from order_ai.pipeline import Pipeline
from order_ai.stt import AUDIO_EXTS, TEXT_EXTS
from order_ai.summary import summarize

SAMPLES_DIR = BASE_DIR / "samples"


def create_app(pipeline: Pipeline | None = None) -> Flask:
    app = Flask(__name__)
    app.secret_key = "prototype-only"  # 로컬 데모용
    app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024
    pipe = pipeline or Pipeline()
    app.config["PIPELINE"] = pipe

    @app.template_filter("pretty")
    def _pretty(obj) -> str:
        return json.dumps(obj, ensure_ascii=False, indent=2)

    @app.context_processor
    def _globals():
        return {"STATUS_LABELS": STATUS_LABELS, "settings": pipe.settings}

    @app.get("/")
    def index():
        day = request.args.get("date") or date.today().isoformat()
        status = request.args.get("status") or None
        records = pipe.store.list(date=day, status=status)
        dates = pipe.store.dates()
        if day not in dates:
            dates = [day, *dates]
        return render_template("index.html", records=records, day=day, status=status, dates=dates)

    @app.post("/upload")
    def upload():
        files = request.files.getlist("files")
        ok = 0
        for f in files:
            if not f or not f.filename:
                continue
            ext = Path(f.filename).suffix.lower()
            if ext not in AUDIO_EXTS | TEXT_EXTS:
                flash(f"{f.filename}: 지원하지 않는 형식입니다", "error")
                continue
            pipe.settings.upload_dir.mkdir(parents=True, exist_ok=True)
            dest = pipe.settings.upload_dir / f"{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}{ext}"
            f.save(dest)
            try:
                cid = pipe.process_file(dest, source_name=f.filename, call_at=datetime.now())
                ok += 1
                last = cid
            except Exception as e:
                flash(f"{f.filename}: {e}", "error")
        if ok == 1:
            return redirect(url_for("card", card_id=last))
        if ok:
            flash(f"{ok}건을 주문 카드로 만들었습니다", "ok")
        return redirect(url_for("index"))

    @app.post("/samples")
    def load_samples():
        n = 0
        for p in sorted(SAMPLES_DIR.glob("*")):
            if p.suffix.lower() in AUDIO_EXTS | TEXT_EXTS:
                try:
                    pipe.process_file(p, call_at=datetime.now().replace(second=0, microsecond=0))
                    n += 1
                except Exception as e:
                    flash(f"{p.name}: {e}", "error")
        flash(f"가짜 주문 통화 {n}건을 불러왔습니다", "ok")
        return redirect(url_for("index"))

    @app.get("/cards/<int:card_id>")
    def card(card_id: int):
        rec = pipe.store.get(card_id) or abort(404)
        return render_template("card.html", r=rec)

    @app.post("/cards/<int:card_id>")
    def save_card(card_id: int):
        rec = pipe.store.get(card_id) or abort(404)
        form = request.form
        items: list[OrderItem] = []
        i = 0
        while f"items-{i}-part" in form:
            if form.get(f"items-{i}-part", "").strip() and not form.get(f"items-{i}-delete"):
                items.append(OrderItem.from_dict({k: form.get(f"items-{i}-{k}", "") for k in
                                                  ("part", "quantity", "position", "part_number", "evidence")}))
            i += 1
        card = OrderCard(
            customer=form.get("customer", "").strip(),
            vehicle_model=form.get("vehicle_model", "").strip(),
            vehicle_year=form.get("vehicle_year", "").strip(),
            plate=form.get("plate", "").strip(),
            items=items,
            urgent=bool(form.get("urgent")),
            due=form.get("due", "").strip(),
            delivery=form.get("delivery", "").strip(),
            follow_ups=[ln.strip() for ln in form.get("follow_ups", "").splitlines() if ln.strip()],
            memo=form.get("memo", "").strip(),
        )
        action = form.get("action", "save")
        status = {"confirm": "confirmed", "ship": "shipped", "cancel": "canceled", "reopen": "draft"}.get(action)
        if action == "confirm":
            missing = [it.part for it in card.items if not it.part_number]
            if missing:
                flash("품번이 비어 있는 부품이 있어 확정할 수 없습니다: " + ", ".join(missing), "error")
                pipe.store.update(rec.id, card=card)
                return redirect(url_for("card", card_id=rec.id))
        pipe.store.update(rec.id, card=card, status=status)
        flash({"confirmed": "확정했습니다", "shipped": "출고 완료로 표시했습니다",
               "canceled": "취소했습니다", "draft": "다시 '확인 필요'로 돌렸습니다"}.get(status, "저장했습니다"), "ok")
        if status in ("confirmed", "shipped"):
            return redirect(url_for("index", date=rec.call_date))
        return redirect(url_for("card", card_id=rec.id))

    @app.post("/cards/<int:card_id>/delete")
    def delete_card(card_id: int):
        rec = pipe.store.get(card_id) or abort(404)
        pipe.store.delete(card_id)
        flash(f"카드 #{card_id}를 지웠습니다", "ok")
        return redirect(url_for("index", date=rec.call_date))

    @app.get("/cards/<int:card_id>/audio")
    def audio(card_id: int):
        rec = pipe.store.get(card_id) or abort(404)
        if not rec.audio_path or not Path(rec.audio_path).exists():
            abort(404)
        return send_file(rec.audio_path)

    @app.get("/summary")
    def summary():
        day = request.args.get("date") or date.today().isoformat()
        s = summarize(day, pipe.store.list(date=day))
        return render_template("summary.html", s=s, day=day, dates=pipe.store.dates())

    return app


if __name__ == "__main__":
    import os

    create_app().run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
