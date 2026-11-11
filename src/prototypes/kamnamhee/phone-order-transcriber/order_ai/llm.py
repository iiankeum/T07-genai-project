"""생성형 AI 호출. SDK 없이 표준 라이브러리(urllib)로 부른다.

- anthropic : Claude API (ANTHROPIC_API_KEY)
- openai    : OpenAI API (OPENAI_API_KEY)
- ollama    : PC 안에서 돌리는 로컬 모델 (녹음 글이 밖으로 나가지 않음)

어떤 실패든(키 없음, HTTP 오류, 연결 끊김, 시간 초과, 이상한 응답) LLMError로 바꿔 올려 보낸다.
부르는 쪽은 LLMError를 받으면 규칙 기반으로 대체한다.
"""
from __future__ import annotations

import http.client
import json
import os
import re
import urllib.error
import urllib.request

from .config import Settings


class LLMError(RuntimeError):
    pass


def _timeout(settings: Settings) -> float:
    if settings.llm_timeout:
        return settings.llm_timeout
    return 300 if settings.llm_provider == "ollama" else 120


def _post(url: str, payload: dict, headers: dict, timeout: float) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers={"content-type": "application/json", **headers}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise LLMError(f"{url} 호출 실패 ({e.code}): {detail}") from e
    except urllib.error.URLError as e:
        raise LLMError(f"{url}에 연결할 수 없습니다: {e.reason}") from e
    except TimeoutError as e:  # 응답을 읽는 도중 시간 초과 (socket.timeout)
        raise LLMError(f"{url} 응답 시간 초과 ({timeout:.0f}초)") from e
    except (OSError, http.client.HTTPException) as e:  # 연결 끊김 등
        raise LLMError(f"{url} 통신 오류: {type(e).__name__}: {e}") from e
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise LLMError(f"{url} 응답이 JSON이 아닙니다") from e


def chat(system: str, user: str, settings: Settings) -> str:
    p, timeout = settings.llm_provider, _timeout(settings)
    try:
        if p == "anthropic":
            key = os.getenv("ANTHROPIC_API_KEY")
            if not key:
                raise LLMError("ANTHROPIC_API_KEY가 없습니다 (.env 확인)")
            headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
            if os.getenv("ANTHROPIC_WORKSPACE_ID"):  # 워크스페이스에 묶이지 않은 키일 때 필요
                headers["anthropic-workspace-id"] = os.environ["ANTHROPIC_WORKSPACE_ID"]
            data = _post(
                "https://api.anthropic.com/v1/messages",
                {"model": settings.anthropic_model, "max_tokens": 4000, "system": system,
                 "messages": [{"role": "user", "content": user}]},
                headers, timeout,
            )
            text = "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")
        elif p == "openai":
            key = os.getenv("OPENAI_API_KEY")
            if not key:
                raise LLMError("OPENAI_API_KEY가 없습니다 (.env 확인)")
            data = _post(
                "https://api.openai.com/v1/chat/completions",
                {"model": settings.openai_model, "response_format": {"type": "json_object"},
                 "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
                {"authorization": f"Bearer {key}"}, timeout,
            )
            text = data["choices"][0]["message"]["content"]
        elif p == "ollama":
            data = _post(
                settings.ollama_url.rstrip("/") + "/api/chat",
                {"model": settings.ollama_model, "stream": False, "format": "json", "options": {"temperature": 0},
                 "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
                {}, timeout,
            )
            text = data["message"]["content"]
        else:
            raise LLMError(f"알 수 없는 LLM_PROVIDER: {p}")
    except (KeyError, IndexError, TypeError, AttributeError) as e:
        raise LLMError(f"AI 응답 형식이 예상과 다릅니다 ({type(e).__name__}: {e})") from e
    if not isinstance(text, str) or not text.strip():
        raise LLMError("AI 응답이 비어 있습니다")
    return text


def parse_json(text: str) -> dict:
    """응답에서 JSON 객체를 꺼낸다 (```json 코드블록이나 앞뒤 설명이 붙어도 됨)."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise LLMError("AI 응답에서 JSON을 찾지 못했습니다")
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise LLMError(f"AI 응답 JSON 형식 오류: {e}") from e
    if not isinstance(data, dict):
        raise LLMError("AI 응답이 JSON 객체가 아닙니다")
    return data
