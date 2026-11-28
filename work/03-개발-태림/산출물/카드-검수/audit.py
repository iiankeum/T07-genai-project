"""Aggregate manually reviewed order card fields locally (#61)."""
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

HEADER = ["call_id", "field", "judgment", "warning"]
CALL_ID = re.compile(r"C[0-9]{3,6}", re.ASCII)
FIELD = re.compile(r"(customer|vehicle|delivery|(?:part|quantity):[0-9]{2})", re.ASCII)
DECIDED = {"correct", "wrong"}


def summarize(rows):
    seen = set()
    statuses = {}
    fields = Counter()
    judged_calls = set()
    silent_calls = set()
    unsure_calls = set()
    for line, row in enumerate(rows, 2):
        if len(row) != len(HEADER):
            raise ValueError(f"{line}행: 열 개수가 다릅니다.")
        call_id, field, judgment, warning = row
        if not CALL_ID.fullmatch(call_id):
            raise ValueError(f"{line}행: 통화에는 C001 형식의 시험 번호만 사용하세요.")
        if (call_id, field) in seen:
            raise ValueError(f"{line}행: 같은 통화에서 같은 칸을 중복 기록했습니다.")
        seen.add((call_id, field))
        no_card = field == "card" and judgment == "missing_card" and warning == ""
        if not no_card and not (
            FIELD.fullmatch(field) and judgment in DECIDED | {"unsure", "not_applicable"}
            and (warning in {"yes", "no"} if judgment in DECIDED else warning == "")
        ):
            raise ValueError(f"{line}행: 칸, 판정 또는 경고 형식이 다릅니다.")
        if statuses.setdefault(call_id, no_card) != no_card:
            raise ValueError(f"{line}행: 카드 없음과 칸 검수는 같은 통화에 기록할 수 없습니다.")
        if no_card:
            continue
        field_type = field.split(":")[0]
        fields[field_type, "recorded"] += 1
        if judgment in DECIDED:
            judged_calls.add(call_id)
            fields[field_type, "judged"] += 1
            if judgment == "wrong":
                kind = "warned_wrong" if warning == "yes" else "unwarned_wrong"
                fields[field_type, kind] += 1
                if warning == "no":
                    silent_calls.add(call_id)
            elif warning == "yes":
                fields[field_type, "warned_correct"] += 1
        else:
            fields[field_type, judgment] += 1
            if judgment == "unsure":
                unsure_calls.add(call_id)
    if not statuses:
        raise ValueError("기록이 없습니다.")
    kinds = ("recorded", "judged", "warned_wrong", "unwarned_wrong",
             "warned_correct", "unsure", "not_applicable")
    by_field = {
        field: {key: fields[field, key] for key in kinds}
        for field in ("customer", "vehicle", "part", "quantity", "delivery")
    }
    return {
        "calls_logged": len(statuses),
        "calls_missing_card": sum(statuses.values()),
        "calls_with_judged_fields": len(judged_calls),
        "calls_with_unwarned_error": len(silent_calls),
        "calls_with_unsure_fields": len(unsure_calls),
        "fields": {key: sum(row[key] for row in by_field.values()) for key in kinds},
        "by_field": by_field,
    }


def main():
    parser = argparse.ArgumentParser(description="수기 카드 검수 CSV를 읽어 개수만 출력합니다.")
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    try:
        with args.csv_path.open(encoding="utf-8-sig", newline="") as file:
            rows = csv.reader(file, strict=True)
            if next(rows, None) != HEADER:
                raise ValueError("CSV 헤더가 다릅니다. 예시와 같은 열 순서를 쓰세요.")
            output = summarize(rows)
    except ValueError as exc:
        # UnicodeDecodeError can expose raw byte values, unlike our fixed messages.
        parser.exit(2, "오류: UTF-8 CSV만 지원합니다.\n" if isinstance(exc, UnicodeError)
                    else f"오류: {exc}\n")
    except (OSError, csv.Error):
        parser.exit(2, "오류: 입력을 열 수 없거나 CSV 형식이 잘못됐습니다.\n")
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
