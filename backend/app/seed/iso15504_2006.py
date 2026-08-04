from sqlalchemy.orm import Session

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

from app.routes.standards import ensure_draft


def seed_iso15504_2006(db: Session):
    """
    ISO/IEC 15504:2006 (SPICE) – MATURITY BASED
    Seed is ALWAYS bound to a DRAFT standard_version.
    """

    # -------------------------------------------------
    # STANDARD
    # -------------------------------------------------
    standard = db.query(Standard).filter(
        Standard.code == "ISO15504"
    ).first()

    if not standard:
        standard = Standard(
            code="ISO15504",
            title="ISO/IEC 15504 (SPICE)",
            type="MATURITY_BASED",
        )
        db.add(standard)
        db.commit()
        db.refresh(standard)

    # -------------------------------------------------
    # ENSURE DRAFT VERSION
    # -------------------------------------------------
    draft: StandardVersion = ensure_draft(db, standard)

    # -------------------------------------------------
    # PROCESS AREAS (STANDARD + DRAFT’A BAĞLI)
    # -------------------------------------------------
    process_areas = [
        ("ENG", "Engineering"),
        ("MAN", "Management"),
        ("ORG", "Organization"),
        ("SPL", "Supplier"),
        ("SUP", "Support"),
    ]

    pa_map: dict[str, StandardProcessArea] = {}

    for idx, (code, name) in enumerate(process_areas):
        pa = (
            db.query(StandardProcessArea)
            .filter(
                StandardProcessArea.standard_id == standard.id,
                StandardProcessArea.standard_version_id == draft.id,
                StandardProcessArea.code == code,
            )
            .first()
        )

        if not pa:
            pa = StandardProcessArea(
                standard_id=standard.id,
                standard_version_id=draft.id,
                code=code,
                name=name,
                description=None,
                sort_order=idx,
            )
            db.add(pa)
            db.flush()

        pa_map[code] = pa

    # -------------------------------------------------
    # PRACTICES (STANDARD’A BAĞLI)
    # -------------------------------------------------
    practices = {
        "ENG": [
            ("ENG01", "Requirements Engineering", 1),
            ("ENG02", "Design and Implementation", 2),
            ("ENG03", "Integration and Testing", 3),
        ],
        "MAN": [
            ("MAN01", "Project Management", 2),
            ("MAN02", "Risk Management", 3),
        ],
        "ORG": [
            ("ORG01", "Process Definition", 2),
        ],
        "SPL": [
            ("SPL01", "Supplier Agreement Management", 2),
        ],
        "SUP": [
            ("SUP01", "Configuration Management", 2),
            ("SUP02", "Quality Assurance", 3),
        ],
    }

    for pa_code, plist in practices.items():
        pa = pa_map[pa_code]

        for code, title, level in plist:
            exists = (
                db.query(StandardPractice)
                .filter(
                    StandardPractice.process_area_id == pa.id,
                    StandardPractice.code == code,
                )
                .first()
            )

            if exists:
                continue

            db.add(
                StandardPractice(
                    standard_id=standard.id,
                    process_area_id=pa.id,
                    code=code,
                    title=title,
                    level=level,
                    text="",          # ✅ NOT NULL constraint
                    guidance=None,
                    is_active=True,
                )
            )

    db.commit()
