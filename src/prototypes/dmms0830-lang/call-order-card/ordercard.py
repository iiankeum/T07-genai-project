"""통화 녹음 → 받아쓰기 → 주문 카드 (프로토타입).

    python ordercard.py samples/phone            # 폴더 안 녹음을 모두 처리
    python ordercard.py 통화1.m4a 통화2.wav       # 파일을 골라서 처리

결과는 out/cards.json 과 out/cards.html(카드 화면)로 나온다.

1. 받아쓰기: faster-whisper 를 이 PC 안에서 돌린다. 녹음이 밖으로 나가지 않는다.
2. 주문 카드: 받아쓴 글만 생성형 AI(Claude)에 보내 주문 내용을 뽑는다.
   AI 는 초안까지만 만든다. 품번을 지어내지 않고, 모르는 것은 "다시 물어볼 것"에 적는다.
"""
import argparse
import html
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).parent
GLOSSARY = HERE / "data" / "glossary.txt"
CUSTOMERS = HERE / "data" / "customers.txt"
CAR_MODELS = HERE / "data" / "car_models.txt"
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".amr", ".3gp", ".flac", ".wma", ".mp4"}
LLM_MODEL = os.environ.get("ORDER_CARD_MODEL", "claude-opus-5-5")


# ───────────────────────── 낱말 사전 ─────────────────────────

def load_glossary() -> list[tuple[str, str]]:
    pairs = []
    for line in GLOSSARY.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            field, standard = (s.strip() for s in line.split("=", 1))
            pairs.append((field, standard))
    return pairs


def load_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    lines = (line.strip() for line in path.read_text(encoding="utf-8").splitlines())
    return [line for line in lines if line and not line.startswith("#")]


# ───────────────────────── 1. 받아쓰기 ─────────────────────────

_model = None
_device = None


def _add_cuda_dlls() -> None:
    """pip 로 깐 NVIDIA 라이브러리(cuBLAS·cuDNN)를 윈도우가 찾을 수 있게 한다."""
    for pkg in ("nvidia.cublas", "nvidia.cudnn", "nvidia.cuda_nvrtc"):
        try:
            spec = importlib.util.find_spec(pkg)
        except ModuleNotFoundError:
            continue
        if spec and spec.submodule_search_locations:
            bin_dir = Path(list(spec.submodule_search_locations)[0]) / "bin"
            if bin_dir.is_dir():
                os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ["PATH"]


def get_model(name: str = "large-v3"):
    """그래픽카드가 있으면 쓰고, 안 되면 CPU 로 돌린다."""
    global _model, _device
    if _model is None:
        import numpy as np
        from faster_whisper import WhisperModel

        _add_cuda_dlls()
        try:
            if os.environ.get("ORDER_CARD_DEVICE", "").lower() == "cpu":
                raise RuntimeError("ORDER_CARD_DEVICE=cpu 로 지정함")
            model = WhisperModel(name, device="cuda", compute_type="float16")
            segments, _ = model.transcribe(np.zeros(16000, dtype=np.float32), language="ko")
            list(segments)  # 실제로 한 번 돌려 봐야 GPU 가 되는지 안다
            _model, _device = model, "GPU"
        except Exception as e:  # noqa: BLE001
            print(f"[알림] 그래픽카드를 못 써서 CPU 로 돌립니다 ({type(e).__name__}: {e})", file=sys.stderr)
            _model, _device = WhisperModel(name, device="cpu", compute_type="int8"), "CPU"
    return _model


def load_audio(path: Path):
    """ffmpeg 로 어떤 녹음 형식(m4a·amr·3gp·mp3·wav)이든 16kHz 모노로 읽는다."""
    import numpy as np

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg 를 찾지 못했다. ffmpeg 를 설치한 뒤 다시 실행한다.")
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe(path: Path, use_glossary: bool = True, model_name: str = "large-v3") -> dict:
    model = get_model(model_name)
    audio = load_audio(path)
    prompt = None
    if use_glossary:
        words = ", ".join(field for field, _ in load_glossary())
        prompt = f"자동차 부품 대리점 주문 전화입니다. {words}."
    started = time.time()
    segments, info = model.transcribe(
        audio, language="ko", beam_size=5, vad_filter=True,
        initial_prompt=prompt, condition_on_previous_text=False,
    )
    # 녹음이 끝난 자리에서 시작하는 구간은 버린다. Whisper 가 소리 없는 꼬리에서
    # "자막 제공 ○○○" 같은 없는 말을 지어내는 일이 있다.
    end_of_audio = len(audio) / 16000 - 0.3
    segs = [
        {"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()}
        for s in segments if s.start < end_of_audio
    ]
    return {
        "text": " ".join(s["text"] for s in segs),
        "segments": segs,
        "audio_sec": round(info.duration, 1),
        "stt_sec": round(time.time() - started, 1),
        "device": _device,
    }


# ───────────────────────── 2. 주문 카드 ─────────────────────────

NULLABLE_STR = {"type": ["string", "null"]}
CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "customer": NULLABLE_STR,
        "car_model": NULLABLE_STR,
        "model_year": NULLABLE_STR,
        "plate": NULLABLE_STR,
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "part": {"type": "string"},
                    "qty": {"type": ["integer", "null"]},
                    "part_no": NULLABLE_STR,
                },
                "required": ["part", "qty", "part_no"],
                "additionalProperties": False,
            },
        },
        "urgent": {"type": "boolean"},
        "due": NULLABLE_STR,
        "ask_back": {"type": "array", "items": {"type": "string"}},
        "unsure": {"type": "array", "items": {"type": "string"}},
        "fixes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"heard": {"type": "string"}, "fixed": {"type": "string"}},
                "required": ["heard", "fixed"],
                "additionalProperties": False,
            },
        },
        "note": NULLABLE_STR,
    },
    "required": ["customer", "car_model", "model_year", "plate", "items", "urgent", "due", "ask_back", "unsure", "fixes", "note"],
    "additionalProperties": False,
}

SYSTEM = """너는 자동차 부품 대리점의 주문 전화를 받아쓴 글에서 주문 내용을 뽑아 "주문 카드" 초안을 만든다.
받아쓴 글은 음성 인식 결과라서 틀린 글자가 있고, 대리점 직원과 정비소 직원의 말이 구분 없이 한 줄로 섞여 있다.
카드는 대리점 담당자가 보고 고치거나 확정한다. 그래서 틀린 내용을 그럴듯하게 채우는 것보다 비워 두고 물어보게 하는 편이 낫다.

규칙
- 통화에서 말한 것만 적는다. 말하지 않은 항목은 null 로 둔다. 짐작으로 채우지 않는다.
- customer: 전화를 건 거래처(정비소·공업사·카센터)가 통화 첫머리에 밝힌 상호. "우리공업사"처럼 흔한 낱말로 된 상호도 그대로 적는다.
- car_model: 차종과 세대 코드. 한글로 읽은 영문은 영문으로 바꾼다(에이디 → AD, 디엔에잇 → DN8).
- model_year: 네 자리 연도(십칠 년식 → 2017).
- plate: 차량 번호. 한글로 읽은 숫자를 숫자로 바꾼다(삼십사 나 오육칠팔 → 34나5678).
- items: 주문한 부품마다 한 줄.
  - part: 통화에서 쓴 말 그대로 적는다. 현장 말이면 괄호 안에 표준 말을 붙인다. 위치(운전석·앞·좌우)도 part 에 넣는다.
  - qty: 숫자. 수량을 고쳐 말했으면 마지막에 한 말을 따른다.
  - part_no: 통화에서 품번을 불러 준 경우에만 적는다. 한글로 읽은 숫자·영문을 바꾸고 "다시"는 "-" 로 적는다(오팔일공일 다시 디사에이이오 → 58101-D4A25). 품번을 스스로 지어내거나 기억에서 찾아 채우지 않는다.
- urgent: 급하다는 뜻(급해요, 빨리, 퀵, 오늘 꼭)이 있으면 true.
- due: 언제까지 달라고 했는지 통화에서 말한 그대로. 없으면 null.
- ask_back: 통화에서 한쪽이 물었는데 답이 정해지지 않고 끝난 것, 정비소가 "확인하고 다시 연락하겠다"고 한 것만 적는다(예: 운전석인지 조수석인지, LED 인지 일반인지). 통화 안에서 이미 답이 나온 것은 적지 않는다. 통화에서 아무도 묻지 않은 사양(트림·엔진·센서 유무 등)을 네가 궁금해서 보태지 않는다. 그런 것은 품번을 정하는 담당자가 판단한다. 없으면 빈 배열.
- unsure: 음성 인식이 글자를 틀리게 받아썼을 수 있어서 카드에 적은 값이 틀렸을지 모르는 항목만 적는다(예: 차량 번호의 한글이 빠짐, 품번 자릿수가 보통과 다름, 거래처 이름이 목록의 두 곳과 비슷함). 담당자가 녹음의 그 대목을 다시 들어 보라는 표시다. 차량 번호는 형식이 맞지 않으면 null 로 두고, 품번은 받아쓴 대로 적은 뒤, 여기에 이유를 한 줄로 적는다. 네가 확신을 갖고 고쳐 읽은 것은 fixes 에만 적는다. 통화에서 말하지 않은 사양이나 네 해석 설명은 여기에 적지 않는다. 없으면 빈 배열.
- fixes: 음성 인식이 틀렸다고 보고 네가 고쳐 읽은 낱말. 없으면 빈 배열.
- note: 담당자가 꼭 알아야 할 그 밖의 내용만 짧게 한 줄. 없으면 null."""


def _system_prompt(use_glossary: bool, use_customers: bool) -> str:
    prompt = SYSTEM
    if use_glossary:
        lines = "\n".join(f"- {field} = {standard}" for field, standard in load_glossary())
        prompt += "\n\n현장에서 쓰는 말(받아쓴 글에 비슷하게 틀린 낱말이 있으면 이 낱말로 고쳐 읽는다)\n" + lines
        cars = load_lines(CAR_MODELS)
        if cars:
            prompt += "\n\n차종 목록(받아쓴 차종이 이 중 하나와 소리가 같으면 이 표기로 적는다)\n" + ", ".join(cars)
    customers = load_lines(CUSTOMERS) if use_customers else []
    if customers:
        prompt += (
            "\n\n거래처 목록(받아쓴 상호가 이 중 한 곳과 소리가 같으면 그 표기로 적는다. "
            "비슷한 곳이 둘 이상이라 고를 수 없으면 받아쓴 대로 적고 unsure 에 적는다. "
            "목록에 없는 곳이면 받아쓴 대로 적는다)\n" + ", ".join(customers)
        )
    return prompt


def extract(transcript: str, use_glossary: bool = True, use_customers: bool = True) -> dict:
    """받아쓴 글 → 주문 카드. Claude Code CLI(`claude -p`)를 부른다.

    --safe-mode: 이 PC 의 CLAUDE.md·플러그인·MCP 를 읽지 않게 한다.
    --tools "": 도구 없이 글만 읽고 답하게 한다.
    """
    claude = shutil.which("claude")
    if not claude:
        raise RuntimeError("claude 명령을 찾지 못했다. Claude Code 를 설치하고 로그인한 뒤 다시 실행한다.")
    cmd = [
        claude, "-p", "--safe-mode", "--model", LLM_MODEL, "--effort", "low",
        "--tools", "", "--no-session-persistence", "--output-format", "json",
        "--system-prompt", _system_prompt(use_glossary, use_customers),
        "--json-schema", json.dumps(CARD_SCHEMA, ensure_ascii=False),
    ]
    last_error = ""
    for _ in range(3):
        r = subprocess.run(
            cmd, input=f"받아쓴 통화:\n{transcript}", capture_output=True,
            text=True, encoding="utf-8", cwd=tempfile.gettempdir(), timeout=300,
        )
        try:
            card = json.loads(r.stdout).get("structured_output")
        except json.JSONDecodeError:
            card = None
        if card:
            return card
        last_error = (r.stderr or r.stdout)[-400:]
        time.sleep(2)
    raise RuntimeError(f"주문 카드를 만들지 못했다: {last_error}")


def process(paths: list[Path], use_glossary: bool = True, use_customers: bool = True,
            model_name: str = "large-v3") -> list[dict]:
    """받아쓰기는 한 건씩(그래픽카드 하나), 카드 뽑기는 여러 건을 한꺼번에."""
    results = []
    for p in paths:
        t = transcribe(p, use_glossary, model_name)
        print(f"  받아씀 {p.name}  {t['audio_sec']}초 → {t['stt_sec']}초 ({t['device']})", flush=True)
        results.append({"file": p.name, "path": str(p), **t})
    with ThreadPoolExecutor(max_workers=5) as pool:
        cards = list(pool.map(lambda r: extract(r["text"], use_glossary, use_customers), results))
    for r, card in zip(results, cards):
        r["card"] = card
    return results


# ───────────────────────── 3. 카드 화면 ─────────────────────────

PAGE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>주문 카드</title>
<style>
:root{--bg:#f4f5f7;--card:#fff;--ink:#1c2430;--sub:#5d6978;--line:#dde2e8;--accent:#1f6feb;--urgent:#c62828;--urgent-bg:#fdecea;--ask:#8a5a00;--ask-bg:#fff4d6;--ok:#1b7f3b;--ok-bg:#e6f4ea}
@media (prefers-color-scheme:dark){:root{--bg:#12161c;--card:#1b222b;--ink:#e8edf3;--sub:#9aa7b6;--line:#2c3643;--accent:#6aa5ff;--urgent:#ff8a80;--urgent-bg:#3a1f1f;--ask:#ffcf6b;--ask-bg:#3a3018;--ok:#7bd88f;--ok-bg:#1c3324}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 "Malgun Gothic","Apple SD Gothic Neo",sans-serif}
main{max-width:1080px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}.lead{color:var(--sub);margin:0 0 18px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.stat b{display:block;font-size:24px;line-height:1.2}.stat span{color:var(--sub);font-size:13px}
.callback{background:var(--ask-bg);color:var(--ask);border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}
.card.done{border-color:var(--ok);box-shadow:inset 0 0 0 1px var(--ok)}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.cust{font-size:18px;font-weight:700}.file{color:var(--sub);font-size:12px}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap}
.b-urgent{background:var(--urgent-bg);color:var(--urgent)}.b-unsure{border:1px dashed var(--urgent);color:var(--urgent)}.b-ask{background:var(--ask-bg);color:var(--ask)}.b-done{background:var(--ok-bg);color:var(--ok)}
.car{color:var(--sub);font-size:14px}.car b{color:var(--ink);font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}
th{color:var(--sub);font-weight:500;font-size:12px}td.qty{width:52px;font-weight:700;font-variant-numeric:tabular-nums}td.no{width:124px;font-family:Consolas,monospace;font-size:13px}
.empty{color:var(--sub)}
.ask{background:var(--ask-bg);color:var(--ask);border-radius:8px;padding:8px 10px;font-size:13px}.ask ul{margin:4px 0 0;padding-left:18px}
.unsure{border:1px dashed var(--urgent);color:var(--urgent);border-radius:8px;padding:8px 10px;font-size:13px}.unsure ul{margin:4px 0 0;padding-left:18px}
.meta{color:var(--sub);font-size:13px}
[contenteditable]{outline:none;border-radius:4px}[contenteditable]:hover{background:rgba(127,127,127,.12)}[contenteditable]:focus{background:rgba(31,111,235,.14)}
details{font-size:13px;color:var(--sub)}details p{margin:6px 0 0;color:var(--ink);line-height:1.7}summary{cursor:pointer}
audio{width:100%;height:34px}
button{font:inherit;font-weight:700;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;padding:7px 12px;cursor:pointer}
.card.done button{background:transparent;color:var(--accent)}
.foot{margin-top:28px;color:var(--sub);font-size:13px}
</style></head><body><main>
<h1>오늘 주문 카드</h1>
<p class="lead">통화 녹음을 AI 가 받아써서 만든 초안입니다. 글자를 눌러 고친 뒤 「확정」을 누릅니다. 품번은 사람이 정합니다.</p>
__SUMMARY__
<div class="grid">__CARDS__</div>
<p class="foot">프로토타입 화면입니다. 고친 내용과 확정 표시는 저장되지 않습니다.</p>
</main>
<script>
document.querySelectorAll('.card button').forEach(b=>b.addEventListener('click',()=>{
  const c=b.closest('.card');const done=c.classList.toggle('done');
  b.textContent=done?'확정 취소':'확정';c.querySelector('.b-done').hidden=!done;
  const n=document.querySelectorAll('.card.done').length,t=document.querySelectorAll('.card').length;
  document.getElementById('left').textContent=t-n;
}));
</script></body></html>"""


def _e(value) -> str:
    return html.escape("" if value is None else str(value))


def render_html(results: list[dict], out_path: Path) -> None:
    cards_html = []
    callbacks = []
    for r in results:
        c = r["card"]
        if c["ask_back"]:
            callbacks.append(c["customer"] or r["file"])
        rows = "".join(
            f'<tr><td contenteditable>{_e(i["part"])}</td>'
            f'<td class="qty" contenteditable>{_e(i["qty"]) or "?"}</td>'
            f'<td class="no" contenteditable>{_e(i["part_no"]) or "<span class=empty>사람이 정함</span>"}</td></tr>'
            for i in c["items"]
        ) or '<tr><td colspan="3" class="empty">주문 품목을 찾지 못했습니다</td></tr>'
        car = " · ".join(
            f"<b contenteditable>{_e(v)}</b>" for v in (
                c["car_model"],
                f'{c["model_year"]}년식' if c["model_year"] else None,
                c["plate"],
            ) if v
        ) or '<span class="empty">차 정보 없음</span>'
        ask = ""
        if c["ask_back"]:
            ask = '<div class="ask"><b>다시 물어볼 것</b><ul>' + "".join(f"<li>{_e(a)}</li>" for a in c["ask_back"]) + "</ul></div>"
        unsure = ""
        if c["unsure"]:
            unsure = (
                '<div class="unsure"><b>받아쓰기가 의심스러운 곳</b> — 녹음을 들어 확인<ul>'
                + "".join(f"<li>{_e(u)}</li>" for u in c["unsure"]) + "</ul></div>"
            )
        fixes = ""
        if c["fixes"]:
            fixes = '<div class="meta">AI 가 고쳐 읽음: ' + ", ".join(f'{_e(f["heard"])} → {_e(f["fixed"])}' for f in c["fixes"]) + "</div>"
        extra = " · ".join(_e(v) for v in (c["due"], c["note"]) if v)
        try:
            audio = quote(os.path.relpath(Path(r["path"]).resolve(), out_path.parent.resolve()).replace(os.sep, "/"))
        except ValueError:  # 녹음이 다른 드라이브에 있을 때
            audio = Path(r["path"]).resolve().as_uri()
        cards_html.append(
            '<section class="card"><div class="top"><div>'
            f'<div class="cust" contenteditable>{_e(c["customer"]) or "거래처 모름"}</div>'
            f'<div class="file">{_e(r["file"])} · {r["audio_sec"]}초</div></div><div class="badges">'
            + ('<span class="badge b-urgent">급함</span>' if c["urgent"] else "")
            + ('<span class="badge b-ask">되물을 것</span>' if c["ask_back"] else "")
            + ('<span class="badge b-unsure">들어 보기</span>' if c["unsure"] else "")
            + '<span class="badge b-done" hidden>확정</span></div></div>'
            f'<div class="car">{car}</div>'
            f"<table><tr><th>부품</th><th>수량</th><th>품번</th></tr>{rows}</table>"
            + (f'<div class="meta">{extra}</div>' if extra else "")
            + ask + unsure + fixes
            + f'<audio controls preload="none" src="{_e(audio)}"></audio>'
            f'<details><summary>받아쓴 글 보기</summary><p>{_e(r["text"])}</p></details>'
            "<div><button>확정</button></div></section>"
        )
    total = len(results)
    urgent = sum(1 for r in results if r["card"]["urgent"])
    items = sum(len(r["card"]["items"]) for r in results)
    summary = (
        '<div class="summary">'
        f'<div class="stat"><b>{total}</b><span>오늘 주문 통화</span></div>'
        f'<div class="stat"><b>{items}</b><span>주문 품목</span></div>'
        f'<div class="stat"><b>{urgent}</b><span>급한 주문</span></div>'
        f'<div class="stat"><b id="left">{total}</b><span>아직 확정 안 한 카드</span></div>'
        f'<div class="stat"><b>{len(callbacks)}</b><span>다시 전화할 곳</span></div></div>'
    )
    if callbacks:
        summary += '<div class="callback"><b>다시 전화할 곳</b> — ' + ", ".join(_e(n) for n in callbacks) + "</div>"
    out_path.write_text(PAGE.replace("__SUMMARY__", summary).replace("__CARDS__", "".join(cards_html)), encoding="utf-8")


# ───────────────────────── 실행 ─────────────────────────

def collect(inputs: list[str]) -> list[Path]:
    paths = []
    for item in inputs:
        p = Path(item)
        if p.is_dir():
            paths += sorted(f for f in p.iterdir() if f.suffix.lower() in AUDIO_EXT)
        elif p.is_file():
            paths.append(p)
        else:
            print(f"[알림] 찾을 수 없음: {item}", file=sys.stderr)
    return paths


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="통화 녹음 → 주문 카드")
    ap.add_argument("inputs", nargs="+", help="녹음 파일 또는 녹음이 든 폴더")
    ap.add_argument("--out", default=str(HERE / "out"), help="결과를 둘 폴더 (기본: out)")
    ap.add_argument("--no-glossary", action="store_true", help="낱말 사전·차종 목록을 쓰지 않는다")
    ap.add_argument("--no-customers", action="store_true", help="거래처 목록을 쓰지 않는다")
    ap.add_argument("--whisper", default="large-v3", help="음성 인식 모델 이름 (기본: large-v3)")
    args = ap.parse_args()

    paths = collect(args.inputs)
    if not paths:
        sys.exit("처리할 녹음 파일이 없다.")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    print(f"녹음 {len(paths)}건 처리 시작", flush=True)
    results = process(paths, use_glossary=not args.no_glossary, use_customers=not args.no_customers,
                      model_name=args.whisper)
    (out / "cards.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    render_html(results, out / "cards.html")
    print(f"끝. 카드 화면: {out / 'cards.html'}")


if __name__ == "__main__":
    main()
