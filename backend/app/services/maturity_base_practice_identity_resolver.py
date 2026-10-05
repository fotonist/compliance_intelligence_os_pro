from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session


class MaturityBasePracticeIdentityError(ValueError):
    pass


class MaturityBasePracticeIdentityNotFoundError(
    MaturityBasePracticeIdentityError
):
    pass


class MaturityBasePracticeIdentityConflictError(
    MaturityBasePracticeIdentityError
):
    pass


@dataclass(frozen=True)
class MaturityBasePracticeIdentity:
    tenant_id: int
    assessment_id: int
    assessment_process_id: int

    adoption_id: int

    standard_id: int
    standard_code: str
    standard_title: str
    standard_version_id: int
    standard_version_code: str
    framework_type: str

    pam_process_id: int
    pam_process_code: str
    pam_process_name: str

    pam_base_practice_id: int
    base_practice_code: str
    base_practice_text: str | None

    reference_process_id: int
    reference_process_code: str
    reference_process_name: str

    standard_base_practice_id: int
    standard_base_practice_title: str | None


class MaturityBasePracticeIdentityResolver:

    @classmethod
    def resolve(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        pam_base_practice_id: int,
    ) -> MaturityBasePracticeIdentity:

        runtime = db.execute(
            text(
                """
                SELECT
                    pa.id AS assessment_id,
                    pa.framework_adoption_id AS adoption_id,

                    fa.standard_id,
                    fa.standard_version_id,

                    s.code AS standard_code,
                    s.title AS standard_title,
                    s.type AS framework_type,

                    sv.version_code AS standard_version_code,

                    ap.id AS assessment_process_id,

                    pp.id AS pam_process_id,
                    pp.code AS pam_process_code,
                    pp.name AS pam_process_name,

                    bp.id AS pam_base_practice_id,
                    bp.code AS base_practice_code,
                    bp.text AS base_practice_text

                FROM pam_assessments pa

                JOIN framework_adoptions fa
                  ON fa.id = pa.framework_adoption_id
                 AND fa.tenant_id = pa.tenant_id

                JOIN standards s
                  ON s.id = fa.standard_id

                JOIN standard_versions sv
                  ON sv.id = fa.standard_version_id
                 AND sv.standard_id = fa.standard_id

                JOIN pam_assessment_processes ap
                  ON ap.assessment_id = pa.id
                 AND ap.id = :assessment_process_id

                JOIN pam_processes pp
                  ON pp.id = ap.pam_process_id
                 AND pp.framework_model_id =
                     pa.framework_model_id

                JOIN pam_base_practices bp
                  ON bp.process_id = pp.id
                 AND bp.id = :pam_base_practice_id

                WHERE pa.id = :assessment_id
                  AND pa.tenant_id = :tenant_id
                  AND ap.in_scope IS TRUE
                  AND UPPER(COALESCE(s.type, '')) =
                      'MATURITY_BASED'
                  AND UPPER(COALESCE(fa.status, '')) =
                      'ACTIVE'
                  AND UPPER(COALESCE(fa.applicability, '')) =
                      'APPLICABLE'
                """
            ),
            {
                "tenant_id": tenant_id,
                "assessment_id": assessment_id,
                "assessment_process_id": assessment_process_id,
                "pam_base_practice_id": pam_base_practice_id,
            },
        ).mappings().first()

        if runtime is None:
            raise MaturityBasePracticeIdentityNotFoundError(
                "Base practice is not part of the active "
                "maturity assessment context."
            )

        matches = db.execute(
            text(
                """
                SELECT
                    bp.id AS standard_base_practice_id,
                    bp.title AS standard_base_practice_title,

                    rp.id AS reference_process_id,
                    rp.code AS reference_process_code,
                    rp.name AS reference_process_name

                FROM standard_base_practices bp

                JOIN standard_reference_processes rp
                  ON rp.id = bp.process_id
                 AND rp.standard_version_id =
                     bp.standard_version_id

                WHERE bp.standard_version_id =
                      :standard_version_id

                  AND UPPER(TRIM(bp.code)) =
                      UPPER(TRIM(:base_practice_code))

                  AND UPPER(TRIM(rp.code)) =
                      UPPER(TRIM(:process_code))

                ORDER BY bp.id
                """
            ),
            {
                "standard_version_id":
                    int(runtime["standard_version_id"]),
                "base_practice_code":
                    runtime["base_practice_code"],
                "process_code":
                    runtime["pam_process_code"],
            },
        ).mappings().all()

        if not matches:
            raise MaturityBasePracticeIdentityNotFoundError(
                "No standard Base Practice identity exists "
                "for the PAM runtime Base Practice."
            )

        if len(matches) != 1:
            raise MaturityBasePracticeIdentityConflictError(
                "PAM runtime Base Practice does not resolve "
                "to exactly one standard Base Practice."
            )

        target = matches[0]

        return MaturityBasePracticeIdentity(
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,

            adoption_id=int(runtime["adoption_id"]),

            standard_id=int(runtime["standard_id"]),
            standard_code=runtime["standard_code"],
            standard_title=runtime["standard_title"],

            standard_version_id=int(
                runtime["standard_version_id"]
            ),
            standard_version_code=
                runtime["standard_version_code"],

            framework_type=runtime["framework_type"],

            pam_process_id=int(runtime["pam_process_id"]),
            pam_process_code=runtime["pam_process_code"],
            pam_process_name=runtime["pam_process_name"],

            pam_base_practice_id=int(
                runtime["pam_base_practice_id"]
            ),
            base_practice_code=
                runtime["base_practice_code"],
            base_practice_text=
                runtime["base_practice_text"],

            reference_process_id=int(
                target["reference_process_id"]
            ),
            reference_process_code=
                target["reference_process_code"],
            reference_process_name=
                target["reference_process_name"],

            standard_base_practice_id=int(
                target["standard_base_practice_id"]
            ),
            standard_base_practice_title=
                target["standard_base_practice_title"],
        )
