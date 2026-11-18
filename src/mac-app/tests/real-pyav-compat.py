"""선택 실검증: 준비된 로컬 모델과 가짜 음성 WAV/MP3/M4A만 사용한다.

실행: python -I -B real-pyav-compat.py --run-synthetic-model-test --agent-dir <복사한두파일폴더> --model <로컬모델> --fixtures <synthetic.*폴더>
네트워크 다운로드·실제 고객 음성·패키지 수정은 하지 않는다.
"""
import argparse
import io
import json
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-synthetic-model-test", action="store_true", required=True)
    parser.add_argument("--agent-dir", "--agent-source", dest="agent_dir", default=str(Path(__file__).resolve().parents[2]/"pc-agent"))
    parser.add_argument("--model", required=True)
    parser.add_argument("--fixtures", required=True)
    args = parser.parse_args()
    agent, model, fixtures = (Path(p).resolve(strict=True) for p in (args.agent_dir, args.model, args.fixtures))
    os.environ.update(HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", OMP_NUM_THREADS="4")
    sys.path.insert(0, str(agent))
    from callnote_agent import WhisperTranscriber, read_wav_16k_mono
    from decode_audio_compat import decode_audio_compat, AudioLimitExceeded
    import callnote_agent

    transcriber = WhisperTranscriber(str(model), device="cpu")
    expected = "앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다."
    rows = []
    for suffix in ("wav", "mp3", "m4a"):
        file = fixtures / ("synthetic." + suffix)
        audio = decode_audio_compat(file)
        result = transcriber.transcribe(file, None, "ko")
        assert result["text"] == expected
        rows.append({"format": suffix, "shape": list(audio.shape), "dtype": str(audio.dtype), "result": result})
    stream = io.BytesIO((fixtures / "synthetic.m4a").read_bytes())
    stream_result = transcriber.transcribe(stream, None, "ko")
    assert stream_result["text"] == expected and not stream.closed
    worker_result = transcriber.transcribe(read_wav_16k_mono((fixtures / "synthetic.wav").read_bytes()), None, "ko")
    assert worker_result["text"] == expected
    try:
        decode_audio_compat(fixtures / "synthetic.wav", max_seconds=1)
    except AudioLimitExceeded:
        limited = True
    else:
        raise AssertionError("duration limit did not reject synthetic input")
    print(json.dumps({"syntheticOnly": True, "agentPath": callnote_agent.__file__, "python": sys.executable, "rows": rows, "stream": stream_result, "workerWav": worker_result, "durationLimitRejected": limited}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
