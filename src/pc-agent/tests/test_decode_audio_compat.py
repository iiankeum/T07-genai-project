"""가짜 PCM과 가짜 PyAV로 제한·오류 전달을 검증한다."""
import importlib.util
from pathlib import Path
import tempfile
import io
import sys
import types
import unittest
from unittest.mock import patch
import numpy as np

spec = importlib.util.spec_from_file_location("decode_audio_compat", Path(__file__).parents[1] / "decode_audio_compat.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Frame:
    def __init__(self, samples=4): self.samples = samples
    def to_ndarray(self): return np.full((1, self.samples), 16384, dtype=np.int16)

class Container:
    streams = types.SimpleNamespace(audio=[object()])
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def decode(self, audio): yield Frame()

class Resampler:
    def __init__(self, **kwargs): self.kwargs = kwargs
    def resample(self, frame): return [] if frame is None else [frame]

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name) / "fake.wav"
        self.file.write_bytes(b"fake")
        self.av = types.SimpleNamespace(AudioResampler=Resampler, open=lambda *a, **k: Container())
    def test_dtype_and_normalization(self):
        with patch.dict("sys.modules", {"av": self.av}):
            result = module.decode_audio_compat(self.file)
        self.assertEqual(result.dtype, np.float32)
        np.testing.assert_array_equal(result, [0.5] * 4)
    def test_byte_limit(self):
        with self.assertRaises(module.AudioLimitExceeded): module.decode_audio_compat(self.file, max_input_bytes=3)
    def test_duration_limit(self):
        with patch.dict("sys.modules", {"av": self.av}), self.assertRaises(module.AudioLimitExceeded):
            module.decode_audio_compat(self.file, max_seconds=1 / 16000)
    def test_decoder_error_propagates(self):
        error = RuntimeError("fake decoder failure")
        def fail(*a, **k): raise error
        self.av.open = fail
        with patch.dict("sys.modules", {"av": self.av}), self.assertRaises(RuntimeError) as caught:
            module.decode_audio_compat(self.file)
        self.assertIs(caught.exception, error)
    def test_missing_file(self):
        with self.assertRaises(FileNotFoundError): module.decode_audio_compat(self.file.with_name("missing.wav"))
    def test_remote_rejected(self):
        with self.assertRaises(ValueError): module.decode_audio_compat("https://example.com/fake.wav")
    def test_bad_limits(self):
        for value in [0, -1, float("nan"), float("inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError): module.decode_audio_compat(self.file, max_seconds=value)
    def test_empty_stream(self):
        self.av.open = lambda *a, **k: types.SimpleNamespace()
        class Empty(Container):
            def decode(self, audio): return iter([])
        self.av.open = lambda *a, **k: Empty()
        with patch.dict("sys.modules", {"av": self.av}), self.assertRaisesRegex(ValueError, "no decoded samples"):
            module.decode_audio_compat(self.file)

class APIBranchTests(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(Path(__file__).parents[1]))
        import callnote_agent
        self.agent = callnote_agent
        self.transcriber = callnote_agent.WhisperTranscriber.__new__(callnote_agent.WhisperTranscriber)
        self.transcriber.model = object()
        self.transcriber.beam_size = 5
    def run_audio(self, value):
        with patch.object(self.agent, "transcribe_with_vad_guard", return_value=({"text": "가짜"}, False)) as guard:
            self.transcriber.transcribe(value, None)
            return guard.call_args.args[1]
    def test_array_identity(self):
        arr = np.zeros(4, dtype=np.float32)
        with patch("decode_audio_compat.decode_audio_compat") as decoder:
            self.assertIs(self.run_audio(arr), arr)
            decoder.assert_not_called()
    def test_path_and_stream_decoded_once(self):
        arr = np.zeros(4, dtype=np.float32)
        for value in ["fake.m4a", Path("fake.m4a"), io.BytesIO(b"fake")]:
            with self.subTest(value=value), patch("decode_audio_compat.decode_audio_compat", return_value=arr) as decoder:
                self.assertIs(self.run_audio(value), arr)
                decoder.assert_called_once_with(value)
    def test_decode_error_propagates(self):
        with patch("decode_audio_compat.decode_audio_compat", side_effect=ValueError("fake malformed audio")):
            with self.assertRaisesRegex(ValueError, "fake malformed"):
                self.run_audio("fake.m4a")

class StreamTests(Tests):
    def test_bytesio_not_closed(self):
        stream = io.BytesIO(b"fake")
        with patch.dict("sys.modules", {"av": self.av}):
            self.assertEqual(module.decode_audio_compat(stream).shape, (4,))
        self.assertFalse(stream.closed)
    def test_no_audio_stream(self):
        class VideoOnly(Container): streams = types.SimpleNamespace(audio=[])
        self.av.open = lambda *a, **k: VideoOnly()
        with patch.dict("sys.modules", {"av": self.av}), self.assertRaisesRegex(ValueError, "no audio stream"):
            module.decode_audio_compat(self.file)

if __name__ == "__main__": unittest.main()
