"""명령줄 도구.

  python cli.py process 녹음1.m4a 녹음2.txt   # 파일을 주문 카드로
  python cli.py watch D:/통화녹음 --interval 5   # 녹음이 쌓이는 폴더 감시
  python cli.py summary --date 2026-11-11       # 하루 마감 요약 출력
  python cli.py samples                         # 가짜 주문 통화 불러오기
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

from order_ai.config import BASE_DIR
from order_ai.pipeline import Pipeline
from order_ai.summary import summarize


def _print_card(pipe: Pipeline, cid: int) -> None:
    r = pipe.store.get(cid)
    c = r.card
    print(f"#{r.id} [{r.extractor}] {c.customer or '거래처 미상'} / {c.vehicle_model} {c.vehicle_year} {c.plate}"
          f"{' / 급함' if c.urgent else ''}{(' / ' + c.due) if c.due else ''}")
    for it in c.items:
        print(f"   - {(it.position + ' ') if it.position else ''}{it.part} × {it.quantity if it.quantity is not None else '?'}")
    for f in c.follow_ups:
        print(f"   ☎ {f}")
    for w in r.warnings:
        print(f"   ! {w}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="AI 전화 주문 받아쓰기")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("process", help="녹음/글 파일을 주문 카드로 만든다")
    p.add_argument("files", nargs="+", type=Path)
    w = sub.add_parser("watch", help="녹음이 쌓이는 폴더를 감시한다")
    w.add_argument("folder", type=Path)
    w.add_argument("--interval", type=float, default=5.0)
    s = sub.add_parser("summary", help="하루 마감 요약")
    s.add_argument("--date", default=date.today().isoformat())
    sub.add_parser("samples", help="가짜 주문 통화(samples/)를 불러온다")
    args = ap.parse_args(argv)

    pipe = Pipeline()
    if args.cmd == "process":
        for f in args.files:
            try:
                _print_card(pipe, pipe.process_file(f))
            except Exception as e:
                print(f"[실패] {f}: {e}", file=sys.stderr)
    elif args.cmd == "samples":
        for f in sorted((BASE_DIR / "samples").glob("*.txt")):
            _print_card(pipe, pipe.process_file(f, call_at=datetime.now()))
    elif args.cmd == "watch":
        if not args.folder.is_dir():
            print(f"폴더가 없습니다: {args.folder}", file=sys.stderr)
            return 1
        try:
            pipe.watch(args.folder, args.interval)
        except KeyboardInterrupt:
            print("\n감시를 멈췄습니다")
    elif args.cmd == "summary":
        print(summarize(args.date, pipe.store.list(date=args.date)).to_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
