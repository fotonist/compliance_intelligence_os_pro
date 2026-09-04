from typing import Dict, Any
import json

from openai import AsyncOpenAI

from app.core.config import settings


def _empty_result(
    *,
    provider: str,
    model: str | None,
    status: str,
    error: str | None = None,
) -> Dict[str, Any]:
    return {
        "summary": [],
        "root_causes": [],
        "warnings": [],
        "actions": [],
        "provider": provider,
        "model": model,
        "status": status,
        "usage": None,
        "error": error,
    }


def _has_real_openai_key() -> bool:
    key = (settings.OPENAI_API_KEY or "").strip()

    if not key:
        return False

    # Development / placeholder values must never trigger an API call.
    placeholder_values = {
        "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "your-openai-api-key",
        "your_openai_api_key",
        "changeme",
    }

    if key.lower() in {value.lower() for value in placeholder_values}:
        return False

    return key.startswith("sk-") and len(key) > 40


async def generate_ai_insight(
    kpis: Dict[str, Any],
    period_days: int,
) -> Dict[str, Any]:

    # ---------------------------------------------------------
    # OPENAI NOT CONFIGURED
    # ---------------------------------------------------------
    if not _has_real_openai_key():
        return _empty_result(
            provider="none",
            model=None,
            status="not_configured",
            error=(
                "External AI is not configured. "
                "Configure a valid OpenAI API key to use this feature."
            ),
        )

    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
    )

    prompt = f"""
Compliance workspace data:

Period:
{period_days} days

Metrics:

{json.dumps(
    kpis,
    indent=2,
    default=str,
)}

Generate executive compliance observations.

Rules:

- Do NOT calculate KPI values.
- Do NOT modify provided metrics.
- Do NOT invent facts.
- ONLY interpret the provided compliance data.
- Use audit-safe, neutral enterprise language.
- Focus on:
  - compliance posture
  - risk exposure
  - evidence maturity
  - remediation effectiveness
  - management attention areas

Return ONLY valid JSON:

{{
  "summary": [],
  "root_causes": [],
  "warnings": [],
  "actions": []
}}
"""

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            temperature=0.2,
            response_format={
                "type": "json_object"
            },
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a compliance intelligence assistant. "
                        "Do not invent data. "
                        "Do not calculate KPIs."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        content = (
            response
            .choices[0]
            .message
            .content
        )

        if not content:
            return _empty_result(
                provider="openai",
                model=settings.AI_MODEL,
                status="error",
                error="OpenAI returned an empty response.",
            )

        result = json.loads(content)

        usage = getattr(response, "usage", None)

        input_tokens = (
            getattr(usage, "prompt_tokens", None)
            if usage
            else None
        )

        output_tokens = (
            getattr(usage, "completion_tokens", None)
            if usage
            else None
        )

        total_tokens = (
            getattr(usage, "total_tokens", None)
            if usage
            else None
        )

        return {
            "summary": result.get("summary", []),
            "root_causes": result.get("root_causes", []),
            "warnings": result.get("warnings", []),
            "actions": result.get("actions", []),
            "provider": "openai",
            "model": settings.AI_MODEL,
            "status": "completed",
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
            },
            "error": None,
        }

    except Exception as exc:
        error_text = str(exc)

        print("AI generation failed:", error_text)

        return _empty_result(
            provider="openai",
            model=settings.AI_MODEL,
            status="error",
            error=error_text,
        )
