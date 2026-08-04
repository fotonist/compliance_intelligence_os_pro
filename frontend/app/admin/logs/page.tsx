"use client";

import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type AuditLog = {
  id: number;
  user_email: string;
  action: string;
  entity?: string;
  entity_id?: number;
  detail?: string;
  timestamp: string;
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const normalizeLogs = (data: any): AuditLog[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.logs)) return data.logs;
    if (Array.isArray(data.items)) return data.items;
    return [];
  };

  const loadLogs = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API}/audit/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setLogs(normalizeLogs(data));
    } catch (err) {
      console.error("Audit load failed", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const params = new URLSearchParams();
      if (filterAction) params.append("action", filterAction);
      if (filterUser) params.append("user_email", filterUser);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await fetch(`${API}/audit/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setLogs(normalizeLogs(data));
    } catch (err) {
      console.error("Audit filter failed", err);
      setLogs([]);
    }
  };

  if (loading) return <p className="text-slate-300">Loading logs...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Activity Log</h1>

      {/* FILTER BAR */}
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            placeholder="User email"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="p-2 bg-slate-900 border border-slate-600 rounded w-full"
          />

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="p-2 bg-slate-900 border border-slate-600 rounded"
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="change_password">Password Change</option>
            <option value="assign_role">Assign Role</option>
            <option value="remove_role">Remove Role</option>
          </select>
        </div>

        <div className="flex gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 bg-slate-900 border border-slate-600 rounded w-full"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 bg-slate-900 border border-slate-600 rounded w-full"
          />
        </div>

        <button
          onClick={applyFilters}
          className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded"
        >
          Apply Filters
        </button>
      </div>

      {/* LOG LIST */}
      {logs.length === 0 ? (
        <div className="text-slate-400 text-sm">
          No audit logs found.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-800 p-4 rounded border border-slate-700"
            >
              <p className="text-white font-semibold">
                {log.user_email}{" "}
                <span className="text-xs text-slate-400">
                  ({log.action})
                </span>
              </p>

              {log.entity && (
                <p className="text-slate-300 text-sm">
                  {log.entity} #{log.entity_id}
                </p>
              )}

              {log.detail && (
                <p className="text-slate-400 text-sm mt-1">
                  {log.detail}
                </p>
              )}

              <p className="text-slate-500 text-xs mt-2">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
