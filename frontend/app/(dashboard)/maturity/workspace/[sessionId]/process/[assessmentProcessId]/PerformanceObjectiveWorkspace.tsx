"use client";

import {
  Activity,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Plus,
  RefreshCw,
  Save,
  Target,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AchievementIndicator = {
  code: string;
  id: number;
  name: string;
  description?: string | null;
  indicator_type?: string | null;
  sort_order: number;
};

type PerformanceMeasurement = {
  id: number;
  objective_id: number;
  period_start?: string | null;
  period_end?: string | null;
  measured_value: number;
  target_value_snapshot?: number | null;
  variance?: number | null;
  achievement_result?: string | null;
  measurement_source?: string | null;
  evidence_id?: number | null;
  measured_by?: number | null;
  measured_at?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type PerformanceObjective = {
  id: number;
  tenant_id?: number;
  assessment_process_id: number;
  process_attribute_id: number;
  standard_indicator_id?: number | null;
  code: string;
  title: string;
  description?: string | null;
  measurement_method?: string | null;
  unit?: string | null;
  target_value?: number | null;
  direction?: string | null;
  owner_user_id?: number | null;
  status: string;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  measurement_count?: number;
  latest_measurement?: PerformanceMeasurement | null;
};

type ObjectiveDraft = {
  standard_indicator_id: string;
  title: string;
  description: string;
  measurement_method: string;
  unit: string;
  target_value: string;
  direction: string;
};

type MeasurementDraft = {
  period_start: string;
  period_end: string;
  measured_value: string;
  measurement_source: string;
  evidence_id: string;
  note: string;
};

type AssessmentContext = {
  standard_id: number;
  standard_version_id: number;
};

type EvidenceOption = {
  id: number;
  title: string;
  status?: string | null;
  assessment_type?: string | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
};

type EvidencePage = {
  items: EvidenceOption[];
  total: number;
  page: number;
  page_size: number;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

function formatValue(
  value?: number | null,
  unit?: string | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  return `${value}${unit ? ` ${unit}` : ""}`;
}

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

export default function PerformanceObjectiveWorkspace({
  assessmentId,
  assessmentProcessId,
  processAttributeId,
  attributeCode,
  indicators,
}: {
  assessmentId: number;
  assessmentProcessId: number;
  processAttributeId: number;
  attributeCode: string;
  indicators: AchievementIndicator[];
}) {
  const [objectives, setObjectives] = useState<
    PerformanceObjective[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evidenceOptions, setEvidenceOptions] =
    useState<EvidenceOption[]>([]);

  const [evidenceLoading, setEvidenceLoading] =
    useState(false);

  const [evidenceError, setEvidenceError] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [expanded, setExpanded] = useState<
    Record<number, boolean>
  >({});

  const [measurements, setMeasurements] =
    useState<
      Record<number, PerformanceMeasurement[]>
    >({});

  const [measurementLoading, setMeasurementLoading] =
    useState<Record<number, boolean>>({});

  const [measurementSaving, setMeasurementSaving] =
    useState<Record<number, boolean>>({});

  const [measurementDrafts, setMeasurementDrafts] =
    useState<Record<number, MeasurementDraft>>({});

  const [draft, setDraft] =
    useState<ObjectiveDraft>({
      standard_indicator_id:
        indicators[0]
          ? String(indicators[0].id)
          : "",
      title: "",
      description: "",
      measurement_method: "",
      unit: "%",
      target_value: "",
      direction: "AT_LEAST",
    });

  useEffect(() => {
    setDraft((current) => {
      if (
        current.standard_indicator_id ||
        !indicators[0]
      ) {
        return current;
      }

      return {
        ...current,
        standard_indicator_id:
          String(indicators[0].id),
      };
    });
  }, [indicators]);

  const indicatorMap = useMemo(
    () =>
      new Map(
        indicators.map((item) => [
          item.id,
          item,
        ])
      ),
    [indicators]
  );

  const loadObjectives =
    useCallback(async () => {
      const token = getToken();

      if (!token) {
        setError(
          "Authentication token is unavailable."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const url =
          `${API_BASE}/pam/assessments/` +
          `${assessmentId}/processes/` +
          `${assessmentProcessId}/` +
          `performance-objectives` +
          `?process_attribute_id=` +
          `${processAttributeId}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.text();

          throw new Error(
            body ||
              `Performance objective request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as
            PerformanceObjective[];

        setObjectives(data);
      } catch (err) {
        setObjectives([]);

        setError(
          err instanceof Error
            ? err.message
            : "Performance objectives could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, [
      assessmentId,
      assessmentProcessId,
      processAttributeId,
    ]);

  useEffect(() => {
    void loadObjectives();
  }, [loadObjectives]);

  const loadEvidenceOptions = useCallback(
    async () => {
      const token = getToken();

      if (!token) {
        setEvidenceOptions([]);
        setEvidenceError(
          "Authentication token is unavailable."
        );
        return;
      }

      setEvidenceLoading(true);
      setEvidenceError("");

      try {
        const contextResponse = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/context`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!contextResponse.ok) {
          const body = await contextResponse.text();

          throw new Error(
            body ||
              `Assessment context request failed: ${contextResponse.status}`
          );
        }

        const context =
          (await contextResponse.json()) as AssessmentContext;

        if (
          !Number.isInteger(context.standard_id) ||
          !Number.isInteger(
            context.standard_version_id
          )
        ) {
          throw new Error(
            "Assessment context does not contain a valid standard scope."
          );
        }

        const params = new URLSearchParams({
          page: "1",
          page_size: "100",
          assessment_type: "maturity",
          standard_id: String(
            context.standard_id
          ),
          standard_version_id: String(
            context.standard_version_id
          ),
        });

        const evidenceResponse = await fetch(
          `${API_BASE}/evidences?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!evidenceResponse.ok) {
          const body = await evidenceResponse.text();

          throw new Error(
            body ||
              `Evidence request failed: ${evidenceResponse.status}`
          );
        }

        const data =
          (await evidenceResponse.json()) as EvidencePage;

        const scopedItems = Array.isArray(data.items)
          ? data.items.filter(
              (item) =>
                item.assessment_type ===
                  "maturity" &&
                item.standard_id ===
                  context.standard_id &&
                item.standard_version_id ===
                  context.standard_version_id
            )
          : [];

        setEvidenceOptions(scopedItems);
      } catch (err) {
        setEvidenceOptions([]);

        setEvidenceError(
          err instanceof Error
            ? err.message
            : "Evidence options could not be loaded."
        );
      } finally {
        setEvidenceLoading(false);
      }
    },
    [assessmentId]
  );

  useEffect(() => {
    void loadEvidenceOptions();
  }, [loadEvidenceOptions]);

  const createObjective = async () => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is unavailable."
      );
      return;
    }

    if (!draft.title.trim()) {
      setError(
        "Objective title is required."
      );
      return;
    }

    if (!draft.standard_indicator_id) {
      setError(
        "Achievement criterion is required."
      );
      return;
    }

    const target =
      draft.target_value.trim() === ""
        ? null
        : Number(draft.target_value);

    if (
      target !== null &&
      !Number.isFinite(target)
    ) {
      setError(
        "Target value must be numeric."
      );
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/performance-objectives`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            process_attribute_id:
              processAttributeId,
            standard_indicator_id:
              Number(
                draft.standard_indicator_id
              ),
            title: draft.title.trim(),
            description:
              draft.description.trim() ||
              null,
            measurement_method:
              draft.measurement_method.trim() ||
              null,
            unit:
              draft.unit.trim() || null,
            target_value: target,
            direction:
              draft.direction || null,
            status: "active",
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Performance objective creation failed: ${response.status}`
        );
      }

      setDraft({
        standard_indicator_id:
          indicators[0]
            ? String(indicators[0].id)
            : "",
          title: "",
        description: "",
        measurement_method: "",
        unit: "%",
        target_value: "",
        direction: "AT_LEAST",
      });

      setShowCreate(false);

      await loadObjectives();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Performance objective could not be created."
      );
    } finally {
      setCreating(false);
    }
  };

  const loadMeasurements = async (
    objectiveId: number
  ) => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is unavailable."
      );
      return;
    }

    setMeasurementLoading((current) => ({
      ...current,
      [objectiveId]: true,
    }));

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/performance-objectives/${objectiveId}/measurements`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Measurement request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as
          PerformanceMeasurement[];

      setMeasurements((current) => ({
        ...current,
        [objectiveId]: data,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Measurements could not be loaded."
      );
    } finally {
      setMeasurementLoading(
        (current) => ({
          ...current,
          [objectiveId]: false,
        })
      );
    }
  };

  const toggleObjective = async (
    objectiveId: number
  ) => {
    const next = !expanded[objectiveId];

    setExpanded((current) => ({
      ...current,
      [objectiveId]: next,
    }));

    if (
      next &&
      !measurements[objectiveId]
    ) {
      await loadMeasurements(objectiveId);
    }
  };

  const getMeasurementDraft = (
    objectiveId: number
  ): MeasurementDraft =>
    measurementDrafts[objectiveId] || {
      period_start: "",
      period_end: "",
      measured_value: "",
      measurement_source: "",
      evidence_id: "",
      note: "",
    };

  const updateMeasurementDraft = (
    objectiveId: number,
    field: keyof MeasurementDraft,
    value: string
  ) => {
    setMeasurementDrafts((current) => ({
      ...current,
      [objectiveId]: {
        ...getMeasurementDraft(objectiveId),
        [field]: value,
      },
    }));
  };

  const getEvidenceOption = (
    evidenceId?: number | null
  ) => {
    if (!evidenceId) {
      return null;
    }

    return (
      evidenceOptions.find(
        (item) => item.id === evidenceId
      ) || null
    );
  };

  const addMeasurement = async (
    objective: PerformanceObjective
  ) => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is unavailable."
      );
      return;
    }

    const item =
      getMeasurementDraft(objective.id);

    const actual = Number(
      item.measured_value
    );

    if (
      item.measured_value.trim() === "" ||
      !Number.isFinite(actual)
    ) {
      setError(
        "Measured value must be numeric."
      );
      return;
    }

    const evidenceId =
      item.evidence_id.trim() === ""
        ? null
        : Number(item.evidence_id);

    setMeasurementSaving((current) => ({
      ...current,
      [objective.id]: true,
    }));

    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/performance-objectives/${objective.id}/measurements`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            period_start:
              item.period_start || null,
            period_end:
              item.period_end || null,
            measured_value: actual,
            measurement_source:
              item.measurement_source.trim() ||
              null,
            evidence_id: evidenceId,
            note:
              item.note.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Measurement creation failed: ${response.status}`
        );
      }

      setMeasurementDrafts(
        (current) => ({
          ...current,
          [objective.id]: {
            period_start: "",
            period_end: "",
            measured_value: "",
            measurement_source: "",
            evidence_id: "",
            note: "",
          },
        })
      );

      await Promise.all([
        loadMeasurements(objective.id),
        loadObjectives(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Measurement could not be created."
      );
    } finally {
      setMeasurementSaving(
        (current) => ({
          ...current,
          [objective.id]: false,
        })
      );
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-600" />

            <div className="text-sm font-semibold text-slate-950">
              Performance Objectives
            </div>
          </div>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Define measurable process performance objectives and record actual measurement results for {attributeCode}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void loadObjectives()
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              setShowCreate((value) => !value)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Objective
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            New Performance Objective
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 lg:col-span-2">
              Achievement Criterion
              <select
                value={
                  draft.standard_indicator_id
                }
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    standard_indicator_id:
                      event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
              >
                <option value="">
                  Select criterion
                </option>

                {indicators.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label="Objective Title"
              value={draft.title}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  title: value,
                }))
              }
            />

            <Field
              label="Measurement Method"
              value={draft.measurement_method}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  measurement_method: value,
                }))
              }
            />

            <Field
              label="Unit"
              value={draft.unit}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  unit: value,
                }))
              }
            />

            <Field
              label="Target Value"
              type="number"
              value={draft.target_value}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  target_value: value,
                }))
              }
            />

            <label className="text-xs font-medium text-slate-600">
              Direction
              <select
                value={draft.direction}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    direction:
                      event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
              >
                <option value="AT_LEAST">
                  At Least
                </option>
                <option value="AT_MOST">
                  At Most
                </option>
                <option value="EXACT">
                  Exact
                </option>
              </select>
            </label>

            <label className="text-xs font-medium text-slate-600 lg:col-span-2">
              Description
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={creating}
              onClick={() =>
                void createObjective()
              }
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {creating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Objective
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Loading performance objectives...
        </div>
      ) : objectives.length ? (
        <div className="mt-5 space-y-3">
          {objectives.map((objective) => {
            const indicator =
              objective.standard_indicator_id
                ? indicatorMap.get(
                    objective.standard_indicator_id
                  )
                : null;

            const latest =
              objective.latest_measurement;

            const items =
              measurements[objective.id] || [];

            const measurementDraft =
              getMeasurementDraft(objective.id);

            return (
              <div
                key={objective.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    void toggleObjective(
                      objective.id
                    )
                  }
                  className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {expanded[objective.id] ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {objective.code}
                        </span>

                        <span className="text-sm font-semibold text-slate-950">
                          {objective.title}
                        </span>
                      </div>

                      {indicator ? (
                        <div className="mt-2 text-xs text-slate-500">
                          {indicator.code} - {indicator.name}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400">
                        Target
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatValue(
                          objective.target_value,
                          objective.unit
                        )}
                      </div>
                    </div>

                    <ResultBadge
                      value={
                        latest?.achievement_result
                      }
                    />
                  </div>
                </button>

                {expanded[objective.id] ? (
                  <div className="border-t border-slate-200 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Info
                        label="Method"
                        value={
                          objective.measurement_method ||
                          "-"
                        }
                      />
                      <Info
                        label="Direction"
                        value={normalizeStatus(
                          objective.direction
                        )}
                      />
                      <Info
                        label="Status"
                        value={normalizeStatus(
                          objective.status
                        )}
                      />
                      <Info
                        label="Measurements"
                        value={String(
                          objective.measurement_count ||
                            0
                        )}
                      />
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-slate-500" />
                        <div className="text-sm font-semibold text-slate-900">
                          Record Measurement
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field
                          label="Period Start"
                          type="date"
                          value={
                            measurementDraft.period_start
                          }
                          onChange={(value) =>
                            updateMeasurementDraft(
                              objective.id,
                              "period_start",
                              value
                            )
                          }
                        />

                        <Field
                          label="Period End"
                          type="date"
                          value={
                            measurementDraft.period_end
                          }
                          onChange={(value) =>
                            updateMeasurementDraft(
                              objective.id,
                              "period_end",
                              value
                            )
                          }
                        />

                        <Field
                          label="Measured Value"
                          type="number"
                          value={
                            measurementDraft.measured_value
                          }
                          onChange={(value) =>
                            updateMeasurementDraft(
                              objective.id,
                              "measured_value",
                              value
                            )
                          }
                        />

                        <Field
                          label="Measurement Source"
                          value={
                            measurementDraft.measurement_source
                          }
                          onChange={(value) =>
                            updateMeasurementDraft(
                              objective.id,
                              "measurement_source",
                              value
                            )
                          }
                        />

                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            Evidence
                          </span>

                          <select
                            value={
                              measurementDraft.evidence_id
                            }
                            disabled={evidenceLoading}
                            onChange={(event) =>
                              updateMeasurementDraft(
                                objective.id,
                                "evidence_id",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            <option value="">
                              {evidenceLoading
                                ? "Loading evidence..."
                                : "No evidence selected"}
                            </option>

                            {evidenceOptions.map(
                              (evidence) => (
                                <option
                                  key={evidence.id}
                                  value={String(
                                    evidence.id
                                  )}
                                >
                                  {evidence.title}
                                  {evidence.status
                                    ? ` - ${normalizeStatus(
                                        evidence.status
                                      )}`
                                    : ""}
                                </option>
                              )
                            )}
                          </select>

                          {evidenceError ? (
                            <span className="mt-1.5 block text-xs text-rose-600">
                              {evidenceError}
                            </span>
                          ) : null}

                          {!evidenceLoading &&
                          !evidenceError &&
                          evidenceOptions.length ===
                            0 ? (
                            <span className="mt-1.5 block text-xs text-slate-400">
                              No maturity evidence is available for this standard version.
                            </span>
                          ) : null}
                        </label>

                        <Field
                          label="Note"
                          value={
                            measurementDraft.note
                          }
                          onChange={(value) =>
                            updateMeasurementDraft(
                              objective.id,
                              "note",
                              value
                            )
                          }
                        />
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={
                            measurementSaving[
                              objective.id
                            ]
                          }
                          onClick={() =>
                            void addMeasurement(
                              objective
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {measurementSaving[
                            objective.id
                          ] ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          Add Measurement
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Measurement History
                      </div>

                      {measurementLoading[
                        objective.id
                      ] ? (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Loading measurements...
                        </div>
                      ) : items.length ? (
                        <div className="mt-3 space-y-3">
                          {items.map((item) => {
                            const linkedEvidence =
                              getEvidenceOption(
                                item.evidence_id
                              );

                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-white p-4"
                              >
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Period
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-slate-700">
                                      {item.period_start ||
                                        "-"}
                                      {" - "}
                                      {item.period_end ||
                                        "-"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Actual
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900">
                                      {formatValue(
                                        item.measured_value,
                                        objective.unit
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Target
                                    </div>
                                    <div className="mt-1 text-sm text-slate-700">
                                      {formatValue(
                                        item.target_value_snapshot,
                                        objective.unit
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Variance
                                    </div>
                                    <div className="mt-1 text-sm text-slate-700">
                                      {formatValue(
                                        item.variance,
                                        objective.unit
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Result
                                    </div>
                                    <div className="mt-1">
                                      <ResultBadge
                                        value={
                                          item.achievement_result
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Source
                                    </div>
                                    <div className="mt-1 break-words text-sm text-slate-700">
                                      {item.measurement_source ||
                                        "-"}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Evidence
                                    </div>

                                    {item.evidence_id ? (
                                      linkedEvidence ? (
                                        <div className="mt-1">
                                          <div className="break-words text-sm font-medium text-slate-800">
                                            {linkedEvidence.title}
                                          </div>

                                          {linkedEvidence.status ? (
                                            <div className="mt-1 text-xs text-slate-400">
                                              {normalizeStatus(
                                                linkedEvidence.status
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-sm text-slate-500">
                                          Evidence #{item.evidence_id}
                                        </div>
                                      )
                                    ) : (
                                      <div className="mt-1 text-sm text-slate-400">
                                        -
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {item.note ? (
                                  <div className="mt-4 border-t border-slate-100 pt-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Note
                                    </div>
                                    <div className="mt-1 text-sm text-slate-600">
                                      {item.note}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-400">
                          No measurements have been recorded.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center">
          <Target className="mx-auto h-5 w-5 text-slate-400" />
          <div className="mt-2 text-sm font-medium text-slate-700">
            No performance objectives
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Add the first measurable objective for this process attribute.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400"
      />
    </label>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}

function ResultBadge({
  value,
}: {
  value?: string | null;
}) {
  if (value === "MET") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CircleCheck className="h-3.5 w-3.5" />
        Met
      </span>
    );
  }

  if (value === "NOT_MET") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <CircleX className="h-3.5 w-3.5" />
        Not Met
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
      No Result
    </span>
  );
}
