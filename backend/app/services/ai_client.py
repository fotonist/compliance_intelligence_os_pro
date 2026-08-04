from typing import Dict, Any
import json

from openai import AsyncOpenAI

from app.core.config import settings

client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY
)


SYSTEM_PROMPT = """
You are a compliance intelligence assistant.

Rules:
- Do NOT calculate KPI values.
- Do NOT modify provided metrics.
- ONLY interpret the provided compliance data.
- Use audit-safe, neutral enterprise language.
- Focus on:
  - compliance posture
  - risk exposure
  - evidence maturity
  - remediation effectiveness
  - management attention areas

Return only valid JSON.
"""


USER_PROMPT_TEMPLATE = """
Compliance workspace snapshot:

Period:
Last {period_days} days


Calculated compliance data:

{kpidata}


Generate executive compliance observations.

Return JSON:

{{
    "summary": [
        "..."
    ],
    "root_causes": [
        "..."
    ],
    "warnings": [
        "..."
    ],
    "actions": [
        "..."
    ]
}}
"""


async def generate_ai_insight(
    kpis: Dict[str, Any],
    period_days: int,
) -> Dict[str, Any]:

    empty_result = {
        "summary": [],
        "root_causes": [],
        "warnings": [],
        "actions": [],
    }


    if not settings.OPENAI_API_KEY:
        return empty_result


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

Return JSON:

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
                        "You are a compliance "
                        "intelligence assistant. "
                        "Do not invent data."
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

            print(
                "AI returned empty response"
            )

            return empty_result


        print(
            "AI RESPONSE:",
            content
        )


        result = json.loads(content)


        return {

            "summary": result.get(
                "summary",
                [],
            ),

            "root_causes": result.get(
                "root_causes",
                [],
            ),

            "warnings": result.get(
                "warnings",
                [],
            ),

            "actions": result.get(
                "actions",
                [],
            ),

        }


    except Exception as exc:

        print(
            "AI generation failed:",
            str(exc),
        )

        return empty_result