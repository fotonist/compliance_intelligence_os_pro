"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyMaturityProcessAreaRoute() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");
  useEffect(() => { if (id) router.replace(`/maturity/workspace/${id}`); }, [id, router]);
  return <div className="p-8 text-sm text-slate-500">Opening PAM Assessment Workspace...</div>;
}
