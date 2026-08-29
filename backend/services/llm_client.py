"""
Shared LLM Client
==================
Thin async wrapper around Groq and Gemini APIs.
Used by summary_generator and any service that needs LLM inference.
"""

import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


async def llm_complete(prompt: str, system: str = "", max_tokens: int = 512) -> str:
    """
    Call the configured LLM (Groq or Gemini) and return the completion text.
    Falls back to empty string on any error so callers can degrade gracefully.
    """
    provider = settings.LLM_PROVIDER.lower()

    try:
        if provider == "groq":
            return await _groq_complete(prompt, system, max_tokens)
        elif provider == "gemini":
            return await _gemini_complete(prompt, system, max_tokens)
        else:
            logger.warning("[LLM] Unknown provider '%s'. Returning empty.", provider)
            return ""
    except Exception as e:
        logger.error("[LLM] %s call failed: %s", provider, e)
        return ""


async def _groq_complete(prompt: str, system: str, max_tokens: int) -> str:
    """Call Groq API asynchronously."""
    import asyncio
    import re

    def _sync_call():
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0,   # 0 suppresses Qwen thinking-mode preamble
        )
        raw = resp.choices[0].message.content or ""
        # Strip Qwen <think>...</think> reasoning block if present
        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip()
        return raw

    return await asyncio.to_thread(_sync_call)


async def _gemini_complete(prompt: str, system: str, max_tokens: int) -> str:
    """Call Gemini API asynchronously."""
    import asyncio

    def _sync_call():
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        resp = model.generate_content(
            full_prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.2},
        )
        return resp.text or ""

    return await asyncio.to_thread(_sync_call)
