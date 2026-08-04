"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";

type Standard = {
  id: number;
  code: string | null;
  name: string;
};

export default function ProcessStandardsPage() {
  const params = useParams();
  const processId = params?.processId as string;

  const [rows, setRows] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!processId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/company/processes/${processId}/standards`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch standards");
      }

      const data = await res.json();
      setRows(data || []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load related standards.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Related Standards</h1>
        <p className="text-sm text-slate-400">
          Automatically derived from linked risks and controls.
        </p>
      </div>

      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 bg-slate-900 px-4 py-3 text-sm font-medium">
          <div>Standard</div>
          <div>Reference</div>
        </div>

        {loading && (
          <div className="px-4 py-6 text-sm text-slate-400">
            Loading...
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-400">
            No links yet.
          </div>
        )}

        {!loading &&
          !error &&
          rows.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-800"
            >
              <div>{s.code ?? "-"}</div>
              <div>{s.name}</div>
            </div>
          ))}
      </div>
    </div>
  );
}