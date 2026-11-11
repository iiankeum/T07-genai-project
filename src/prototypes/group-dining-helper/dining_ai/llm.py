"""생성형 AI 호출. SDK 없이 표준 라이브러리(urllib)로 부른다.

- anthropic : Claude API (ANTHROPIC_API_KEY)
- openai    : OpenAI API (OPENAI_API_KEY)
- ollama    : PC 안에서 돌리는 로컬 모델 (의견이 밖으로 나가지 않음)
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

from .config import Settings


class LLMError(RuntimeError):
    pass


def _post(url: str, payload: dict, headers: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers={"content-type": "application/json", **headers}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:500]
        raise LLMError(f"{url} 호출 실패 ({e.code}): {body}") from e
    except urllib.error.URLError as e:
        raise LLMError(f"{url}에 연결할 수 없습니다: {e.reason}") from e


def chat(system: str, user: str, settings: Settings) -> str:
    p = settings.llm_provider
    if p == "anthropic":
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise LLMError("ANTHROPIC_API_KEY가 없습니다 (.env 확인)")
        data = _post(
            "https://api.anthropic.com/v1/messages",
            {"model": settings.anthropic_model, "max_tokens": 4000, "system": system,
             "messages": [{"role": "user", "content": user}]},
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
        )
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    if p == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise LLMError("OPENAI_API_KEY가 없습니다 (.env 확인)")
        data = _post(
            "https://api.openai.com/v1/chat/completions",
            {"model": settings.openai_model, "response_format": {"type": "json_object"},
             "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
            {"authorization": f"Bearer {key}"},
        )
        return data["choices"][0]["message"]["content"]
    if p == "ollama":
        data = _post(
            settings.ollama_url.rstrip("/") + "/api/chat",
            {"model": settings.ollama_model, "stream": False, "format": "json",
             "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
            {}, timeout=300,
        )
        return data["message"]["content"]
    raise LLMError(f"알 수 없는 LLM_PROVIDER: {p}")


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
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise LLMError(f"AI 응답 JSON 형식 오류: {e}") from e
