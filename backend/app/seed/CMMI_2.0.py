# backend/app/seed/CMMI_2.0.py

from __future__ import annotations

from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text


CMMI_STANDARD_CODE = "CMMI"
CMMI_STANDARD_PATCH = {
    "title": "Capability Maturity Model Integration",
    "description": "CMMI-DEV v2.0 seeded maturity structure: core Process Areas and Practices (minimal viable).",
    "type": "MATURITY_BASED",
    "version": "2.0",
}

# Core (minimum viable) process areas for demo/PoC
PROCESS_AREAS: List[Tuple[str, str, int]] = [
    ("ENG", "Engineering", 1),
    ("SUP", "Support", 2),
    ("MAN", "Management", 3),
    ("PLAN", "Planning", 4),
]

# Practices (minimal but meaningful set)
# NOTE: level column is kept as 1 for now (capability mapping will come later).
PRACTICES: List[Dict[str, object]] = [
    # ENG
    {"pa": "ENG", "code": "ENG01", "title": "Requirements Development", "text": "Develop and analyze requirements.", "level": 1, "sort": 10},
    {"pa": "ENG", "code": "ENG02", "title": "Technical Solution", "text": "Design and implement solutions.", "level": 1, "sort": 20},
    {"pa": "ENG", "code": "ENG03", "title": "Verification & Validation", "text": "Verify and validate work products.", "level": 1, "sort": 30},

    # SUP
    {"pa": "SUP", "code": "SUP01", "title": "Configuration Management", "text": "Manage configuration items and baselines.", "level": 1, "sort": 10},
    {"pa": "SUP", "code": "SUP02", "title": "Process & Product Quality Assurance", "text": "Provide assurance of process and product quality.", "level": 1, "sort": 20},

    # MAN
    {"pa": "MAN", "code": "MAN01", "title": "Project Management", "text": "Plan, monitor and control project activities.", "level": 1, "sort": 10},
    {"pa": "MAN", "code": "MAN02", "title": "Risk Management", "text": "Identify, analyze and mitigate risks.", "level": 1, "sort": 20},

    # PLAN
    {"pa": "PLAN", "code": "PLAN01", "title": "Project Planning", "text": "Establish and maintain project plans.", "level": 1, "sort": 10},
]


def seed_cmmi_2_0(db: Session) -> None:
    # 1) Ensure standard exists (CMMI is already in your DB, we patch metadata idempotently)
    std = db.execute(
        text("SELECT id FROM standards WHERE code = :code"),
        {"code": CMMI_STANDARD_CODE},
    ).fetchone()

    if not std:
        db.execute(
            text(
                """
                INSERT INTO standards (code, title, description, type, version)
                VALUES (:code, :title, :description, :type, :version)
                """
            ),
            {"code": CMMI_STANDARD_CODE, **CMMI_STANDARD_PATCH},
        )
        std_id = db.execute(
            text("SELECT id FROM standards WHERE code = :code"),
            {"code": CMMI_STANDARD_CODE},
        ).fetchone()[0]
    else:
        std_id = std[0]
        db.execute(
            text(
                """
                UPDATE standards
                SET title = :title,
                    description = :description,
                    type = :type,
                    version = :version
                WHERE id = :id
                """
            ),
            {"id": std_id, **CMMI_STANDARD_PATCH},
        )

    # 2) Process areas
    pa_id_by_code: Dict[str, int] = {}
    for code, name, sort_order in PROCESS_AREAS:
        row = db.execute(
            text(
                """
                SELECT id FROM standard_process_areas
                WHERE standard_id = :standard_id AND code = :code
                """
            ),
            {"standard_id": std_id, "code": code},
        ).fetchone()

        if not row:
            db.execute(
                text(
                    """
                    INSERT INTO standard_process_areas (standard_id, code, name, sort_order)
                    VALUES (:standard_id, :code, :name, :sort_order)
                    """
                ),
                {"standard_id": std_id, "code": code, "name": name, "sort_order": sort_order},
            )
            row = db.execute(
                text(
                    """
                    SELECT id FROM standard_process_areas
                    WHERE standard_id = :standard_id AND code = :code
                    """
                ),
                {"standard_id": std_id, "code": code},
            ).fetchone()

        pa_id_by_code[code] = int(row[0])

    # 3) Practices
    for p in PRACTICES:
        pa_code = str(p["pa"])
        pa_id = pa_id_by_code[pa_code]

        exists = db.execute(
            text(
                """
                SELECT id FROM standard_practices
                WHERE standard_id = :standard_id AND process_area_id = :process_area_id AND code = :code
                """
            ),
            {"standard_id": std_id, "process_area_id": pa_id, "code": p["code"]},
        ).fetchone()

        if not exists:
            db.execute(
                text(
                    """
                    INSERT INTO standard_practices
                      (standard_id, process_area_id, level, code, title, text, is_active, sort_order)
                    VALUES
                      (:standard_id, :process_area_id, :level, :code, :title, :text, true, :sort_order)
                    """
                ),
                {
                    "standard_id": std_id,
                    "process_area_id": pa_id,
                    "level": int(p["level"]),
                    "code": str(p["code"]),
                    "title": str(p["title"]),
                    "text": str(p["text"]),
                    "sort_order": int(p["sort"]),
                },
            )
        else:
            # patch titles/text if changed
            db.execute(
                text(
                    """
                    UPDATE standard_practices
                    SET title = :title,
                        text = :text,
                        level = :level,
                        is_active = true,
                        sort_order = :sort_order
                    WHERE id = :id
                    """
                ),
                {
                    "id": int(exists[0]),
                    "title": str(p["title"]),
                    "text": str(p["text"]),
                    "level": int(p["level"]),
                    "sort_order": int(p["sort"]),
                },
            )

    db.commit()
