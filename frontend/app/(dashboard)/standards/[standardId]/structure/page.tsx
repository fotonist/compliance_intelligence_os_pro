"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

/* ================= TYPES ================= */

type Control = {
  id: number;
  code: string;
  title?: string;
};

type Requirement = {
  id: number;
  code: string;
  title?: string;
  controls: Control[];
};

type Clause = {
  id: number;
  code: string;
  title?: string;
  requirements: Requirement[];
};

type StructureResponse = {
  standard_id: number;
  standard_code: string;
  version: string;
  status: "draft" | "published" | "archived";
  type: "CONTROL_BASED";
  clauses: Clause[];
};

/* ================= HELPERS ================= */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export default function StandardStructurePage() {
  const { standardId } = useParams<{ standardId: string }>();
  const router = useRouter();

  const [data, setData] = useState<StructureResponse | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = data?.status === "draft";

  function toggle(key: string) {
    setOpen((p) => ({ ...p, [key]: !p[key] }));
  }

  async function fetchStructure() {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/standards/${standardId}/structure`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    setLoading(false);

    if (!res.ok) {
      setError("Failed to load structure");
      return;
    }

    const json = (await res.json()) as StructureResponse;
    setData(json);
  }

  useEffect(() => {
    if (!standardId) return;
    fetchStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardId]);

  function goClauseCreate() {
    router.push(`/standards/${standardId}/structure/clauses/create`);
  }

  function goRequirementCreate(clauseId: number) {
    router.push(
      `/standards/${standardId}/structure/clauses/${clauseId}/requirements/create`
    );
  }

  function goControlsList(clauseId: number, requirementId: number) {
    router.push(
      `/standards/${standardId}/structure/clauses/${clauseId}/requirements/${requirementId}/controls`
    );
  }

  if (loading && !data) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Standard Structure</h1>

        <button
          disabled={!isDraft}
          onClick={goClauseCreate}
          className={`text-sm px-3 py-1 rounded ${
            isDraft
              ? "bg-emerald-700 hover:bg-emerald-600 text-white"
              : "bg-slate-700 cursor-not-allowed text-slate-300"
          }`}
          title={!isDraft ? "Only draft standards can be edited" : ""}
        >
          + Add Clause
        </button>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-950/40 text-red-200 p-3 rounded">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-slate-400">No data</div>
      ) : (
        <div className="space-y-3">
          {data.clauses.map((c) => {
            const cOpen = !!open[`c-${c.id}`];

            return (
              <div key={c.id} className="border border-slate-800 rounded">
                <div
                  className="flex items-center justify-between px-4 py-2 bg-slate-900 cursor-pointer"
                  onClick={() => toggle(`c-${c.id}`)}
                >
                  <div className="font-medium">
                    {c.code} {c.title ? `— ${c.title}` : ""}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      disabled={!isDraft}
                      onClick={(e) => {
                        e.stopPropagation();
                        goRequirementCreate(c.id);
                      }}
                      className={`text-xs ${
                        isDraft
                          ? "text-emerald-400 hover:underline"
                          : "text-slate-500"
                      }`}
                    >
                      + Add Requirement
                    </button>

                    <span className="text-slate-400">{cOpen ? "−" : "+"}</span>
                  </div>
                </div>

                {cOpen && (
                  <div className="p-4 space-y-4">
                    {c.requirements.length === 0 ? (
                      <div className="text-slate-500 text-sm">
                        No requirements
                      </div>
                    ) : (
                      c.requirements.map((r) => (
                        <div key={r.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {r.code} {r.title ? `— ${r.title}` : ""}
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => goControlsList(c.id, r.id)}
                                className="text-xs text-sky-400 hover:underline"
                              >
                                View Controls
                              </button>

                              <button
                                disabled={!isDraft}
                                onClick={() =>
                                  router.push(
                                    `/standards/${standardId}/structure/clauses/${c.id}/requirements/${r.id}/controls/create`
                                  )
                                }
                                className={`text-xs ${
                                  isDraft
                                    ? "text-emerald-400 hover:underline"
                                    : "text-slate-500"
                                }`}
                              >
                                + Add Control
                              </button>
                            </div>
                          </div>

                          <ul className="pl-6 list-disc text-sm text-slate-400">
                            {r.controls?.map((ctl) => (
                              <li key={ctl.id}>
                                {ctl.code} {ctl.title ? `— ${ctl.title}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}