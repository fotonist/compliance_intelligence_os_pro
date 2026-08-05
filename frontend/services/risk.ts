// C:\Projects\compliance_app\frontend\services\risk.ts

/* ================= RISK SERVICE ================= */

// Backend localhost kuralı
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type RiskItem = {
  id: number;
  title: string;
  description?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  owner?: string | null;

  standard_id?: number | null;
  requirement_id?: number | null;
  clause_id?: number | null;
  control_id?: number | null;

  evidence_count?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};
export type RiskDetail = {
  id: number;
  title: string;
  description?: string | null;

  likelihood: number;
  impact: number;
  score: number;
  risk_level: string;

  treatment?: string | null;
  status?: string | null;
  action?: string | null;

  owner?: string | null;

  standard_id?: number | null;
  requirement_id?: number | null;
  clause_id?: number | null;
  control_id?: number | null;

  evidence_count?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
};

export type RisksListResponse = {
  items: RiskItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};


function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || localStorage.getItem("token");
}

function authHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function readText(res: Response) {
  try {
    return (await res.text()) || "";
  } catch {
    return "";
  }
}

/* ================= LIST ================= */

export async function fetchRisks(
  page: number = 1,
  pageSize: number = 20,
  status: "open" | "closed" | "all" = "open",
  search?: string
): Promise<RisksListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("page_size", String(pageSize));
  qs.set("status", status);
  if (search && search.trim()) qs.set("search", search.trim());

  const res = await fetch(`${API_URL}/risks?${qs.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await readText(res);
    throw new Error(`Failed to fetch risks: ${text}`);
  }

  const json = await res.json();

  // backend bazen array dönse bile kırılmasın
  if (Array.isArray(json)) {
    return {
      items: json as RiskItem[],
      total: (json as RiskItem[]).length,
      page: 1,
      page_size: (json as RiskItem[]).length,
      total_pages: 1,
    };
  }

  return {
    items: Array.isArray(json?.items) ? json.items : [],
    total: Number(json?.total || 0),
    page: Number(json?.page || page),
    page_size: Number(json?.page_size || pageSize),
    total_pages: Number(json?.total_pages || 1),
  };
}

/* ================= GET BY ID ================= */

export async function fetchRiskById(id: number): Promise<RiskDetail> {
  const res = await fetch(`${API_URL}/risks/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await readText(res);
    throw new Error(`Failed to fetch risk: ${text}`);
  }

  const json = await res.json();

  return {
    ...json,
    likelihood: json.likelihood ?? 0,
    impact: json.impact ?? 0,
    score: json.score ?? 0,
    risk_level: json.risk_level ?? "LOW",
  };
}

/* ================= CREATE / UPDATE / DELETE ================= */

export type RiskCreatePayload = {
  title: string;
  description?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  treatment?: string | null;
  status?: string | null;
  action?: string | null;

  control_id?: number | null;
  clause_id?: number | null;
  requirement_id?: number | null;
  standard_id?: number | null;

  source_type?: "CONTROL" | "EVIDENCE" | "REQUIREMENT" | "MATURITY" | null;
  source_id?: number | null;
};

export async function createRisk(payload: RiskCreatePayload) {
  const res = await fetch(`${API_URL}/risks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await readText(res);
    throw new Error(`Failed to create risk: ${text}`);
  }

  return res.json();
}

export type RiskUpdatePayload = Partial<RiskCreatePayload>;

export async function updateRisk(id: number, payload: RiskUpdatePayload) {
  const res = await fetch(`${API_URL}/risks/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await readText(res);
    throw new Error(`Failed to update risk: ${text}`);
  }

  return res.json();
}

export async function deleteRisk(id: number) {
  const res = await fetch(`${API_URL}/risks/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await readText(res);
    throw new Error(text || `Delete failed (${res.status})`);
  }

  return true;
}
