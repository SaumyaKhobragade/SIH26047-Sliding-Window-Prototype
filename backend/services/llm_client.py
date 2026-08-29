"""
Shared LLM Client
==================
Thin async wrapper around Groq and Gemini APIs.
Used by summary_generator, aci_engine, prescription_ocr and any service that
needs LLM inference.

Hard-won behaviour encoded here:
  * Reasoning models (gpt-oss, qwen thinking mode) spend `max_tokens` on hidden
    reasoning BEFORE emitting content. A budget of 40 tokens returns an EMPTY
    string, not a short answer. So every request gets a floor (MIN_TOKENS).
  * gpt-oss additionally needs reasoning_effort="low" or it can burn the whole
    budget thinking and still return nothing.
  * An empty completion is a FAILURE, not a valid answer. It used to be
    swallowed silently, which made the whole clinical pipeline degrade to
    canned templates with no visible error. Now it is logged loudly and
    surfaced via `last_error` / `/health`.
"""

import asyncio
import logging
import re
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# Reasoning models emit hidden thinking tokens first. Below this floor they
# return empty content. Verified empirically against Groq (Aug 2026).
MIN_TOKENS = 256

# Models that must be told to keep reasoning short.
_REASONING_MODEL_MARKERS = ("gpt-oss", "o1", "o3", "deepseek-r1", "-thinking")

_THINK_BLOCK = re.compile(r"<think>[\s\S]*?</think>", re.IGNORECASE)

# Cached SDK clients — constructing one per call added ~100ms of TLS setup.
_groq_client = None

# Last transport/config error, exposed through health() so a broken API key or
# a dead model name is visible instead of silently returning empty strings.
_last_error: Optional[str] = None
_call_count = 0
_empty_count = 0


def _is_reasoning_model(model: str) -> bool:
    m = model.lower()
    return any(marker in m for marker in _REASONING_MODEL_MARKERS)


async def llm_complete(
    prompt: str,
    system: str = "",
    max_tokens: int = 512,
    retries: int = 1,
) -> str:
    """
    Call the configured LLM and return the completion text.

    Returns "" only when the model genuinely could not be reached or produced
    nothing after `retries + 1` attempts. Callers treat "" as "degrade to a
    deterministic fallback" — never as clinical content.
    """
    global _last_error, _call_count, _empty_count

    provider = settings.LLM_PROVIDER.lower()
    budget = max(max_tokens, MIN_TOKENS)

    if provider == "groq" and not settings.GROQ_API_KEY:
        _last_error = "GROQ_API_KEY is not set"
        logger.error("[LLM] %s", _last_error)
        return ""
    if provider == "gemini" and not settings.GEMINI_API_KEY:
        _last_error = "GEMINI_API_KEY is not set"
        logger.error("[LLM] %s", _last_error)
        return ""

    attempt = 0
    while attempt <= retries:
        attempt += 1
        _call_count += 1
        try:
            if provider == "groq":
                text = await _groq_complete(prompt, system, budget)
            elif provider == "gemini":
                text = await _gemini_complete(prompt, system, budget)
            else:
                _last_error = f"Unknown LLM_PROVIDER '{provider}'"
                logger.error("[LLM] %s (expected 'groq' or 'gemini')", _last_error)
                return ""

            text = (text or "").strip()
            if text:
                _last_error = None
                return text

            _empty_count += 1
            logger.warning(
                "[LLM] Empty completion from %s/%s (attempt %d/%d, max_tokens=%d). "
                "Reasoning models return empty content when the token budget is "
                "consumed by hidden reasoning.",
                provider, _model_name(), attempt, retries + 1, budget,
            )
            # Give the model more room on the retry.
            budget = min(budget * 2, 2048)

        except Exception as e:
            _last_error = f"{type(e).__name__}: {e}"
            logger.error(
                "[LLM] %s/%s call failed (attempt %d/%d): %s",
                provider, _model_name(), attempt, retries + 1, e,
            )
            if attempt <= retries:
                await asyncio.sleep(0.4 * attempt)

    logger.error(
        "[LLM] Giving up after %d attempts — caller will use its deterministic "
        "fallback. Clinical output will be degraded.", retries + 1,
    )
    return ""


def _model_name() -> str:
    return (
        settings.GROQ_MODEL
        if settings.LLM_PROVIDER.lower() == "groq"
        else settings.GEMINI_MODEL
    )


def health() -> dict:
    """Diagnostics for /health — makes a misconfigured LLM immediately obvious."""
    provider = settings.LLM_PROVIDER.lower()
    key = settings.GROQ_API_KEY if provider == "groq" else settings.GEMINI_API_KEY
    return {
        "provider": provider,
        "model": _model_name(),
        "api_key_present": bool(key),
        "calls": _call_count,
        "empty_responses": _empty_count,
        "last_error": _last_error,
    }


async def _groq_complete(prompt: str, system: str, max_tokens: int) -> str:
    """Call Groq API asynchronously."""

    def _sync_call():
        global _groq_client
        if _groq_client is None:
            from groq import Groq
            _groq_client = Groq(api_key=settings.GROQ_API_KEY, timeout=30.0)

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": settings.GROQ_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0,  # 0 suppresses Qwen thinking-mode preamble
        }
        # Without this, gpt-oss can spend the entire budget on hidden reasoning
        # and return an empty message.
        if _is_reasoning_model(settings.GROQ_MODEL):
            kwargs["reasoning_effort"] = "low"

        resp = _groq_client.chat.completions.create(**kwargs)
        raw = resp.choices[0].message.content or ""
        # Strip Qwen <think>...</think> reasoning block if present.
        return _THINK_BLOCK.sub("", raw).strip()

    return await asyncio.to_thread(_sync_call)


async def _gemini_complete(prompt: str, system: str, max_tokens: int) -> str:
    """Call Gemini API asynchronously."""

    def _sync_call():
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        resp = model.generate_content(
            full_prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.2},
        )
        # resp.text raises if the candidate was blocked — read parts defensively.
        try:
            return resp.text or ""
        except Exception:
            parts = getattr(getattr(resp, "candidates", [None])[0], "content", None)
            if parts and getattr(parts, "parts", None):
                return "".join(getattr(p, "text", "") for p in parts.parts)
            return ""

    return await asyncio.to_thread(_sync_call)
