"use client";

import { useEffect, useState } from "react";

interface Evidence {
  id: number;
  title: string;
  status: string;
  relation_reason: string;
  relation_source: string;
}

interface Props {
  riskId: number;
}

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  waiting_approval: "bg-yellow-100 text-yellow-700",
  uploaded: "bg-blue-100 text-blue-700",
};

const sourceColors: Record<string, string> = {
  manual: "bg-purple-100 text-purple-700",
  control_id: "bg-indigo-100 text-indigo-700",
  clause_id: "bg-cyan-100 text-cyan-700",
};

export default function RelatedControlsTab({ riskId }: Props) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/risks/${riskId}/related-evidences`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("Unable to load evidences.");
      }

      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (riskId) {
      loadData();
    }
  }, [riskId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Related Evidences
        </h2>

        <button
          onClick={loadData}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">
          No related evidences found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">

            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  ID
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Evidence
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Status
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Relation
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                  Reason
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">

              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    {item.id}
                  </td>

                  <td className="px-4 py-3 font-medium">
                    {item.title}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        statusColors[item.status] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        sourceColors[item.relation_source] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.relation_source}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {item.relation_reason}
                  </td>
                </tr>
              ))}

            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}
