"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = "http://localhost:8000";

export default function MaturityStructurePage() {
  const { standardId } = useParams();
  const [token, setToken] = useState("");

  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState<any | null>(null);
  const [practices, setPractices] = useState<any[]>([]);

  useEffect(() => {
    const t =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/standards/${standardId}/process-areas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setAreas);
  }, [token, standardId]);

  useEffect(() => {
    if (!token || !selectedArea) return;
    fetch(
      `${API_BASE}/standards/process-areas/${selectedArea.id}/practices`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then(setPractices);
  }, [token, selectedArea]);

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">
        Build Maturity Structure
      </h1>

      <div className="grid grid-cols-2 gap-4">
        {/* PROCESS AREAS */}
        <Panel title="Process Areas">
          {areas.map((pa) => (
            <Item
              key={pa.id}
              active={selectedArea?.id === pa.id}
              onClick={() => setSelectedArea(pa)}
            >
              {pa.code}
            </Item>
          ))}
        </Panel>

        {/* PRACTICES */}
        <Panel title="Practices">
          {practices.map((p) => (
            <div key={p.id} className="text-sm">
              {p.code}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <div className="border border-slate-800 rounded p-3">
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Item({ active, onClick, children }: any) {
  return (
    <div
      onClick={onClick}
      className={`px-2 py-1 rounded cursor-pointer ${
        active ? "bg-slate-800 font-semibold" : "hover:bg-slate-800"
      }`}
    >
      {children}
    </div>
  );
}
