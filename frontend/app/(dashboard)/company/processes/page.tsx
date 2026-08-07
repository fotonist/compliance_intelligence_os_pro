// frontend/app/(dashboard)/company/processes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import { TABLE } from "@/app/components/ui/tableTokens";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import IconButton from "@/app/components/ui/IconButton";

type ProcessType = "core" | "support" | "management";
type ProcessStatus = "draft" | "active" | "archived";

type ProcessRow = {
  id: number;
  code: string;
  name: string;
  type: ProcessType;
  owner: string;
  status: ProcessStatus;
  updated_at?: string | null;
};

const TYPE_LABEL: Record<ProcessType, string> = {
  core: "Core",
  support: "Support",
  management: "Management",
};

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : variant === "secondary"
      ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
      : "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-800";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function statusBadge(status: ProcessStatus) {
  if (status === "active")
    return <SeverityBadge label="Active" variant="success" />;
  if (status === "archived")
    return <SeverityBadge label="Archived" variant="info" />;
  return <SeverityBadge label="Draft" variant="warning" />;
}

export default function ProcessesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [q, setQ] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState<{
    code: string;
    name: string;
    type: ProcessType;
    owner: string;
    status: ProcessStatus;
  }>({
    code: "",
    name: "",
    type: "core",
    owner: "",
    status: "draft",
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(s) ||
        r.name.toLowerCase().includes(s) ||
        (r.owner || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch("/company/processes", { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        setRows(Array.isArray(json) ? json : json?.items || []);
      } else {
        setRows([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load processes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProcess() {
    if (!create.code.trim() || !create.name.trim()) {
      setError("Code and Name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch("/company/processes", {
        method: "POST",
        body: JSON.stringify(create),
      });
      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Create failed (${res.status})`);
      }
      setNotice("Created.");
      setShowCreate(false);
      setCreate({ code: "", name: "", type: "core", owner: "", status: "draft" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Processes</div>
          <div className="text-sm text-slate-400">
            Process catalog for linking risks, controls, evidence and KPIs
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={load}
            disabled={loading || saving}
          >
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            disabled={loading || saving}
          >
            + Create Process
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-700/40 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-300">Search</div>
          <div className="w-full max-w-md">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="code, name, owner..."
            />
          </div>
        </div>
      </div>

      {showCreate ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Create Process</div>
            <button
              className="text-sm text-slate-400 hover:text-slate-200"
              onClick={() => setShowCreate(false)}
              disabled={saving}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Code</div>
              <Input
                value={create.code}
                onChange={(e) => setCreate((p) => ({ ...p, code: e.target.value }))}
                placeholder="PRC-001"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Name</div>
              <Input
                value={create.name}
                onChange={(e) => setCreate((p) => ({ ...p, name: e.target.value }))}
                placeholder="Software Development"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Type</div>
              <Select
                value={create.type}
                onChange={(e) =>
                  setCreate((p) => ({ ...p, type: e.target.value as ProcessType }))
                }
              >
                <option value="core">Core</option>
                <option value="support">Support</option>
                <option value="management">Management</option>
              </Select>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Owner</div>
              <Input
                value={create.owner}
                onChange={(e) => setCreate((p) => ({ ...p, owner: e.target.value }))}
                placeholder="Role / Name"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Status</div>
              <Select
                value={create.status}
                onChange={(e) =>
                  setCreate((p) => ({
                    ...p,
                    status: e.target.value as ProcessStatus,
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreate(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={createProcess} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className={TABLE.container}>
        <table className="w-full">
          <thead className={TABLE.headerRow}>
            <tr>
              <th className={TABLE.headerCell}>Code</th>
              <th className={TABLE.headerCell}>Process</th>
              <th className={TABLE.headerCell}>Type</th>
              <th className={TABLE.headerCell}>Owner</th>
              <th className={TABLE.headerCell}>Status</th>
              <th className={TABLE.headerCell}>Updated</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr className={TABLE.row}>
                <td className={TABLE.cell} colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr className={TABLE.row}>
                <td className={TABLE.cell} colSpan={6}>
                  No processes found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className={TABLE.row}
                  onClick={() => router.push(`/company/processes/${r.id}`)}
                >
                  <td className={TABLE.cell}>
                    <div className="font-medium text-slate-100">{r.code}</div>
                  </td>
                  <td className={TABLE.cell}>
                    <div className="text-slate-100">{r.name}</div>
                  </td>
                  <td className={TABLE.cell}>{TYPE_LABEL[r.type]}</td>
                  <td className={TABLE.cell}>{r.owner || "-"}</td>
                  <td className={TABLE.cell}>{statusBadge(r.status)}</td>
                  <td className={TABLE.cell}>
                    {r.updated_at ? formatDate(r.updated_at) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(x: string) {
  try {
    const d = new Date(x);
    return d.toLocaleString();
  } catch {
    return x;
  }
}

async function safeText(res: Response) {
  try {
    const t = await res.text();
    return (t || "").slice(0, 400);
  } catch {
    return "";
  }
}
