from typing import Dict, Any
import openai
import os

openai.api_key = os.getenv("OPENAI_API_KEY")

SYSTEM_PROMPT = """
You are a compliance analytics assistant.

Rules:
- Do NOT calculate numbers.
- Do NOT change KPI values.
- ONLY interpret given data.
- Use audit-safe, neutral language.
- Focus on trends, correlations, and risks.
"""

USER_PROMPT_TEMPLATE = """
Dashboard period: last {period_days} days

KPI snapshot (already calculated):
{kpidata}

Tasks:
1. Summarize overall compliance situation.
2. Identify possible root causes for negative trends.
3. Highlight risks or SLA breach signals.
4. Suggest high-level corrective actions.

Output JSON with fields:
summary, root_causes, warnings, actions
"""

async def generate_ai_insight(kpis: Dict[str, Any], period_days: int):
    prompt = USER_PROMPT_TEMPLATE.format(
        period_days=period_days,
        kpidata=kpis
    )

    response = openai.ChatCompletion.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message["content"]

    # OpenAI JSON output assumed – safe parse
    return eval(content)
