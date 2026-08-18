from __future__ import annotations

from typing import Dict, List, Tuple
from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

STANDARD = {
    "code": "ISO27001",
    "title": "ISO/IEC 27001",
    "description": "Information security management systems requirements",
    "type": "CONTROL_BASED",
}
VERSION = "2022"

# ISO 27001 clauses and their actual requirements. Annex A is deliberately NOT a requirement set.
CLAUSES: Dict[str, Tuple[str, str, List[Tuple[str, str]]]] = {
    "4": ("Context of the organization", "Organizational context and ISMS scope.", [
        ("4.1", "Understanding the organization and its context"),
        ("4.2", "Understanding the needs and expectations of interested parties"),
        ("4.3", "Determining the scope of the information security management system"),
        ("4.4", "Information security management system"),
    ]),
    "5": ("Leadership", "Leadership, policy and organizational responsibilities.", [
        ("5.1", "Leadership and commitment"),
        ("5.2", "Policy"),
        ("5.3", "Organizational roles, responsibilities and authorities"),
    ]),
    "6": ("Planning", "Risk, opportunity, objective and change planning.", [
        ("6.1", "Actions to address risks and opportunities"),
        ("6.2", "Information security objectives and planning to achieve them"),
        ("6.3", "Planning of changes"),
    ]),
    "7": ("Support", "Resources, competence, awareness, communication and documented information.", [
        ("7.1", "Resources"),
        ("7.2", "Competence"),
        ("7.3", "Awareness"),
        ("7.4", "Communication"),
        ("7.5", "Documented information"),
    ]),
    "8": ("Operation", "Operational planning, risk assessment and risk treatment.", [
        ("8.1", "Operational planning and control"),
        ("8.2", "Information security risk assessment"),
        ("8.3", "Information security risk treatment"),
    ]),
    "9": ("Performance evaluation", "Monitoring, measurement, audit and management review.", [
        ("9.1", "Monitoring, measurement, analysis and evaluation"),
        ("9.2", "Internal audit"),
        ("9.3", "Management review"),
    ]),
    "10": ("Improvement", "Continual improvement, nonconformity and corrective action.", [
        ("10.1", "Continual improvement"),
        ("10.2", "Nonconformity and corrective action"),
    ]),
}

# 93 Annex A controls. CTRL-01..CTRL-93 are application control identifiers;
# the ISO identifier is retained in the description. These are Controls, not Requirements.
ANNEX_A: List[Tuple[str, str, str]] = [
    ("CTRL-01", "A.5.1", "Policies for information security"),
    ("CTRL-02", "A.5.2", "Information security roles and responsibilities"),
    ("CTRL-03", "A.5.3", "Segregation of duties"),
    ("CTRL-04", "A.5.4", "Management responsibilities"),
    ("CTRL-05", "A.5.5", "Contact with authorities"),
    ("CTRL-06", "A.5.6", "Contact with special interest groups"),
    ("CTRL-07", "A.5.7", "Threat intelligence"),
    ("CTRL-08", "A.5.8", "Information security in project management"),
    ("CTRL-09", "A.5.9", "Inventory of information and other associated assets"),
    ("CTRL-10", "A.5.10", "Acceptable use of information and other associated assets"),
    ("CTRL-11", "A.5.11", "Return of assets"),
    ("CTRL-12", "A.5.12", "Classification of information"),
    ("CTRL-13", "A.5.13", "Labelling of information"),
    ("CTRL-14", "A.5.14", "Information transfer"),
    ("CTRL-15", "A.5.15", "Access control"),
    ("CTRL-16", "A.5.16", "Identity management"),
    ("CTRL-17", "A.5.17", "Authentication information"),
    ("CTRL-18", "A.5.18", "Access rights"),
    ("CTRL-19", "A.5.19", "Information security in supplier relationships"),
    ("CTRL-20", "A.5.20", "Addressing information security within supplier agreements"),
    ("CTRL-21", "A.5.21", "Managing information security in the ICT supply chain"),
    ("CTRL-22", "A.5.22", "Monitoring, review and change management of supplier services"),
    ("CTRL-23", "A.5.23", "Information security for use of cloud services"),
    ("CTRL-24", "A.5.24", "Information security incident management planning and preparation"),
    ("CTRL-25", "A.5.25", "Assessment and decision on information security events"),
    ("CTRL-26", "A.5.26", "Response to information security incidents"),
    ("CTRL-27", "A.5.27", "Learning from information security incidents"),
    ("CTRL-28", "A.5.28", "Collection of evidence"),
    ("CTRL-29", "A.5.29", "Information security during disruption"),
    ("CTRL-30", "A.5.30", "ICT readiness for business continuity"),
    ("CTRL-31", "A.5.31", "Legal, statutory, regulatory and contractual requirements"),
    ("CTRL-32", "A.5.32", "Intellectual property rights"),
    ("CTRL-33", "A.5.33", "Protection of records"),
    ("CTRL-34", "A.5.34", "Privacy and protection of PII"),
    ("CTRL-35", "A.5.35", "Independent review of information security"),
    ("CTRL-36", "A.5.36", "Compliance with policies, rules and standards for information security"),
    ("CTRL-37", "A.5.37", "Documented operating procedures"),
    ("CTRL-38", "A.6.1", "Screening"),
    ("CTRL-39", "A.6.2", "Terms and conditions of employment"),
    ("CTRL-40", "A.6.3", "Information security awareness, education and training"),
    ("CTRL-41", "A.6.4", "Disciplinary process"),
    ("CTRL-42", "A.6.5", "Responsibilities after termination or change of employment"),
    ("CTRL-43", "A.6.6", "Confidentiality or non-disclosure agreements"),
    ("CTRL-44", "A.6.7", "Remote working"),
    ("CTRL-45", "A.6.8", "Information security event reporting"),
    ("CTRL-46", "A.7.1", "Physical security perimeters"),
    ("CTRL-47", "A.7.2", "Physical entry"),
    ("CTRL-48", "A.7.3", "Securing offices, rooms and facilities"),
    ("CTRL-49", "A.7.4", "Physical security monitoring"),
    ("CTRL-50", "A.7.5", "Protecting against physical and environmental threats"),
    ("CTRL-51", "A.7.6", "Working in secure areas"),
    ("CTRL-52", "A.7.7", "Clear desk and clear screen"),
    ("CTRL-53", "A.7.8", "Equipment siting and protection"),
    ("CTRL-54", "A.7.9", "Security of assets off-premises"),
    ("CTRL-55", "A.7.10", "Storage media"),
    ("CTRL-56", "A.7.11", "Supporting utilities"),
    ("CTRL-57", "A.7.12", "Cabling security"),
    ("CTRL-58", "A.7.13", "Equipment maintenance"),
    ("CTRL-59", "A.7.14", "Secure disposal or re-use of equipment"),
    ("CTRL-60", "A.8.1", "User endpoint devices"),
    ("CTRL-61", "A.8.2", "Privileged access rights"),
    ("CTRL-62", "A.8.3", "Information access restriction"),
    ("CTRL-63", "A.8.4", "Access to source code"),
    ("CTRL-64", "A.8.5", "Secure authentication"),
    ("CTRL-65", "A.8.6", "Capacity management"),
    ("CTRL-66", "A.8.7", "Protection against malware"),
    ("CTRL-67", "A.8.8", "Management of technical vulnerabilities"),
    ("CTRL-68", "A.8.9", "Configuration management"),
    ("CTRL-69", "A.8.10", "Information deletion"),
    ("CTRL-70", "A.8.11", "Data masking"),
    ("CTRL-71", "A.8.12", "Data leakage prevention"),
    ("CTRL-72", "A.8.13", "Information backup"),
    ("CTRL-73", "A.8.14", "Redundancy of information processing facilities"),
    ("CTRL-74", "A.8.15", "Logging"),
    ("CTRL-75", "A.8.16", "Monitoring activities"),
    ("CTRL-76", "A.8.17", "Clock synchronization"),
    ("CTRL-77", "A.8.18", "Use of privileged utility programs"),
    ("CTRL-78", "A.8.19", "Installation of software on operational systems"),
    ("CTRL-79", "A.8.20", "Network security"),
    ("CTRL-80", "A.8.21", "Security of network services"),
    ("CTRL-81", "A.8.22", "Segregation of networks"),
    ("CTRL-82", "A.8.23", "Web filtering"),
    ("CTRL-83", "A.8.24", "Use of cryptography"),
    ("CTRL-84", "A.8.25", "Secure development life cycle"),
    ("CTRL-85", "A.8.26", "Application security requirements"),
    ("CTRL-86", "A.8.27", "Secure system architecture and engineering principles"),
    ("CTRL-87", "A.8.28", "Secure coding"),
    ("CTRL-88", "A.8.29", "Security testing in development and acceptance"),
    ("CTRL-89", "A.8.30", "Outsourced development"),
    ("CTRL-90", "A.8.31", "Separation of development, test and production environments"),
    ("CTRL-91", "A.8.32", "Change management"),
    ("CTRL-92", "A.8.33", "Test information"),
    ("CTRL-93", "A.8.34", "Protection of information systems during audit testing"),
]

# Application mapping: the current Control model has one requirement_id.
# This is an implementation mapping, not an assertion that Annex A is part of clauses 4-10.
CONTROL_REQUIREMENT_MAP = {
    "A.5": "5.3",
    "A.6": "7.2",
    "A.7": "8.1",
    "A.8": "8.1",
}


def _standard(db: Session) -> Standard:
    obj = db.query(Standard).filter(Standard.code == STANDARD["code"]).one_or_none()
    if obj is None:
        obj = Standard(**STANDARD)
        db.add(obj)
        db.flush()
    else:
        obj.title = STANDARD["title"]
        obj.description = STANDARD["description"]
        obj.type = STANDARD["type"]
    return obj


def _version(db: Session, standard: Standard) -> StandardVersion:
    obj = db.query(StandardVersion).filter(
        StandardVersion.standard_id == standard.id,
        StandardVersion.version_code == VERSION,
    ).one_or_none()
    if obj is None:
        obj = StandardVersion(standard_id=standard.id, version_code=VERSION, status="active")
        db.add(obj)
        db.flush()
    else:
        obj.status = "active"
    return obj


def _clause(db: Session, standard: Standard, version: StandardVersion, code: str, title: str, description: str) -> Clause:
    obj = db.query(Clause).filter(
        Clause.standard_version_id == version.id,
        Clause.code == code,
    ).one_or_none()
    if obj is None:
        obj = Clause(
            standard_id=standard.id,
            standard_version_id=version.id,
            code=code,
            title=title,
            description=description,
        )
        db.add(obj)
        db.flush()
    else:
        obj.standard_id = standard.id
        obj.title = title
        obj.description = description
    return obj


def _requirement(db: Session, clause: Clause, code: str, title: str) -> Requirement:
    obj = db.query(Requirement).filter(
        Requirement.clause_id == clause.id,
        Requirement.code == code,
    ).one_or_none()
    if obj is None:
        obj = Requirement(clause_id=clause.id, code=code, title=title, description=None)
        db.add(obj)
        db.flush()
    else:
        obj.title = title
    return obj


def _control(db: Session, version: StandardVersion, requirement: Requirement, code: str, annex_code: str, title: str) -> Control:
    obj = db.query(Control).filter(
        Control.standard_version_id == version.id,
        Control.code == code,
    ).one_or_none()
    if obj is None:
        obj = Control(
            standard_version_id=version.id,
            requirement_id=requirement.id,
            code=code,
            title=title,
            description=f"ISO/IEC 27001:2022 Annex A {annex_code}",
        )
        db.add(obj)
        db.flush()
    else:
        obj.requirement_id = requirement.id
        obj.title = title
        obj.description = f"ISO/IEC 27001:2022 Annex A {annex_code}"
    return obj


def seed_iso27001_2022(db: Session, *, create_default_controls: bool = True) -> Dict[str, int]:
    standard = _standard(db)
    version = _version(db, standard)
    requirements: Dict[str, Requirement] = {}

    for code, (title, description, reqs) in CLAUSES.items():
        clause = _clause(db, standard, version, code, title, description)
        for req_code, req_title in reqs:
            requirements[req_code] = _requirement(db, clause, req_code, req_title)

    if create_default_controls:
        for internal_code, annex_code, title in ANNEX_A:
            family = annex_code.split(".", 1)[0]
            req = requirements[CONTROL_REQUIREMENT_MAP[family]]
            _control(db, version, req, internal_code, annex_code, title)

    db.commit()
    return {
        "standard_id": standard.id,
        "standard_version_id": version.id,
        "clauses": len(CLAUSES),
        "requirements": sum(len(x[2]) for x in CLAUSES.values()),
        "controls": len(ANNEX_A) if create_default_controls else 0,
        "type": STANDARD["type"],
    }
