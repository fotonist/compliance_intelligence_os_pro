import { API_BASE } from "./config";

/* ================= EVIDENCE ================= */

export async function fetchEvidences(token?: string) {
  const res = await fetch(`${API_BASE}/evidences`, {
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch evidences");
  }

  return res.json();
}

export async function fetchEvidenceById(id: number, token?: string) {
  const res = await fetch(`${API_BASE}/evidences/${id}`, {
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch evidence");
  }

  return res.json();
}

/* ================= EVIDENCE ↔ RISK ================= */

/**
 * ❗ IMPORTANT
 * This function MUST receive a NUMBER.
 * Passing an object here caused `/risks/[object Object]` → 422 errors.
 */
export async function unlinkRiskFromEvidence(
  evidenceId: number,
  riskId: number,
  token?: string
) {
  const res = await fetch(
    `${API_BASE}/evidences/${evidenceId}/unlink-risk/${riskId}`,
    {
      method: "POST",
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
      credentials: "include",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to unlink risk from evidence");
  }

  return res.json();
}

/* ================= ⚠️ REMOVED ================= */
/*
  ❌ REMOVED ON PURPOSE:

  export async function unlinkRisk(risk: any) {
    return fetch(`${API_BASE}/risks/${risk}`, { method: "DELETE" });
  }

  This function caused:
  DELETE /risks/[object Object] → 422

  Risk deletion MUST live in `services/risk.ts`
  and MUST receive `riskId: number`.
*/
