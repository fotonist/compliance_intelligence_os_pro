"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type EvidenceListItem = {
  evidence_id: number;
  evidence_title: string;
  status: string;
  files_count: number;
  related_risks_count: number;
  coverage?: string | null;
  coverage_status?: string | null;

  standard?: { code?: string | null; title?: string | null } | null;
  requirement?: { code?: string | null; title?: string | null } | null;
  control?: { code?: string | null; title?: string | null } | null;
};

type EvidencePagedResponse = {
  items: EvidenceListItem[];
  total: number;
  page: number;
  page_size: number;
};

function badgeBg(v?: string | null) {
  const x = (v || "").toLowerCase();
  if (x === "approved" || x === "achieved") return "rgba(34,197,94,0.18)";
  if (x === "waiting_approval") return "rgba(245,158,11,0.18)";
  if (x === "rejected") return "rgba(239,68,68,0.18)";
  if (x === "partially_achieved" || x === "partial") return "rgba(245,158,11,0.18)";
  if (x === "not_achieved" || x === "not_covered") return "rgba(148,163,184,0.12)";
  return "rgba(148,163,184,0.12)";
}

function badgeBorder(v?: string | null) {
  const x = (v || "").toLowerCase();
  if (x === "approved" || x === "achieved") return "rgba(34,197,94,0.35)";
  if (x === "waiting_approval") return "rgba(245,158,11,0.35)";
  if (x === "rejected") return "rgba(239,68,68,0.35)";
  if (x === "partially_achieved" || x === "partial") return "rgba(245,158,11,0.35)";
  if (x === "not_achieved" || x === "not_covered") return "rgba(148,163,184,0.22)";
  return "rgba(148,163,184,0.22)";
}

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: badgeBg(text),
        border: `1px solid ${badgeBorder(text)}`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function EvidencesPage() {
  const [items, setItems] = useState<EvidenceListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch(
        `/company/evidences?page=${page}&page_size=${pageSize}`,
        { method: "GET" }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load evidences");
      }

      const json = (await res.json()) as EvidencePagedResponse;
      setItems(json.items || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (items || []).filter((it) => {
      if (statusFilter && (it.status || "").toLowerCase() !== statusFilter) return false;

      if (!qq) return true;

      const blob = [
        it.evidence_title,
        it.standard?.code,
        it.standard?.title,
        it.requirement?.code,
        it.requirement?.title,
        it.control?.code,
        it.control?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(qq);
    });
  }, [items, q, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const kpiTotal = total;
  const kpiOrphan = useMemo(
    () => filtered.filter((x) => (x.related_risks_count || 0) === 0).length,
    [filtered]
  );
  const kpiApproved = useMemo(
    () => filtered.filter((x) => (x.status || "").toLowerCase() === "approved").length,
    [filtered]
  );

  return (
    <div style={{ padding: 28, maxWidth: 1200 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Evidence Library</h1>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          Control & Maturity evidences with files, coverage and risk links
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search evidence / standard / control..."
          style={{
            width: 360,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            outline: "none",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            outline: "none",
          }}
        >
          <option value="">All Status</option>
          <option value="uploaded">uploaded</option>
          <option value="waiting_approval">waiting_approval</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>

        <button
          onClick={() => load()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Kpi label="Total Evidences" value={String(kpiTotal)} />
        <Kpi label="Approved (filtered)" value={String(kpiApproved)} />
        <Kpi label="Orphan (no risk link)" value={String(kpiOrphan)} />
      </div>

      {err && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.10)",
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.02)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <Th>Evidence</Th>
              <Th>Standard</Th>
              <Th>Requirement</Th>
              <Th>Control</Th>
              <Th>Status</Th>
              <Th>Coverage</Th>
              <Th>Files</Th>
              <Th>Risks</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <Td colSpan={8} style={{ opacity: 0.8 }}>
                  Loading…
                </Td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <Td colSpan={8} style={{ opacity: 0.8 }}>
                  No evidence found.
                </Td>
              </tr>
            )}

            {!loading &&
              filtered.map((r) => (
                <tr key={r.evidence_id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Td style={{ fontWeight: 800 }}>
                    {r.evidence_id} — {r.evidence_title}
                  </Td>

                  <Td>
                    {(r.standard?.code || "-") + (r.standard?.title ? ` — ${r.standard.title}` : "")}
                  </Td>

                  <Td>
                    {(r.requirement?.code || "-") +
                      (r.requirement?.title ? ` — ${r.requirement.title}` : "")}
                  </Td>

                  <Td>
                    {(r.control?.code || "-") + (r.control?.title ? ` — ${r.control.title}` : "")}
                  </Td>

                  <Td>
                    <Badge text={r.status || "-"} />
                  </Td>

                  <Td>
                    <Badge text={r.coverage_status || r.coverage || "-"} />
                  </Td>

                  <Td>{r.files_count ?? 0}</Td>

                  <Td>{r.related_risks_count ?? 0}</Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={pagerBtn(page <= 1)}
        >
          Prev
        </button>

        <div style={{ opacity: 0.85 }}>
          Page <b>{page}</b> / {pageCount}
        </div>

        <button
          disabled={page >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          style={pagerBtn(page >= pageCount)}
        >
          Next
        </button>
      </div>

      <div style={{ marginTop: 12, opacity: 0.7 }}>
        Data source: <code>/company/evidences?page=…</code>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return (
    <th
      style={{
        padding: "10px 10px",
        fontSize: 12,
        opacity: 0.75,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan, style }: any) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "10px 10px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function pagerBtn(disabled: boolean) {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    fontWeight: 800,
  } as const;
}