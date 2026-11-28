import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from audit import HEADER, summarize

HERE = Path(__file__).parent


class AuditTest(unittest.TestCase):
    def run_cli(self, filename):
        return subprocess.run(
            [sys.executable, str(HERE / "audit.py"), str(filename)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_synthetic_csv_through_cli(self):
        result = self.run_cli(HERE / "가짜-검수.csv")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["calls_logged"], 4)
        self.assertEqual(data["calls_missing_card"], 1)
        self.assertEqual(data["calls_with_judged_fields"], 2)
        self.assertEqual(data["calls_with_unwarned_error"], 1)
        self.assertEqual(data["calls_with_unsure_fields"], 2)
        self.assertEqual(data["fields"], dict(
            recorded=8, judged=5, warned_wrong=1, unwarned_wrong=2,
            warned_correct=1, unsure=2, not_applicable=1,
        ))
        self.assertEqual(data["by_field"]["part"]["unwarned_wrong"], 1)
        self.assertNotIn("C001", result.stdout)

    def test_marked_error_is_not_silent(self):
        data = summarize([["C001", "quantity:02", "wrong", "yes"]])
        self.assertEqual(data["calls_with_unwarned_error"], 0)
        self.assertEqual(data["by_field"]["quantity"]["warned_wrong"], 1)

    def test_missing_cards_and_unknown_have_no_denominator(self):
        data = summarize([["C001", "card", "missing_card", ""],
                          ["C002", "part:01", "unsure", ""]])
        self.assertEqual(data["calls_with_judged_fields"], 0)
        self.assertEqual(data["fields"]["judged"], 0)

    def test_duplicate_or_missing_card_contradiction(self):
        for rows in (
            [["C001", "customer", "wrong", "yes"]] * 2,
            [["C001", "card", "missing_card", ""], ["C001", "customer", "correct", "no"]],
        ):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                summarize(rows)

    def test_validation_failures_never_echo_source_text_or_path(self):
        marker = "private-test-marker"
        header = ",".join(HEADER).encode()
        for payload in (
            b"wrong,header",
            header,
            header + b"\nC001,customer,wrong,",
            header + b"\nC001,customer,unsure,no",
            header + b"\nC001,customer,wrong,no,extra",
            header + b"\nC001,customer,wrong,\xff",
            header + b'\nC001,customer,wrong,"unterminated',
            header + f"\n{marker},customer,wrong,yes".encode(),
        ):
            with self.subTest(payload=payload), tempfile.TemporaryDirectory() as directory:
                filename = Path(directory) / (marker + ".csv")
                filename.write_bytes(payload)
                result = self.run_cli(filename)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertNotIn(marker, result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_utf8_bom(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "bom.csv"
            file.write_text(",".join(HEADER) + "\nC001,customer,correct,no\n", encoding="utf-8-sig")
            result = self.run_cli(file)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["fields"]["judged"], 1)
