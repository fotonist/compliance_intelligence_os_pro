from datetime import datetime, timezone

from app.schemas.compliance_workspace_schema import (
    AnalyticsDto,
    AIFindingDto,
    AIEngineDto,
    ClauseDto,
    ComplianceWorkspaceResponse,
    ControlDto,
    CoverageDto,
    EvidenceDto,
    RequirementDto,
    RiskDto,
    RiskSummaryDto,
    StandardDto,
    TaskDto,
    TaskSummaryDto,
    TimelineDto,
)


class ComplianceWorkspaceMapper:

    # ============================================================
    # DATETIME NORMALIZATION
    # ============================================================

    @staticmethod
    def _normalize_datetime(value):
        """
        Normalize naive and timezone-aware datetimes to UTC-aware.

        The production database contains a mixture of DateTime
        columns that may return naive values and timezone-aware
        values. All internal comparisons must use one representation.
        """

        if value is None:
            return None

        if not isinstance(value, datetime):
            return None

        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)

    # ============================================================
    # EVIDENCE FILE APPROVAL STATE
    # ============================================================

    @staticmethod
    def _get_latest_evidence_file(evidence):
        files = list(
            getattr(
                evidence,
                "files",
                [],
            )
            or []
        )

        if not files:
            return None

        return max(
            files,
            key=lambda file: (
                getattr(file, "version", 0) or 0,
                ComplianceWorkspaceMapper._normalize_datetime(
                    getattr(file, "uploaded_at", None)
                )
                or datetime.min.replace(tzinfo=timezone.utc),
                getattr(file, "id", 0) or 0,
            ),
        )

    @staticmethod
    def _get_evidence_approval_status(evidence):
        """
        Evidence approval state is derived from the latest
        EvidenceFile version.

        Production DB source of truth:
            evidence_files.status

        Normalized result:
            APPROVED
            REJECTED
            PENDING
        """

        latest_file = (
            ComplianceWorkspaceMapper._get_latest_evidence_file(
                evidence
            )
        )

        if latest_file is None:
            return "PENDING"

        status = (
            getattr(
                latest_file,
                "status",
                None,
            )
            or ""
        ).strip().upper()

        normalized = (
            status.replace("-", "_")
            .replace(" ", "_")
        )

        if normalized in (
            "APPROVED",
            "ACCEPTED",
        ):
            return "APPROVED"

        if normalized in (
            "REJECTED",
            "DECLINED",
        ):
            return "REJECTED"

        return "PENDING"

    # ============================================================
    # STANDARD
    # ============================================================

    @staticmethod
    def map_standard(control):

        requirement = getattr(
            control,
            "requirement",
            None,
        )

        clause = getattr(
            requirement,
            "clause",
            None,
        )

        standard = getattr(
            clause,
            "standard",
            None,
        )

        if standard is None:
            return StandardDto()

        return StandardDto(
            id=standard.id,
            code=standard.code,
            title=standard.title,
            type=getattr(
                standard,
                "type",
                None,
            ),
        )

    # ============================================================
    # CLAUSE
    # ============================================================

    @staticmethod
    def map_clause(control):

        requirement = getattr(
            control,
            "requirement",
            None,
        )

        clause = getattr(
            requirement,
            "clause",
            None,
        )

        if clause is None:
            return ClauseDto()

        return ClauseDto(
            id=clause.id,
            code=clause.code,
            title=clause.title,
            description=getattr(
                clause,
                "description",
                None,
            ),
        )

    # ============================================================
    # REQUIREMENT
    # ============================================================

    @staticmethod
    def map_requirement(control):

        requirement = getattr(
            control,
            "requirement",
            None,
        )

        if requirement is None:
            return RequirementDto()

        return RequirementDto(
            id=requirement.id,
            code=requirement.code,
            title=requirement.title,
        )

    # ============================================================
    # CONTROL
    # ============================================================

    @staticmethod
    def map_control(control):

        return ControlDto(
            id=control.id,
            code=control.code,
            title=control.title,
            description=getattr(
                control,
                "description",
                None,
            ),
            standard_version_id=getattr(
                control,
                "standard_version_id",
                None,
            ),
        )

    # ============================================================
    # EVIDENCES
    # ============================================================

    @staticmethod
    def map_evidences(control):

        evidences = []

        for evidence in getattr(
            control,
            "evidences",
            [],
        ):

            approval_status = (
                ComplianceWorkspaceMapper
                ._get_evidence_approval_status(
                    evidence
                )
            )

            evidences.append(
                EvidenceDto(
                    id=evidence.id,
                    title=evidence.title,
                    description=getattr(
                        evidence,
                        "description",
                        None,
                    ),
                    status=getattr(
                        evidence,
                        "status",
                        None,
                    ),
                    approval_status=approval_status,
                    assessment_type=getattr(
                        evidence,
                        "assessment_type",
                        None,
                    ),
                    regulation=getattr(
                        evidence,
                        "regulation",
                        None,
                    ),
                    source_url=getattr(
                        evidence,
                        "source_url",
                        None,
                    ),
                    reviewed_by=getattr(
                        evidence,
                        "reviewed_by",
                        None,
                    ),
                    reviewed_at=getattr(
                        evidence,
                        "reviewed_at",
                        None,
                    ),
                    created_at=getattr(
                        evidence,
                        "created_at",
                        None,
                    ),
                    updated_at=getattr(
                        evidence,
                        "updated_at",
                        None,
                    ),
                    file_count=len(
                        getattr(
                            evidence,
                            "files",
                            [],
                        )
                        or []
                    ),
                )
            )

        return evidences

    # ============================================================
    # COVERAGE
    # ============================================================

    @staticmethod
    def map_coverage(control):

        evidences = getattr(
            control,
            "evidences",
            [],
        )

        total = len(evidences)

        approved = 0
        pending = 0
        rejected = 0

        for evidence in evidences:

            approval_status = (
                ComplianceWorkspaceMapper
                ._get_evidence_approval_status(
                    evidence
                )
            )

            if approval_status == "APPROVED":
                approved += 1

            elif approval_status == "REJECTED":
                rejected += 1

            else:
                pending += 1

        if total == 0:

            percentage = 0
            coverage_status = "NOT_STARTED"

        else:

            percentage = round(
                approved * 100 / total,
                2,
            )

            if approved == total:

                coverage_status = "ACHIEVED"

            elif approved > 0:

                coverage_status = (
                    "PARTIALLY_ACHIEVED"
                )

            else:

                coverage_status = (
                    "NOT_ACHIEVED"
                )

        return CoverageDto(
            status=coverage_status,
            percentage=percentage,
            total_evidence=total,
            approved_evidence=approved,
            pending_evidence=pending,
            rejected_evidence=rejected,
        )

    # ============================================================
    # RISKS
    # ============================================================

    @staticmethod
    def map_risks(control):

        risks = []

        for risk in getattr(
            control,
            "risks",
            [],
        ):

            risks.append(
                RiskDto(
                    id=risk.id,
                    title=risk.title,
                    description=getattr(
                        risk,
                        "description",
                        None,
                    ),
                    impact=getattr(
                        risk,
                        "impact",
                        None,
                    ),
                    likelihood=getattr(
                        risk,
                        "likelihood",
                        None,
                    ),
                    score=getattr(
                        risk,
                        "score",
                        0,
                    ),
                    risk_level=getattr(
                        risk,
                        "risk_level",
                        None,
                    ),
                    status=getattr(
                        risk,
                        "status",
                        None,
                    ),
                    treatment=getattr(
                        risk,
                        "treatment",
                        None,
                    ),
                    action=getattr(
                        risk,
                        "action",
                        None,
                    ),
                    coverage_status=getattr(
                        risk,
                        "control_coverage_status",
                        None,
                    ),
                    created_at=getattr(
                        risk,
                        "created_at",
                        None,
                    ),
                    updated_at=getattr(
                        risk,
                        "updated_at",
                        None,
                    ),
                )
            )

        return risks

    # ============================================================
    # RISK SUMMARY
    # ============================================================

    @staticmethod
    def map_risk_summary(control):

        risks = getattr(
            control,
            "risks",
            [],
        )

        total = len(risks)

        critical = 0
        high = 0
        medium = 0
        low = 0

        total_score = 0

        for risk in risks:

            score = getattr(
                risk,
                "score",
                0,
            ) or 0

            total_score += score

            level = (
                getattr(
                    risk,
                    "risk_level",
                    "",
                )
                or ""
            ).upper()

            if level == "CRITICAL":
                critical += 1

            elif level == "HIGH":
                high += 1

            elif level == "MEDIUM":
                medium += 1

            elif level == "LOW":
                low += 1

        average_score = (
            round(
                total_score / total,
                2,
            )
            if total > 0
            else 0
        )

        return RiskSummaryDto(
            total=total,
            critical=critical,
            high=high,
            medium=medium,
            low=low,
            total_score=total_score,
            average_score=average_score,
        )

    # ============================================================
    # TASKS
    # ============================================================

    @staticmethod
    def map_tasks(control):

        tasks = []

        for task in getattr(
            control,
            "tasks",
            [],
        ):

            tasks.append(
                TaskDto(
                    id=task.id,
                    title=getattr(
                        task,
                        "title",
                        None,
                    ),
                    description=getattr(
                        task,
                        "description",
                        None,
                    ),
                    status=getattr(
                        task,
                        "status",
                        None,
                    ),
                    priority_score=getattr(
                        task,
                        "priority_score",
                        None,
                    ),
                    owner_role=getattr(
                        task,
                        "owner_role",
                        None,
                    ),
                    source_type=getattr(
                        task,
                        "source_type",
                        None,
                    ),
                    source_id=getattr(
                        task,
                        "source_id",
                        None,
                    ),
                    due_date=getattr(
                        task,
                        "due_date",
                        None,
                    ),
                    created_at=getattr(
                        task,
                        "created_at",
                        None,
                    ),
                    updated_at=getattr(
                        task,
                        "updated_at",
                        None,
                    ),
                )
            )

        return tasks

    # ============================================================
    # TASK SUMMARY
    # ============================================================

    @staticmethod
    def map_task_summary(control):

        tasks = getattr(
            control,
            "tasks",
            [],
        )

        now = datetime.now(
            timezone.utc
        )

        total = len(tasks)

        open_tasks = 0
        completed_tasks = 0
        overdue_tasks = 0

        for task in tasks:

            status = (
                getattr(
                    task,
                    "status",
                    "",
                )
                or ""
            ).upper()

            if status in (
                "COMPLETED",
                "DONE",
                "CLOSED",
            ):
                completed_tasks += 1

            else:
                open_tasks += 1

            due_date = getattr(
                task,
                "due_date",
                None,
            )

            due_date = ComplianceWorkspaceMapper._normalize_datetime(
                due_date
            )

            if due_date is not None:

                if (
                    due_date < now
                    and status not in (
                        "COMPLETED",
                        "DONE",
                        "CLOSED",
                    )
                ):
                    overdue_tasks += 1

        return TaskSummaryDto(
            total=total,
            open=open_tasks,
            completed=completed_tasks,
            overdue=overdue_tasks,
        )

    # ============================================================
    # TIMELINE
    # ============================================================

    @staticmethod
    def map_timeline(control):

        timeline = []

        # =========================
        # Evidences
        # =========================

        for evidence in getattr(
            control,
            "evidences",
            [],
        ):

            created_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    evidence,
                    "created_at",
                    None,
                )
            )

            reviewed_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    evidence,
                    "reviewed_at",
                    None,
                )
            )

            if created_at:
                timeline.append(
                    TimelineDto(
                        type="evidence",
                        action="CREATED",
                        title=evidence.title,
                        date=created_at,
                    )
                )

            if reviewed_at:
                timeline.append(
                    TimelineDto(
                        type="evidence",
                        action="REVIEWED",
                        title=evidence.title,
                        date=reviewed_at,
                    )
                )

        # =========================
        # Risks
        # =========================

        for risk in getattr(
            control,
            "risks",
            [],
        ):

            created_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    risk,
                    "created_at",
                    None,
                )
            )

            updated_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    risk,
                    "updated_at",
                    None,
                )
            )

            if created_at:
                timeline.append(
                    TimelineDto(
                        type="risk",
                        action="CREATED",
                        title=risk.title,
                        date=created_at,
                    )
                )

            if updated_at:
                timeline.append(
                    TimelineDto(
                        type="risk",
                        action="UPDATED",
                        title=risk.title,
                        date=updated_at,
                    )
                )

        # =========================
        # Tasks
        # =========================

        for task in getattr(
            control,
            "tasks",
            [],
        ):

            created_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    task,
                    "created_at",
                    None,
                )
            )

            updated_at = ComplianceWorkspaceMapper._normalize_datetime(
                getattr(
                    task,
                    "updated_at",
                    None,
                )
            )

            if created_at:
                timeline.append(
                    TimelineDto(
                        type="task",
                        action="CREATED",
                        title=getattr(
                            task,
                            "title",
                            "",
                        ),
                        date=created_at,
                    )
                )

            if updated_at:
                timeline.append(
                    TimelineDto(
                        type="task",
                        action="UPDATED",
                        title=getattr(
                            task,
                            "title",
                            "",
                        ),
                        date=updated_at,
                    )
                )

        timeline.sort(
            key=lambda x: (
                ComplianceWorkspaceMapper._normalize_datetime(
                    x.date
                )
                or datetime.min.replace(
                    tzinfo=timezone.utc
                )
            ),
            reverse=True,
        )

        return timeline

    # ============================================================
    # ANALYTICS
    # ============================================================

    @staticmethod
    def map_analytics(control):

        coverage = (
            ComplianceWorkspaceMapper.map_coverage(
                control
            )
        )

        risks = (
            ComplianceWorkspaceMapper.map_risk_summary(
                control
            )
        )

        tasks = (
            ComplianceWorkspaceMapper.map_task_summary(
                control
            )
        )

        risk_score = min(
            risks.total_score,
            100,
        )

        health_score = round(
            (
                coverage.percentage
                + (100 - risk_score)
            )
            / 2,
            2,
        )

        return AnalyticsDto(
            health_score=health_score,
            coverage_percentage=coverage.percentage,
            risk_score=risks.total_score,
            evidence_count=coverage.total_evidence,
            approved_evidence=coverage.approved_evidence,
            pending_evidence=coverage.pending_evidence,
            rejected_evidence=coverage.rejected_evidence,
            risk_count=risks.total,
            critical_risk_count=risks.critical,
            high_risk_count=risks.high,
            medium_risk_count=risks.medium,
            low_risk_count=risks.low,
            task_count=tasks.total,
            open_tasks=tasks.open,
            completed_tasks=tasks.completed,
            overdue_tasks=tasks.overdue,
        )

    # ============================================================
    # AI FINDINGS
    # ============================================================

    @staticmethod
    def map_ai_findings(control):

        coverage = (
            ComplianceWorkspaceMapper.map_coverage(
                control
            )
        )

        risks = (
            ComplianceWorkspaceMapper.map_risk_summary(
                control
            )
        )

        tasks = (
            ComplianceWorkspaceMapper.map_task_summary(
                control
            )
        )

        findings = []

        if coverage.percentage < 100:

            findings.append(
                {
                    "category": "EVIDENCE",
                    "severity": (
                        "HIGH"
                        if coverage.percentage == 0
                        else "MEDIUM"
                    ),
                    "message": (
                        "Evidence coverage is insufficient."
                        if coverage.percentage < 50
                        else "Evidence coverage is partially complete."
                    ),
                }
            )

        if risks.critical > 0:

            findings.append(
                {
                    "category": "RISK",
                    "severity": "CRITICAL",
                    "message": (
                        f"{risks.critical} critical risk(s) "
                        "require immediate attention."
                    ),
                }
            )

        elif risks.high > 0:

            findings.append(
                {
                    "category": "RISK",
                    "severity": "HIGH",
                    "message": (
                        f"{risks.high} high risk(s) "
                        "should be addressed."
                    ),
                }
            )

        if tasks.overdue > 0:

            findings.append(
                {
                    "category": "TASK",
                    "severity": "HIGH",
                    "message": (
                        f"{tasks.overdue} overdue task(s) detected."
                    ),
                }
            )

        return findings

    # ============================================================
    # AI ENGINE
    # ============================================================

    @staticmethod
    def map_ai_engine(control):

        return {
            "status": "ACTIVE",
            "source": "Compliance Intelligence Engine",
        }

    # ============================================================
    # WORKSPACE
    # ============================================================

    @staticmethod
    def map_workspace(
        control,
        ai_summary=None,
        ai_executive_summary=None,
    ):

        return ComplianceWorkspaceResponse(

            standard=ComplianceWorkspaceMapper.map_standard(
                control
            ),

            clause=ComplianceWorkspaceMapper.map_clause(
                control
            ),

            requirement=ComplianceWorkspaceMapper.map_requirement(
                control
            ),

            control=ComplianceWorkspaceMapper.map_control(
                control
            ),

            coverage=ComplianceWorkspaceMapper.map_coverage(
                control
            ),

            evidences=ComplianceWorkspaceMapper.map_evidences(
                control
            ),

            risks=ComplianceWorkspaceMapper.map_risks(
                control
            ),

            risk_summary=ComplianceWorkspaceMapper.map_risk_summary(
                control
            ),

            tasks=ComplianceWorkspaceMapper.map_tasks(
                control
            ),

            task_summary=ComplianceWorkspaceMapper.map_task_summary(
                control
            ),

            analytics=ComplianceWorkspaceMapper.map_analytics(
                control
            ),

            timeline=ComplianceWorkspaceMapper.map_timeline(
                control
            ),

            ai_summary=ai_summary or [],
            ai_executive_summary=ai_executive_summary,

            ai_findings=ComplianceWorkspaceMapper.map_ai_findings(
                control
            ),

            ai_engine=ComplianceWorkspaceMapper.map_ai_engine(
                control
            ),
        )
