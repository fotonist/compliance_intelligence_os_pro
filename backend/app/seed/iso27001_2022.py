\
"""ISO/IEC 27001:2022 seed data (Standard + Clauses + Annex A controls as Requirements + default Controls).

Model mapping (based on your current schema):
- Standard  -> standards
- Clause    -> clauses (includes ISO Clauses 4-10 + a pseudo-clause 'A' for Annex A)
- Requirement -> requirements (stores Annex A control identifiers A.5.1 ... A.8.34)
- Control   -> controls (at least 1 default control record per Requirement)

Sources (control identifiers + titles):
- Advisera: ISO 27001 Annex A: The Comprehensive Guide to 93 Controls
  https://advisera.com/iso27001/annex-a-controls/
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Tuple

from sqlalchemy.orm import Session

# IMPORTANT: Keep these imports aligned with your project structure.
# Based on the files you provided, your model modules are:
# - app/models/standards.py    -> Standard
# - app/models/clauses.py      -> Clause
# - app/models/requirements.py -> Requirement
# - app/models/controls.py     -> Control
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control


@dataclass(frozen=True)
class _ReqSeed:
    code: str
    title: str
    theme: str  # A.5 / A.6 / A.7 / A.8


ISO27001_2022_STANDARD = {
    "code": "ISO27001:2022",
    "title": "ISO/IEC 27001:2022 Information security, cybersecurity and privacy protection — Information security management systems — Requirements",
    "description": "Seeded reference data: Clauses 4–10 and Annex A controls (A.5–A.8) mapped into Requirements with default implementation Controls.",
}

ISO27001_2022_CLAUSES: List[Dict[str, str]] = [
    {"code": "4", "title": "Context of the organization", "description": ""},
    {"code": "5", "title": "Leadership", "description": ""},
    {"code": "6", "title": "Planning", "description": ""},
    {"code": "7", "title": "Support", "description": ""},
    {"code": "8", "title": "Operation", "description": ""},
    {"code": "9", "title": "Performance evaluation", "description": ""},
    {"code": "10", "title": "Improvement", "description": ""},
    # Pseudo clause for Annex A controls so they can be attached to a Clause cleanly.
    {"code": "A", "title": "Annex A controls", "description": "ISO/IEC 27001:2022 Annex A (A.5–A.8) control catalog."},
]

# Annex A control list (93 controls) with identifiers and titles.
# Note: In your schema, these are inserted as Requirement(code=..., title=...).
ISO27001_2022_ANNEX_A_REQUIREMENTS: List[_ReqSeed] = [
    # A.5 Organizational controls (37)
    _ReqSeed("A.5.1", "Policies for information security", "A.5"),
    _ReqSeed("A.5.2", "Information security roles and responsibilities", "A.5"),
    _ReqSeed("A.5.3", "Segregation of duties", "A.5"),
    _ReqSeed("A.5.4", "Management responsibilities", "A.5"),
    _ReqSeed("A.5.5", "Contact with authorities", "A.5"),
    _ReqSeed("A.5.6", "Contact with special interest groups", "A.5"),
    _ReqSeed("A.5.7", "Threat intelligence", "A.5"),
    _ReqSeed("A.5.8", "Information security in project management", "A.5"),
    _ReqSeed("A.5.9", "Inventory of information and other associated assets", "A.5"),
    _ReqSeed("A.5.10", "Acceptable use of information and other associated assets", "A.5"),
    _ReqSeed("A.5.11", "Return of assets", "A.5"),
    _ReqSeed("A.5.12", "Classification of information", "A.5"),
    _ReqSeed("A.5.13", "Labelling of information", "A.5"),
    _ReqSeed("A.5.14", "Information transfer", "A.5"),
    _ReqSeed("A.5.15", "Access control", "A.5"),
    _ReqSeed("A.5.16", "Identity management", "A.5"),
    _ReqSeed("A.5.17", "Authentication information", "A.5"),
    _ReqSeed("A.5.18", "Access rights", "A.5"),
    _ReqSeed("A.5.19", "Information security in supplier relationships", "A.5"),
    _ReqSeed("A.5.20", "Addressing information security within supplier agreements", "A.5"),
    _ReqSeed("A.5.21", "Managing information security in the ICT supply chain", "A.5"),
    _ReqSeed("A.5.22", "Monitoring, review and change management of supplier service", "A.5"),
    _ReqSeed("A.5.23", "Information security for use of cloud services", "A.5"),
    _ReqSeed("A.5.24", "Information security incident management planning and preparation", "A.5"),
    _ReqSeed("A.5.25", "Assessment and decision on information security events", "A.5"),
    _ReqSeed("A.5.26", "Response to information security incidents", "A.5"),
    _ReqSeed("A.5.27", "Learning from information security incidents", "A.5"),
    _ReqSeed("A.5.28", "Collection of evidence", "A.5"),
    _ReqSeed("A.5.29", "Information security during disruption", "A.5"),
    _ReqSeed("A.5.30", "ICT readiness for business continuity", "A.5"),
    _ReqSeed("A.5.31", "Legal, statutory, regulatory and contractual requirements", "A.5"),
    _ReqSeed("A.5.32", "Intellectual property rights", "A.5"),
    _ReqSeed("A.5.33", "Protection of records", "A.5"),
    _ReqSeed("A.5.34", "Privacy and protection of PII", "A.5"),
    _ReqSeed("A.5.35", "Independent review of information security", "A.5"),
    _ReqSeed("A.5.36", "Compliance with policies, rules and standards for information security", "A.5"),
    _ReqSeed("A.5.37", "Documented operating procedures", "A.5"),

    # A.6 People controls (8)
    _ReqSeed("A.6.1", "Screening", "A.6"),
    _ReqSeed("A.6.2", "Terms and conditions of employment", "A.6"),
    _ReqSeed("A.6.3", "Information security awareness, education and training", "A.6"),
    _ReqSeed("A.6.4", "Disciplinary process", "A.6"),
    _ReqSeed("A.6.5", "Responsibilities after termination or change of employment", "A.6"),
    _ReqSeed("A.6.6", "Confidentiality or non-disclosure agreements", "A.6"),
    _ReqSeed("A.6.7", "Remote working", "A.6"),
    _ReqSeed("A.6.8", "Information security event reporting", "A.6"),

    # A.7 Physical controls (14)
    _ReqSeed("A.7.1", "Physical security perimeters", "A.7"),
    _ReqSeed("A.7.2", "Physical entry", "A.7"),
    _ReqSeed("A.7.3", "Securing offices, rooms and facilities", "A.7"),
    _ReqSeed("A.7.4", "Physical security monitoring", "A.7"),
    _ReqSeed("A.7.5", "Protecting against physical and environmental threats", "A.7"),
    _ReqSeed("A.7.6", "Working in secure areas", "A.7"),
    _ReqSeed("A.7.7", "Clear desk and clear screen", "A.7"),
    _ReqSeed("A.7.8", "Equipment siting and protection", "A.7"),
    _ReqSeed("A.7.9", "Security of assets off-premises", "A.7"),
    _ReqSeed("A.7.10", "Storage media", "A.7"),
    _ReqSeed("A.7.11", "Supporting utilities", "A.7"),
    _ReqSeed("A.7.12", "Cabling security", "A.7"),
    _ReqSeed("A.7.13", "Equipment maintenance", "A.7"),
    _ReqSeed("A.7.14", "Secure disposal or re-use of equipment", "A.7"),

    # A.8 Technological controls (34)
    _ReqSeed("A.8.1", "User endpoint devices", "A.8"),
    _ReqSeed("A.8.2", "Privileged access rights", "A.8"),
    _ReqSeed("A.8.3", "Information access restriction", "A.8"),
    _ReqSeed("A.8.4", "Access to source code", "A.8"),
    _ReqSeed("A.8.5", "Secure authentication", "A.8"),
    _ReqSeed("A.8.6", "Capacity management", "A.8"),
    _ReqSeed("A.8.7", "Protection against malware", "A.8"),
    _ReqSeed("A.8.8", "Management of technical vulnerabilities", "A.8"),
    _ReqSeed("A.8.9", "Configuration management", "A.8"),
    _ReqSeed("A.8.10", "Information deletion", "A.8"),
    _ReqSeed("A.8.11", "Data masking", "A.8"),
    _ReqSeed("A.8.12", "Data leakage prevention", "A.8"),
    _ReqSeed("A.8.13", "Information backup", "A.8"),
    _ReqSeed("A.8.14", "Redundancy of information processing facilities", "A.8"),
    _ReqSeed("A.8.15", "Logging", "A.8"),
    _ReqSeed("A.8.16", "Monitoring activities", "A.8"),
    _ReqSeed("A.8.17", "Clock synchronization", "A.8"),
    _ReqSeed("A.8.18", "Use of privileged utility programs", "A.8"),
    _ReqSeed("A.8.19", "Installation of software on operational systems", "A.8"),
    _ReqSeed("A.8.20", "Networks security", "A.8"),
    _ReqSeed("A.8.21", "Security of network services", "A.8"),
    _ReqSeed("A.8.22", "Segregation of networks", "A.8"),
    _ReqSeed("A.8.23", "Web filtering", "A.8"),
    _ReqSeed("A.8.24", "Use of cryptography", "A.8"),
    _ReqSeed("A.8.25", "Secure development life cycle", "A.8"),
    _ReqSeed("A.8.26", "Application security requirements", "A.8"),
    _ReqSeed("A.8.27", "Secure system architecture and engineering principles", "A.8"),
    _ReqSeed("A.8.28", "Secure coding", "A.8"),
    _ReqSeed("A.8.29", "Security testing in development and acceptance", "A.8"),
    _ReqSeed("A.8.30", "Outsourced development", "A.8"),
    _ReqSeed("A.8.31", "Separation of development, test and production environments", "A.8"),
    _ReqSeed("A.8.32", "Change management", "A.8"),
    _ReqSeed("A.8.33", "Test information", "A.8"),
    _ReqSeed("A.8.34", "Protection of information systems during audit testing", "A.8"),
]


def _get_or_create_standard(db: Session) -> Tuple[Standard, bool]:
    std = db.query(Standard).filter(Standard.code == ISO27001_2022_STANDARD["code"]).one_or_none()
    if std:
        std.title = ISO27001_2022_STANDARD["title"]
        std.description = ISO27001_2022_STANDARD["description"]
        return std, False

    std = Standard(
        code=ISO27001_2022_STANDARD["code"],
        title=ISO27001_2022_STANDARD["title"],
        description=ISO27001_2022_STANDARD["description"],
    )
    db.add(std)
    db.flush()
    return std, True


def _get_or_create_clause(
    db: Session,
    *,
    standard_id: int,
    code: str,
    title: str,
    description: str = "",
) -> Tuple[Clause, bool]:
    clause = db.query(Clause).filter(Clause.standard_id == standard_id, Clause.code == code).one_or_none()
    if clause:
        clause.title = title
        clause.description = description
        return clause, False

    clause = Clause(
        standard_id=standard_id,
        code=code,
        title=title,
        description=description,
    )
    db.add(clause)
    db.flush()
    return clause, True


def _get_or_create_requirement(db: Session, *, clause_id: int, code: str, title: str) -> Tuple[Requirement, bool]:
    req = db.query(Requirement).filter(Requirement.clause_id == clause_id, Requirement.code == code).one_or_none()
    if req:
        req.title = title
        return req, False

    req = Requirement(
        clause_id=clause_id,
        code=code,
        title=title,
    )
    db.add(req)
    db.flush()
    return req, True


def _ensure_default_control(
    db: Session,
    *,
    requirement_id: int,
    requirement_code: str,
    requirement_title: str,
) -> Tuple[Control, bool]:
    """
    Ensures there is at least one Control row per Requirement.
    You can later replace/extend these with more granular controls (or link to assets/processes/etc.).
    """
    ctrl_code = f"CTRL-{requirement_code.replace('.', '-')}"

    ctrl = db.query(Control).filter(Control.requirement_id == requirement_id, Control.code == ctrl_code).one_or_none()
    if ctrl:
        ctrl.title = ctrl.title or f"Implementation of {requirement_code}"
        ctrl.description = ctrl.description or requirement_title
        return ctrl, False

    ctrl = Control(
        requirement_id=requirement_id,
        code=ctrl_code,
        title=f"Implementation of {requirement_code}",
        description=requirement_title,
    )
    db.add(ctrl)
    db.flush()
    return ctrl, True


def seed_iso27001_2022(db: Session, *, create_default_controls: bool = True) -> Dict[str, int]:
    """
    Seed ISO/IEC 27001:2022 reference data.

    Idempotent: re-running does not duplicate records (keys are code-based).
    Returns a dict with counts.
    """
    created: Dict[str, int] = {
        "standards_created": 0,
        "clauses_created": 0,
        "requirements_created": 0,
        "controls_created": 0,
    }

    std, std_created = _get_or_create_standard(db)
    created["standards_created"] += int(std_created)

    clause_by_code: Dict[str, Clause] = {}
    for c in ISO27001_2022_CLAUSES:
        clause, c_created = _get_or_create_clause(
            db,
            standard_id=std.id,
            code=c["code"],
            title=c.get("title") or "",
            description=c.get("description") or "",
        )
        clause_by_code[c["code"]] = clause
        created["clauses_created"] += int(c_created)

    annex_clause = clause_by_code["A"]

    for item in ISO27001_2022_ANNEX_A_REQUIREMENTS:
        req, r_created = _get_or_create_requirement(
            db,
            clause_id=annex_clause.id,
            code=item.code,
            title=item.title,
        )
        created["requirements_created"] += int(r_created)

        if create_default_controls:
            _, ctrl_created = _ensure_default_control(
                db,
                requirement_id=req.id,
                requirement_code=req.code,
                requirement_title=req.title,
            )
            created["controls_created"] += int(ctrl_created)

    db.commit()
    return created
