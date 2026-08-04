import numpy as np
from datetime import datetime, timedelta, timezone
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.exceptions import NotFittedError
from sqlalchemy.orm import Session

from app.models.risks import Risk
from app.models.risk_history import RiskHistory
from app.models.compliance_tasks import ComplianceTask
from app.models.risk_forecasts import RiskForecast


class RiskForecastEngine:
    FEATURE_NAMES = [
        "score",
        "impact",
        "likelihood",
        "risk_level_rank",
        "last_change_days",
        "changes_90d",
        "avg_delta_90d",
        "max_delta_90d",
        "open_tasks",
    ]

    def __init__(self):
        self.classifier = RandomForestClassifier(n_estimators=200, random_state=42)
        self.regressor = RandomForestRegressor(n_estimators=200, random_state=42)
        self.model_version = "v2.0"

        self._is_trained = False
        self._train_info = {"trained": False, "samples": 0, "reason": None}

    # -----------------------------
    # Time utils (TZ-safe)
    # -----------------------------
    def _utcnow(self) -> datetime:
        # timezone-aware UTC "now"
        return datetime.now(timezone.utc)

    def _as_aware_utc(self, dt: datetime) -> datetime:
        """
        Normalize any datetime to timezone-aware UTC.
        - If dt is naive: assume UTC.
        - If dt is aware: convert to UTC.
        """
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    # -------------------------------------------------
    # Utility
    # -------------------------------------------------
    def _risk_level_rank(self, level):
        if not level:
            return 0
        s = str(level).lower().strip()
        if s in ["critical", "very_high", "very high", "extreme"]:
            return 4
        if s in ["high", "major"]:
            return 3
        if s in ["medium", "moderate"]:
            return 2
        if s in ["low", "minor"]:
            return 1
        return 0

    def _baseline_prob(self, score: float) -> float:
        try:
            s = float(score or 0.0)
        except Exception:
            s = 0.0
        x = (s - 9.0) / 3.0
        prob = 1.0 / (1.0 + np.exp(-x))
        return float(min(max(prob, 0.0), 1.0))

    # -------------------------------------------------
    # Feature Engineering
    # -------------------------------------------------
    def _build_features_at_time(self, db: Session, risk: Risk, snapshot_time: datetime):
        snapshot_time = self._as_aware_utc(snapshot_time)

        history = (
            db.query(RiskHistory)
            .filter(
                RiskHistory.risk_id == risk.id,
                RiskHistory.changed_at <= snapshot_time,
            )
            .order_by(RiskHistory.changed_at.desc())
            .all()
        )

        last_change_days = 999
        if history and history[0].changed_at:
            last_dt = self._as_aware_utc(history[0].changed_at)
            last_change_days = (snapshot_time - last_dt).days

        cutoff_90 = snapshot_time - timedelta(days=90)

        hist_90 = []
        for h in history:
            if not h.changed_at:
                continue
            hdt = self._as_aware_utc(h.changed_at)
            if hdt >= cutoff_90:
                hist_90.append(h)

        changes_90d = len(hist_90)

        deltas = []
        for h in hist_90:
            if h.score_old is not None and h.score_new is not None:
                deltas.append(float(h.score_new) - float(h.score_old))

        avg_delta = float(np.mean(deltas)) if deltas else 0.0
        max_delta = float(max(deltas)) if deltas else 0.0

        open_tasks = (
            db.query(ComplianceTask)
            .filter(
                ComplianceTask.tenant_id == risk.tenant_id,
                ComplianceTask.control_id == risk.control_id,
                ComplianceTask.status != "done",
            )
            .count()
        )

        feature_vector = [
            float(risk.score or 0.0),
            float(risk.impact or 0.0),
            float(risk.likelihood or 0.0),
            float(self._risk_level_rank(risk.risk_level)),
            float(last_change_days),
            float(changes_90d),
            float(avg_delta),
            float(max_delta),
            float(open_tasks),
        ]
        return feature_vector

    # -------------------------------------------------
    # Label Builder (Forward 30d)
    # -------------------------------------------------
    def _build_label(self, db: Session, risk: Risk, snapshot_time: datetime):
        snapshot_time = self._as_aware_utc(snapshot_time)
        end_time = snapshot_time + timedelta(days=30)

        future_changes = (
            db.query(RiskHistory)
            .filter(
                RiskHistory.risk_id == risk.id,
                RiskHistory.changed_at > snapshot_time,
                RiskHistory.changed_at <= end_time,
            )
            .all()
        )

        escalated = 0
        delta = 0.0

        for h in future_changes:
            if h.score_old is not None and h.score_new is not None:
                if float(h.score_new) > float(h.score_old):
                    escalated = 1
                delta += float(h.score_new) - float(h.score_old)

        return int(escalated), float(delta)

    # -------------------------------------------------
    # Dataset Builder (Time-Based, sorted)
    # -------------------------------------------------
    def build_dataset(self, db: Session, tenant_id: int):
        risks = db.query(Risk).filter(Risk.tenant_id == tenant_id).all()
        samples = []  # (snapshot_time, features, escalated, delta)

        for r in risks:
            history = (
                db.query(RiskHistory)
                .filter(RiskHistory.risk_id == r.id)
                .order_by(RiskHistory.changed_at)
                .all()
            )

            for h in history:
                if not h.changed_at:
                    continue
                snapshot_time = self._as_aware_utc(h.changed_at)
                features = self._build_features_at_time(db, r, snapshot_time)
                escalated, delta = self._build_label(db, r, snapshot_time)
                samples.append((snapshot_time, features, escalated, delta))

        samples.sort(key=lambda t: t[0])

        X = np.array([s[1] for s in samples], dtype=float) if samples else np.array([], dtype=float)
        y_class = np.array([s[2] for s in samples], dtype=int) if samples else np.array([], dtype=int)
        y_reg = np.array([s[3] for s in samples], dtype=float) if samples else np.array([], dtype=float)

        return X, y_class, y_reg

    # -------------------------------------------------
    # True Time-Based Split + Train
    # -------------------------------------------------
    def train(self, db: Session, tenant_id: int):
        X, y_class, y_reg = self.build_dataset(db, tenant_id)

        n = int(len(X)) if X is not None else 0
        self._train_info = {"trained": False, "samples": n, "reason": None}
        self._is_trained = False

        if n < 10:
            self._train_info["reason"] = "insufficient_training_samples"
            return

        split_index = int(n * 0.8)
        if split_index <= 0 or split_index >= n:
            self._train_info["reason"] = "invalid_time_split"
            return

        X_train = X[:split_index]
        y_train_class = y_class[:split_index]
        y_train_reg = y_reg[:split_index]

        unique_classes = set(int(x) for x in y_train_class.tolist())
        if len(unique_classes) < 2:
            self._train_info["reason"] = "single_class_training_data"
            return

        self.classifier.fit(X_train, y_train_class)
        self.regressor.fit(X_train, y_train_reg)

        self._is_trained = True
        self._train_info["trained"] = True

    # -------------------------------------------------
    # Forecast Current State
    # -------------------------------------------------
    def forecast(self, db: Session, tenant_id: int):
        risks = db.query(Risk).filter(Risk.tenant_id == tenant_id).all()
        now = self._utcnow()

        for r in risks:
            features = self._build_features_at_time(db, r, now)
            X = np.array([features], dtype=float)

            prob = 0.0
            delta = 0.0
            explanation = {}

            if self._is_trained:
                try:
                    proba = self.classifier.predict_proba(X)
                    if proba.shape[1] == 2:
                        prob = float(proba[0][1])
                    else:
                        cls = int(self.classifier.classes_[0])
                        prob = 1.0 if cls == 1 else 0.0

                    delta = float(self.regressor.predict(X)[0])

                    explanation = {
                        "mode": "rf",
                        "train_info": self._train_info,
                        "feature_importance": dict(
                            zip(self.FEATURE_NAMES, self.classifier.feature_importances_.tolist())
                        ),
                    }
                except NotFittedError:
                    prob = self._baseline_prob(r.score or 0.0)
                    delta = 0.0
                    explanation = {
                        "mode": "baseline",
                        "reason": "model_not_fitted",
                        "train_info": self._train_info,
                        "features": dict(zip(self.FEATURE_NAMES, features)),
                    }
                except Exception as e:
                    prob = self._baseline_prob(r.score or 0.0)
                    delta = 0.0
                    explanation = {
                        "mode": "baseline",
                        "reason": "ml_exception",
                        "error": str(e),
                        "train_info": self._train_info,
                        "features": dict(zip(self.FEATURE_NAMES, features)),
                    }
            else:
                prob = self._baseline_prob(r.score or 0.0)
                delta = 0.0
                explanation = {
                    "mode": "baseline",
                    "reason": self._train_info.get("reason") or "not_trained",
                    "train_info": self._train_info,
                    "features": dict(zip(self.FEATURE_NAMES, features)),
                }

            forecast = RiskForecast(
                tenant_id=tenant_id,
                risk_id=r.id,
                model_version=self.model_version if self._is_trained else "baseline-v1",
                escalation_probability_30d=float(prob),
                expected_score_delta=float(delta),
                explanation=explanation,
            )

            db.add(forecast)

        db.commit()