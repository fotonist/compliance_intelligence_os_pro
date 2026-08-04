# backend/app/seed/tisax_isa06.py

from __future__ import annotations

from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text


TISAX_STANDARD_CODE = "TISAX"
TISAX_STANDARD_PATCH = {
    "title": "TISAX Information Security Assessment",
    "description": "TISAX ISA v6 maturity structure with Assurance Level (AL1/AL2/AL3) criteria variants.",
    "type": "MATURITY_BASED",
    "version": "5.1",
}

# High-level domains / areas (pragmatic grouping for matrix)
PROCESS_AREAS: List[Tuple[str, str, int]] = [
    ("GOV", "Governance", 1),
    ("ORG", "Organization", 2),
    ("HR", "Human Resources Security", 3),
    ("PHY", "Physical & Environmental Security", 4),
    ("OPS", "Operations Security", 5),
    ("ACC", "Access Control", 6),
    ("COM", "Communications & Supplier Security", 7),
    ("INC", "Incident & Continuity", 8),
    ("DEV", "Development Security", 9),
]

# Base criteria; for each one we generate AL1/AL2/AL3 variants
BASE_CRITERIA: List[Dict[str, object]] = [
    {"pa": "GOV", "code": "GOV01", "title": "Information Security Governance", "al1": "Define basic security responsibilities and policies.",
     "al2": "Define and operate an ISMS with periodic management review.",
     "al3": "Operate an ISMS with measurable objectives, continual improvement and independent assurance.",
     "sort": 10},
    {"pa": "ORG", "code": "ORG01", "title": "Asset & Scope Management", "al1": "Identify key assets and basic scope.",
     "al2": "Maintain an asset inventory and scope including interfaces and dependencies.",
     "al3": "Maintain complete asset lifecycle controls with risk-based classification and periodic validation.",
     "sort": 10},
    {"pa": "HR", "code": "HR01", "title": "Awareness & Training", "al1": "Provide basic awareness training for relevant staff.",
     "al2": "Role-based training with records and periodic refresh.",
     "al3": "Competency management with effectiveness measurement and targeted campaigns.",
     "sort": 10},
    {"pa": "PHY", "code": "PHY01", "title": "Physical Security Controls", "al1": "Restrict physical access to critical areas.",
     "al2": "Controlled access with logging and periodic review.",
     "al3": "Defense-in-depth physical controls with monitoring, testing and continuous improvement.",
     "sort": 10},
    {"pa": "OPS", "code": "OPS01", "title": "Operations & Change Management", "al1": "Basic operational procedures and change tracking.",
     "al2": "Formal change management with approvals and segregation of duties where applicable.",
     "al3": "Automated controls, continuous monitoring and post-implementation verification.",
     "sort": 10},
    {"pa": "ACC", "code": "ACC01", "title": "Identity & Access Management", "al1": "Basic access control and least privilege.",
     "al2": "Role-based access with periodic recertification and stronger authentication where needed.",
     "al3": "Privileged access management with continuous monitoring and strong authentication everywhere critical.",
     "sort": 10},
    {"pa": "COM", "code": "COM01", "title": "Supplier Security", "al1": "Define basic supplier security expectations.",
     "al2": "Assess suppliers and include security clauses in agreements.",
     "al3": "Ongoing supplier monitoring with audits, KPIs and ICT supply chain risk management.",
     "sort": 10},
    {"pa": "INC", "code": "INC01", "title": "Incident Management", "al1": "Define a simple incident reporting and handling process.",
     "al2": "Incident response playbooks, roles and post-incident reviews.",
     "al3": "24/7-ready capability, threat-led exercises and continuous improvement with metrics.",
     "sort": 10},
    {"pa": "INC", "code": "INC02", "title": "Business Continuity", "al1": "Basic continuity planning for critical services.",
     "al2": "Tested continuity plans with defined RTO/RPO where applicable.",
     "al3": "Resilience engineering with regular exercises, dependency validation and continuous optimization.",
     "sort": 20},
    {"pa": "DEV", "code": "DEV01", "title": "Secure Development", "al1": "Basic secure development guidance for relevant teams.",
     "al2": "Secure SDLC with reviews and security testing for relevant changes.",
     "al3": "Security by design with threat modeling, automated testing and strong release governance.",
     "sort": 10},
]


def seed_tisax_isa06(db: Session) -> None:
    # 1) Ensure standard exists (TISAX exists in your DB, patch metadata idempotently)
    std = db.execute(
        text("SELECT id FROM standards WHERE code = :code"),
        {"code": TISAX_STANDARD_CODE},
    ).fetchone()

    if not std:
        db.execute(
            text(
                """
                INSERT INTO standards (code, title, description, type, version)
                VALUES (:code, :title, :description, :type, :version)
                """
            ),
            {"code": TISAX_STANDARD_CODE, **TISAX_STANDARD_PATCH},
        )
        std_id = db.execute(
            text("SELECT id FROM standards WHERE code = :code"),
            {"code": TISAX_STANDARD_CODE},
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
            {"id": std_id, **TISAX_STANDARD_PATCH},
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

    # 3) Criteria per AL (level = AL)
    for c in BASE_CRITERIA:
        pa_code = str(c["pa"])
        pa_id = pa_id_by_code[pa_code]
        base_code = str(c["code"])
        base_title = str(c["title"])
        sort_base = int(c["sort"])

        al_variants = [
            (1, str(c["al1"]), sort_base + 1),
            (2, str(c["al2"]), sort_base + 2),
            (3, str(c["al3"]), sort_base + 3),
        ]

        for al_level, al_text, sort_order in al_variants:
            # Keep the same code, distinguish by level (AL)
            exists = db.execute(
                text(
                    """
                    SELECT id FROM standard_practices
                    WHERE standard_id = :standard_id
                      AND process_area_id = :process_area_id
                      AND code = :code
                      AND level = :level
                    """
                ),
                {
                    "standard_id": std_id,
                    "process_area_id": pa_id,
                    "code": base_code,
                    "level": al_level,
                },
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
                        "level": al_level,
                        "code": base_code,
                        "title": base_title,
                        "text": al_text,
                        "sort_order": sort_order,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        UPDATE standard_practices
                        SET title = :title,
                            text = :text,
                            is_active = true,
                            sort_order = :sort_order
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": int(exists[0]),
                        "title": base_title,
                        "text": al_text,
                        "sort_order": sort_order,
                    },
                )

    db.commit()
