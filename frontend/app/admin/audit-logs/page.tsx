"use client";

import { useEffect, useState } from "react";
import { fetchAuditLogs } from "../../../services/admin";

type AuditLog = {
  id: number;
  actor_id: number | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: number | null;
  action: string;
  old_value: any;
  new_value: any;
  created_at: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityType, setEntityType] = useState("");

  async function load() {
    const data = await fetchAuditLogs(
      entityType ? { entity_type: entityType } : undefined
    );
    setLogs(data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      <div className="flex gap-2">
        <input
          placeholder="Entity type (Risk, Evidence, User)"
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-600 rounded"
        />
        <button
          onClick={load}
          className="px-3 py-1 bg-slate-700 rounded"
        >
          Filter
        </button>
      </div>

      <table className="w-full border border-slate-700 text-sm">
        <thead className="bg-slate-900">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Actor</th>
            <th className="p-2">Entity</th>
            <th className="p-2">Action</th>
            <th className="p-2">Changes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id} className="border-t border-slate-700">
              <td className="p-2">
                {new Date(l.created_at).toLocaleString()}
              </td>
              <td className="p-2">
                {l.actor_role || "—"} #{l.actor_id ?? ""}
              </td>
              <td className="p-2">
                {l.entity_type} {l.entity_id ?? ""}
              </td>
              <td className="p-2">{l.action}</td>
              <td className="p-2">
                <pre className="text-xs text-slate-400">
{JSON.stringify(
  { old: l.old_value, new: l.new_value },
  null,
  2
)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
