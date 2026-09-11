from sqlalchemy.orm import Session

from app.models.framework_model import FrameworkModel
from app.models.framework_relationship import FrameworkRelationship
from app.models.pam_process_category import PamProcessCategory
from app.models.pam_definition import PamProcessGroup, PamProcess
from app.models.pam_capability import PamCapabilityLevel, PamProcessAttribute
from app.models.standards import Standard
from app.routes.standards import ensure_draft


CATEGORIES = {
    "PRIMARY": "Primary Life Cycle Processes",
    "SUPPORTING": "Supporting Life Cycle Processes",
    "ORGANIZATIONAL": "Organizational Life Cycle Processes",
}

GROUPS = {
    "ACQ": ("PRIMARY", "Acquisition", 0),
    "SPL": ("PRIMARY", "Supply", 1),
    "ENG": ("PRIMARY", "Engineering", 2),
    "OPE": ("PRIMARY", "Operation", 3),
    "SUP": ("SUPPORTING", "Support", 4),
    "MAN": ("ORGANIZATIONAL", "Management", 5),
    "PIM": ("ORGANIZATIONAL", "Process Improvement", 6),
    "RIN": ("ORGANIZATIONAL", "Resource and Infrastructure", 7),
    "REU": ("ORGANIZATIONAL", "Reuse", 8),
}

PROCESSES = {
    "ACQ": ["Acquisition preparation", "Supplier selection", "Contract agreement", "Supplier monitoring", "Customer acceptance"],
    "SPL": ["Supplier tendering", "Product release", "Product acceptance support"],
    "ENG": ["Requirements elicitation", "System requirements analysis", "System architectural design", "Software requirements analysis", "Software design", "Software construction", "Software integration", "Software testing", "System integration", "System testing", "Software installation", "Software and system maintenance"],
    "OPE": ["Operational use", "Customer support"],
    "SUP": ["Quality assurance", "Verification", "Validation", "Joint review", "Audit", "Product evaluation", "Documentation", "Configuration management", "Problem resolution management", "Change request management"],
    "MAN": ["Organizational alignment", "Organizational management", "Project management", "Quality management", "Risk management", "Measurement"],
    "PIM": ["Process establishment", "Process assessment", "Process improvement"],
    "RIN": ["Human resource management", "Training", "Knowledge management", "Infrastructure"],
    "REU": ["Asset management", "Reuse program management", "Domain engineering"],
}

CAPABILITY_LEVELS = [
    (0, "CL0", "Incomplete process"),
    (1, "CL1", "Performed process"),
    (2, "CL2", "Managed process"),
    (3, "CL3", "Established process"),
    (4, "CL4", "Predictable process"),
    (5, "CL5", "Innovating process"),
]

ATTRIBUTES = {
    1: [("PA 1.1", "Process performance")],
    2: [("PA 2.1", "Performance management"), ("PA 2.2", "Work product management")],
    3: [("PA 3.1", "Process definition"), ("PA 3.2", "Process deployment")],
    4: [("PA 4.1", "Process measurement"), ("PA 4.2", "Process control")],
    5: [("PA 5.1", "Process innovation"), ("PA 5.2", "Process innovation implementation")],
}


def _model(db, version_id, model_type, code, name):
    item = db.query(FrameworkModel).filter(
        FrameworkModel.standard_version_id == version_id,
        FrameworkModel.model_type == model_type,
        FrameworkModel.code == code,
    ).first()
    if not item:
        item = FrameworkModel(
            standard_version_id=version_id,
            model_type=model_type,
            code=code,
            name=name,
            status="draft",
            is_canonical=True,
        )
        db.add(item)
        db.flush()
    return item


def seed_iso15504_2006(db: Session):
    """Seed canonical English ISO/IEC 15504-5:2006 structure."""
    standard = db.query(Standard).filter(Standard.code == "ISO15504").first()
    if not standard:
        standard = Standard(code="ISO15504", title="ISO/IEC 15504 (SPICE)", type="MATURITY_BASED")
        db.add(standard)
        db.commit()
        db.refresh(standard)

    version = ensure_draft(db, standard)
    pam = _model(db, version.id, "PAM", "ISO15504-5-2006-PAM", "ISO/IEC 15504-5:2006 Exemplar Process Assessment Model")
    cmf = _model(db, version.id, "CMF", "ISO15504-2-2003-CMF", "ISO/IEC 15504-2:2003 Capability Measurement Framework")

    if not db.query(FrameworkRelationship).filter(
        FrameworkRelationship.source_model_id == pam.id,
        FrameworkRelationship.target_model_id == cmf.id,
        FrameworkRelationship.relationship_type == "CAPABILITY_MEASUREMENT_FRAMEWORK",
    ).first():
        db.add(FrameworkRelationship(
            source_model_id=pam.id,
            target_model_id=cmf.id,
            relationship_type="CAPABILITY_MEASUREMENT_FRAMEWORK",
        ))

    category_map = {}
    for order, (code, name) in enumerate(CATEGORIES.items()):
        category = db.query(PamProcessCategory).filter(
            PamProcessCategory.framework_model_id == pam.id,
            PamProcessCategory.code == code,
        ).first()
        if not category:
            category = PamProcessCategory(framework_model_id=pam.id, code=code, name=name, sort_order=order)
            db.add(category)
            db.flush()
        category_map[code] = category

    for group_code, (category_code, group_name, group_order) in GROUPS.items():
        category = category_map[category_code]
        group = db.query(PamProcessGroup).filter(
            PamProcessGroup.category_id == category.id,
            PamProcessGroup.code == group_code,
        ).first()
        if not group:
            group = PamProcessGroup(category_id=category.id, code=group_code, name=group_name, sort_order=group_order)
            db.add(group)
            db.flush()

        for order, name in enumerate(PROCESSES[group_code], start=1):
            code = f"{group_code}.{order}"
            process = db.query(PamProcess).filter(
                PamProcess.framework_model_id == pam.id,
                PamProcess.code == code,
            ).first()
            if not process:
                db.add(PamProcess(
                    framework_model_id=pam.id,
                    process_group_id=group.id,
                    code=code,
                    name=name,
                    sort_order=order,
                ))

    for level, code, name in CAPABILITY_LEVELS:
        capability = db.query(PamCapabilityLevel).filter(
            PamCapabilityLevel.framework_model_id == cmf.id,
            PamCapabilityLevel.level == level,
        ).first()
        if not capability:
            capability = PamCapabilityLevel(
                framework_model_id=cmf.id,
                level=level,
                code=code,
                name=name,
                sort_order=level,
            )
            db.add(capability)
            db.flush()

        for order, (attribute_code, attribute_name) in enumerate(ATTRIBUTES.get(level, [])):
            if not db.query(PamProcessAttribute).filter(
                PamProcessAttribute.capability_level_id == capability.id,
                PamProcessAttribute.code == attribute_code,
            ).first():
                db.add(PamProcessAttribute(
                    capability_level_id=capability.id,
                    code=attribute_code,
                    name=attribute_name,
                    sort_order=order,
                ))

    db.commit()
