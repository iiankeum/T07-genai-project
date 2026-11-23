"""콜노트 PC 프로그램 시험 — Whisper 없이 가짜 서버 · 가짜 받아쓰기로 돈다.

실행: python -m unittest discover -s src/pc-agent/tests -v
"""
from __future__ import annotations

import email.parser
import email.policy
import hashlib
import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import callnote_agent as ca  # noqa: E402

TOKEN_W = "w" * 48
TOKEN_I = "i" * 48


def make_wav(sec=1.0, rate=16000, ch=1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x01" * int(sec * rate) * ch)
    return buf.getvalue()


class FakeServer:
    """worker-api.md v1 의 모양을 흉내 낸 서버."""

    def __init__(self):
        self.jobs = []          # claim 으로 줄 일감
        self.results = {}       # jobId → payload
        self.fails = {}         # jobId → payload
        self.heartbeats = []
        self.ingests = []       # (fields, filename, data)
        self.ingest_replies = []  # [(status, body)] 차례로
        self.audio = {}
        self.auth_seen = []
        srv = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, code, obj=None):
                body = b"" if obj is None else json.dumps(obj).encode()
                self.send_response(code)
                if obj is not None:
                    self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _auth(self, token):
                a = self.headers.get("Authorization", "")
                srv.auth_seen.append((self.path, a))
                return a == f"Bearer {token}"

            def do_GET(self):
                if self.path.startswith("/api/worker/jobs/") and self.path.endswith("/audio"):
                    if not self._auth(TOKEN_W):
                        return self._send(401, {"error": "unauthorized"})
                    jid = self.path.split("/")[4]
                    data = srv.audio[jid]
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/wav")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                if self.path == "/redirect":
                    self.send_response(302)
                    self.send_header("Location", "http://example.invalid/steal")
                    self.end_headers()
                    return
                self._send(404, {"error": "not_found"})

            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(n)
                if self.path == "/api/ingest":
                    if not self._auth(TOKEN_I):
                        return self._send(401, {"error": "unauthorized"})
                    msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
                        b"Content-Type: " + self.headers["Content-Type"].encode() + b"\r\n\r\n" + body)
                    fields, fname, fdata = {}, None, None
                    for part in msg.iter_parts():
                        name = part.get_param("name", header="content-disposition")
                        if part.get_filename():
                            fname, fdata = part.get_filename(), part.get_payload(decode=True)
                        else:
                            fields[name] = part.get_content().strip()
                    srv.ingests.append((fields, fname, fdata))
                    code, obj = srv.ingest_replies.pop(0) if srv.ingest_replies else (201, {"callId": "call_1", "jobId": "job_1", "status": "queued"})
                    return self._send(code, obj)
                if not self._auth(TOKEN_W):
                    return self._send(401, {"error": "unauthorized"})
                data = json.loads(body or b"{}")
                if self.path == "/api/worker/heartbeat":
                    srv.heartbeats.append(data)
                    return self._send(200, {"ok": True})
                if self.path == "/api/worker/claim":
                    if not srv.jobs:
                        return self._send(204)
                    return self._send(200, srv.jobs.pop(0))
                if self.path.endswith("/result"):
                    srv.results[self.path.split("/")[4]] = data
                    return self._send(200, {"ok": True, "next": "extracting"})
                if self.path.endswith("/fail"):
                    srv.fails[self.path.split("/")[4]] = data
                    return self._send(200, {"ok": True})
                self._send(404, {"error": "not_found"})

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self):
        self.httpd.shutdown()


class FakeTranscriber:
    engine = "fake-whisper (cpu, int8)"
    gpu = "CPU"

    def __init__(self):
        self.calls = []

    def transcribe(self, audio, prompt, language="ko"):
        self.calls.append((len(audio), prompt))
        segs = ca.clean_segments([
            {"start": 0.0, "end": 0.5, "text": " 네 부품입니다."},
            {"start": 0.5, "end": 0.9, "text": "시청해 주셔서 감사합니다."},
            {"start": 0.95, "end": 1.0, "text": "자막 제공 아무개"},
        ], len(audio) / 16000)
        return {"text": " ".join(s["text"] for s in segs), "segments": segs,
                "durationSec": round(len(audio) / 16000, 1), "elapsedSec": 0.1, "language": language}


class TestPieces(unittest.TestCase):
    def test_multipart_roundtrip(self):
        body, ctype = ca.encode_multipart({"deviceName": "pc-1", "fake": "true"}, "file", "가짜 통화.wav",
                                          "audio/wav", b"RIFFdata")
        msg = email.parser.BytesParser(policy=email.policy.default).parsebytes(
            b"Content-Type: " + ctype.encode() + b"\r\n\r\n" + body)
        parts = list(msg.iter_parts())
        self.assertEqual(parts[0].get_content().strip(), "pc-1")
        self.assertEqual(parts[2].get_filename(), "가짜 통화.wav")
        self.assertEqual(parts[2].get_payload(decode=True), b"RIFFdata")

    def test_wav_validation(self):
        a = ca.read_wav_16k_mono(make_wav(0.5))
        self.assertEqual(len(a), 8000)
        with self.assertRaises(ca.BadAudio):
            ca.read_wav_16k_mono(make_wav(0.5, rate=8000))
        with self.assertRaises(ca.BadAudio):
            ca.read_wav_16k_mono(make_wav(0.5, ch=2))
        with self.assertRaises(ca.BadAudio):
            ca.read_wav_16k_mono(b"ID3 not a wav at all")

    def test_clean_segments(self):
        segs = ca.clean_segments([
            {"start": 0, "end": 1, "text": "네 좋아요, 두 개 주세요"},
            {"start": 1, "end": 2, "text": "구독과 좋아요 부탁드립니다"},
            {"start": 9.8, "end": 10, "text": "끝 꼬리"},
        ], 10.0)
        self.assertEqual([s["text"] for s in segs], ["네 좋아요, 두 개 주세요"])

    def test_vad_guard_falls_back_when_vad_drops_speech(self):
        import types

        class FakeModel:
            def __init__(self, kept):
                self.kept, self.calls = kept, []

            def transcribe(self, audio, vad_filter, **kw):
                self.calls.append((vad_filter, kw.get("vad_parameters") if vad_filter else None))
                n = len(audio) / 16000
                seg = types.SimpleNamespace(start=0.0, end=1.0, text="네 부품입니다" if vad_filter else "네 부품입니다 앞범퍼 하나요")
                info = types.SimpleNamespace(duration=n, duration_after_vad=self.kept if vad_filter else n)
                return iter([seg]), info

        import numpy as np
        audio = np.zeros(16000 * 20, dtype=np.float32)
        m = FakeModel(kept=1.5)                      # 20초 중 1.5초만 남김 → 다시
        out, fb = ca.transcribe_with_vad_guard(m, audio, "휀다")
        self.assertTrue(fb)
        self.assertEqual([c[0] for c in m.calls], [True, False])
        self.assertEqual(m.calls[0][1], ca.VAD_PARAMS)
        self.assertEqual(out["text"], "네 부품입니다 앞범퍼 하나요")
        m2 = FakeModel(kept=15.0)                    # 충분히 남김 → 그대로
        out2, fb2 = ca.transcribe_with_vad_guard(m2, audio, None)
        self.assertFalse(fb2)
        self.assertEqual(len(m2.calls), 1)

    def test_api_refuses_other_origin_and_redirect(self):
        srv = FakeServer()
        try:
            api = ca.Api(srv.url)
            with self.assertRaises(PermissionError):
                api.request("GET", "http://example.invalid/x", TOKEN_W)
            r = api.request("GET", "/redirect", TOKEN_W)
            self.assertEqual(r.status, 302)  # 따라가지 않는다
        finally:
            srv.close()


class TestWorker(unittest.TestCase):
    def test_claim_transcribe_result_and_bad_jobs(self):
        srv = FakeServer()
        try:
            wav = make_wav(1.0)
            srv.audio["job_ok"] = wav
            srv.audio["job_bad"] = make_wav(1.0, rate=8000)
            srv.jobs = [
                {"jobId": "job_ok", "audioUrl": srv.url + "/api/worker/jobs/job_ok/audio",
                 "audioSha256": hashlib.sha256(wav).hexdigest(), "initialPrompt": "휀다, 쇼바", "language": "ko"},
                {"jobId": "job_evil", "audioUrl": "http://example.invalid/api/worker/jobs/job_evil/audio"},
                {"jobId": "job_bad", "audioUrl": "/api/worker/jobs/job_bad/audio"},
            ]
            fake = FakeTranscriber()
            stop = threading.Event()
            w = ca.Worker(ca.Api(srv.url), TOKEN_W, "test-pc", lambda: fake, stop, idle_sec=0.05)
            t = threading.Thread(target=w.run, daemon=True)
            t.start()
            deadline = time.time() + 10
            while time.time() < deadline and len(srv.results) + len(srv.fails) < 3:
                time.sleep(0.05)
            stop.set()
            t.join(5)
            res = srv.results["job_ok"]
            self.assertEqual(res["worker"], "test-pc")
            self.assertEqual(res["text"], "네 부품입니다.")          # 환각 · 꼬리는 버림
            self.assertEqual(res["durationSec"], 1.0)
            self.assertEqual(fake.calls[0], (16000, "휀다, 쇼바"))
            self.assertFalse(srv.fails["job_evil"]["retryable"])   # 다른 주소 → 거절, 토큰 안 보냄
            self.assertFalse(srv.fails["job_bad"]["retryable"])    # 약속과 다른 WAV
            self.assertTrue(srv.heartbeats and srv.heartbeats[0]["worker"] == "test-pc")
            self.assertTrue(all(a == f"Bearer {TOKEN_W}" for p, a in srv.auth_seen if p != "/api/ingest"))
        finally:
            srv.close()


class TestWatcher(unittest.TestCase):
    def test_stable_upload_dedupe_retry_reject(self):
        srv = FakeServer()
        tmp = tempfile.TemporaryDirectory()
        try:
            folder = Path(tmp.name) / "rec"
            folder.mkdir()
            now = [time.time() + 100]
            up = ca.Uploader(ca.Api(srv.url), TOKEN_I, "fake-sender-1")
            w = ca.Watcher(up, folder, Path(tmp.name) / "state.json", clock=lambda: now[0])
            a = folder / "010-1234-5678 통화 녹음.m4a"
            a.write_bytes(b"fake-audio-A" * 100)
            (folder / "메모.txt").write_text("x")
            self.assertEqual(w.scan_once()["sent"], 0)             # 처음 본 파일은 한 번 더 지켜본다
            self.assertEqual(w.scan_once()["sent"], 1)
            fields, fname, data = srv.ingests[0]
            self.assertEqual(fields["deviceName"], "fake-sender-1")
            self.assertEqual(fields["fake"], "true")
            self.assertTrue(fname.startswith("rec-") and fname.endswith(".m4a"))  # 원래 이름(번호)을 보내지 않음
            self.assertNotIn("010", fname)
            self.assertEqual(data, b"fake-audio-A" * 100)
            self.assertEqual(w.scan_once()["sent"], 0)             # 다시 올리지 않음

            # 같은 내용의 파일을 다른 이름으로 → 해시가 같아 올리지 않음
            (folder / "copy.m4a").write_bytes(b"fake-audio-A" * 100)
            w.scan_once(); w.scan_once()
            self.assertEqual(len(srv.ingests), 1)

            # 서버가 잠깐 503 → 미뤘다가 다시
            b = folder / "b.wav"
            b.write_bytes(b"fake-audio-B" * 50)
            srv.ingest_replies = [(503, {"error": "busy"}), (200, {"callId": "call_b", "status": "duplicate"})]
            w.scan_once(); c = w.scan_once()
            self.assertEqual(c["retry"], 1)
            self.assertEqual(w.scan_once()["retry"], 0)            # 기다리는 중
            now[0] += 3600
            self.assertEqual(w.scan_once()["duplicate"], 1)

            # 형식이 아니면 서버가 415 → 다시 보내지 않음
            c2 = folder / "c.amr"
            c2.write_bytes(b"not-audio")
            srv.ingest_replies = [(415, {"error": "unsupported_media_type"})]
            w.scan_once(); w.scan_once(); w.scan_once()
            self.assertEqual(len(srv.ingests), 4)

            # 기록 파일을 다시 읽어도 같은 판단
            w2 = ca.Watcher(up, folder, Path(tmp.name) / "state.json", clock=lambda: now[0])
            w2.scan_once(); w2.scan_once()
            self.assertEqual(len(srv.ingests), 4)
        finally:
            srv.close()
            tmp.cleanup()

    def test_too_large_is_rejected_locally(self):
        srv = FakeServer()
        tmp = tempfile.TemporaryDirectory()
        try:
            p = Path(tmp.name) / "big.wav"
            with p.open("wb") as f:
                f.seek(ca.MAX_UPLOAD_BYTES + 10)
                f.write(b"\0")
            up = ca.Uploader(ca.Api(srv.url), TOKEN_I, "x")
            status, info = up.upload(p, "0" * 64)
            self.assertEqual(status, "rejected")
            self.assertEqual(srv.ingests, [])
        finally:
            srv.close()
            tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
