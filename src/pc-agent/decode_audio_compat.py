"""명시적 로컬 오디오 도구용 PyAV 디코더. 기존 일꾼의 WAV 계약은 바꾸지 않는다."""
import math
import os
import stat
import io
from contextlib import contextmanager


class AudioLimitExceeded(ValueError):
    """입력 크기 또는 디코딩 길이가 허용량을 넘었다."""


@contextmanager
def _local_source(value, byte_limit):
    if hasattr(value, "read") and not isinstance(value, (str, bytes, os.PathLike)):
        # 호출자가 연 스트림은 닫지 않는다. 읽는 양은 한도를 넘겨 한 바이트까지만.
        data = value.read(byte_limit + 1)
        if not isinstance(data, bytes):
            raise TypeError("audio stream must return bytes")
        if len(data) > byte_limit:
            raise AudioLimitExceeded("audio input exceeds byte limit")
        with io.BytesIO(data) as source:
            yield source
        return
    filename = os.fspath(value)
    if not isinstance(filename, str) or "://" in filename:
        raise ValueError("only a local file path is accepted")
    fd = os.open(filename, os.O_RDONLY | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("only a regular local file is accepted")
        if info.st_size > byte_limit:
            raise AudioLimitExceeded("audio input exceeds byte limit")
        yield source


def decode_audio_compat(input_file, *, max_seconds=600, max_input_bytes=64 * 1024 * 1024):
    """로컬 파일을 16kHz 모노 float32 배열로 읽는다.

    로컬 파일 경로 또는 이미 열린 바이너리 스트림을 받는다. URL·장치·파이프 경로는 거절한다. 기본 한도는 64MiB,
    디코딩된 오디오 10분이다. 디코더 오류를 무시하거나 다른 엔진으로
    재시도하지 않는다. 실행 시간 제한은 호출하는 작업 프로세스의 책임이다.
    """
    if isinstance(max_seconds, bool) or not isinstance(max_seconds, (int, float)) or not math.isfinite(max_seconds) or max_seconds <= 0:
        raise ValueError("max_seconds must be positive and finite")
    if not isinstance(max_input_bytes, int) or isinstance(max_input_bytes, bool) or max_input_bytes <= 0:
        raise ValueError("max_input_bytes must be a positive integer")
    limit = int(max_seconds * 16000)
    if limit < 1:
        raise ValueError("max_seconds must allow at least one sample")
    with _local_source(input_file, max_input_bytes) as source:
        import av
        import numpy as np

        chunks = []
        count = 0
        resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

        def collect(frame):
            nonlocal count
            for converted in resampler.resample(frame):
                size = converted.samples
                if count + size > limit:
                    raise AudioLimitExceeded("decoded audio exceeds duration limit")
                chunks.append(converted.to_ndarray().reshape(-1))
                count += size

        # PyAV19에 없는 metadata_errors 인자를 전달하지 않는다.
        with av.open(source, mode="r", options={"protocol_whitelist": "file,pipe"}) as container:
            if not container.streams.audio:
                raise ValueError("audio contains no audio stream")
            for frame in container.decode(audio=0):
                collect(frame)
            collect(None)
        if not chunks:
            raise ValueError("audio contains no decoded samples")
        return np.concatenate(chunks).astype(np.float32) / 32768.0
