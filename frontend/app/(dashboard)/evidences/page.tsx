"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function normalize(value?: string | null) {
  return (value || "").toLowerCase().trim();
}

function statusLabel(value?: string | null) {
  const v = normalize(value);
  if (v === "waiting_approval") return "Pending Review";
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  if (v === "uploaded") return "Uploaded";
  if (v === "draft") return "Draft";
  return value || "—";
}

function statusStyle(value?: string | null) {
  const v = normalize(value);
  if (v === "approved" || v === "achieved") {
    return { background: "#ecfdf3", border: "#b7ebc9", color: "#167a3d" };
  }
  if (v === "waiting_approval" || v === "partially_achieved" || v === "partial") {
    return { background: "#fff8e6", border: "#f3d48b", color: "#9a6700" };
  }
  if (v === "rejected") {
    return { background: "#fff1f1", border: "#f1b6b6", color: "#b42318" };
  }
  return { background: "#f4f6f8", border: "#d8dee6", color: "#526071" };
}

function StatusBadge({ value }: { value?: string | null }) {
  const s = statusStyle(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: s.background,
        border: `1px solid ${s.border}`,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(value)}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e1e7ef",
        borderRadius: 14,
        padding: "16px 18px",
        minHeight: 92,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7788", fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, lineHeight: 1, fontWeight: 800, color: "#102a43" }}>{value}</div>
      {hint && <div style={{ marginTop: 7, fontSize: 11, color: "#8a95a5" }}>{hint}</div>}
    </div>
  );
}

export default function EvidencesPage() {
  const router = useRouter();
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
      const res = await apiFetch(`/company/evidences/?page=${page}&page_size=${pageSize}`, { method: "GET" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load evidences");
      }
      const json = (await res.json()) as EvidencePagedResponse;
      setItems(Array.isArray(json.items) ? json.items : []);
      setTotal(Number(json.total || 0));
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      setErr(e?.message || "Failed to load evidences");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter && normalize(item.status) !== statusFilter) return false;
      if (!query) return true;

      const text = [
        item.evidence_title,
        item.standard?.code,
        item.standard?.title,
        item.requirement?.code,
        item.requirement?.title,
        item.control?.code,
        item.control?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [items, q, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const approvedCount = filtered.filter((x) => normalize(x.status) === "approved").length;
  const pendingCount = filtered.filter((x) => normalize(x.status) === "waiting_approval").length;
  const orphanCount = filtered.filter((x) => Number(x.related_risks_count || 0) === 0).length;

  return (
    <div style={{ minHeight: "100%", background: "#f7f9fc", padding: "32px 36px 48px" }}>
      <div style={{ maxWidth: 1380, margin: "0 auto" }}>
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: "#102a43" }}>Evidence Library</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "#66758a" }}>
            Central register of compliance evidence, files, coverage and related risks.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 22 }}>
          <Kpi label="Total Evidence" value={total} />
          <Kpi label="Approved" value={approvedCount} hint="Current result set" />
          <Kpi label="Pending Review" value={pendingCount} hint="Current result set" />
          <Kpi label="Without Risk Link" value={orphanCount} hint="Current result set" />
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e1e7ef",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 380px", maxWidth: 520 }}>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search evidence, standard, requirement or control..."
              style={{
                width: "100%",
                height: 42,
                boxSizing: "border-box",
                border: "1px solid #d7dee8",
                borderRadius: 10,
                padding: "0 13px",
                outline: "none",
                color: "#243b53",
                background: "#ffffff",
                fontSize: 14,
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ height: 42, minWidth: 170, border: "1px solid #d7dee8", borderRadius: 10, padding: "0 12px", background: "#ffffff", color: "#243b53", fontSize: 14 }}
          >
            <option value="">All Status</option>
            <option value="uploaded">Uploaded</option>
            <option value="waiting_approval">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={load}
            disabled={loading}
            style={{
              height: 42,
              padding: "0 17px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: loading ? "#f1f4f8" : "#ffffff",
              color: "#173b63",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {err && (
          <div style={{ marginBottom: 16, padding: 13, borderRadius: 10, border: "1px solid #f1b6b6", background: "#fff5f5", color: "#b42318", whiteSpace: "pre-wrap", fontSize: 13 }}>
            {err}
          </div>
        )}

        <div style={{ background: "#ffffff", border: "1px solid #e1e7ef", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "17px 18px", borderBottom: "1px solid #e8edf3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#173b63" }}>Evidence Register</div>
              <div style={{ marginTop: 3, fontSize: 12, color: "#7a8798" }}>Select an evidence record to inspect files, versions and linked risks.</div>
            </div>
            <div style={{ fontSize: 12, color: "#7a8798" }}>{total} record{total === 1 ? "" : "s"}</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Evidence",
                    "Standard",
                    "Requirement",
                    "Control",
                    "Status",
                    "Coverage",
                    "Files",
                    "Risks",
                    "Action",
                  ].map((heading) => (
                    <th key={heading} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#68788c", borderBottom: "1px solid #e8edf3", whiteSpace: "nowrap" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#7a8798" }}>Loading evidence records...</td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 44, textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#334e68" }}>No evidence found</div>
                      <div style={{ marginTop: 5, fontSize: 13, color: "#8290a2" }}>
                        {total === 0 ? "No evidence records exist for this company yet." : "Try changing the search or status filter."}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && filtered.map((item) => (
                  <tr
                    key={item.evidence_id}
                    onClick={() => router.push(`/evidences/${item.evidence_id}`)}
                    style={{ borderBottom: "1px solid #edf1f5", cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fbff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    <td style={{ padding: "14px", color: "#173b63", fontWeight: 750 }}>
                      <div>{item.evidence_title || `Evidence #${item.evidence_id}`}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: "#8a95a5", fontWeight: 500 }}>ID: {item.evidence_id}</div>
                    </td>
                    <td style={{ padding: "14px", color: "#425466", fontSize: 13 }}>{item.standard?.code || "—"}</td>
                    <td style={{ padding: "14px", color: "#425466", fontSize: 13 }}>{item.requirement?.code || "—"}</td>
                    <td style={{ padding: "14px", color: "#425466", fontSize: 13 }}>{item.control?.code || "—"}</td>
                    <td style={{ padding: "14px" }}><StatusBadge value={item.status} /></td>
                    <td style={{ padding: "14px" }}><StatusBadge value={item.coverage_status || item.coverage} /></td>
                    <td style={{ padding: "14px", color: "#243b53", fontWeight: 700 }}>{item.files_count ?? 0}</td>
                    <td style={{ padding: "14px", color: "#243b53", fontWeight: 700 }}>{item.related_risks_count ?? 0}</td>
                    <td style={{ padding: "14px" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/evidences/${item.evidence_id}`);
                        }}
                        style={{ border: 0, background: "transparent", color: "#1769aa", fontWeight: 750, cursor: "pointer", padding: 0 }}
                      >
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "14px 18px", borderTop: "1px solid #e8edf3", display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid #d7dee8", background: page <= 1 ? "#f6f8fa" : "#ffffff", color: page <= 1 ? "#a0aab6" : "#334e68", cursor: page <= 1 ? "not-allowed" : "pointer", fontWeight: 700 }}
            >
              Previous
            </button>
            <span style={{ fontSize: 13, color: "#68788c" }}>Page {page} / {pageCount}</span>
            <button
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid #d7dee8", background: page >= pageCount ? "#f6f8fa" : "#ffffff", color: page >= pageCount ? "#a0aab6" : "#334e68", cursor: page >= pageCount ? "not-allowed" : "pointer", fontWeight: 700 }}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "#8a95a5" }}>
          Data source: <code>/company/evidences/?page=…</code>
        </div>
      </div>
    </div>
  );
}
