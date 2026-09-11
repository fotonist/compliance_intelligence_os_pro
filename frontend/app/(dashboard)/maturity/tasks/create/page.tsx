"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyMaturityTaskRoute() {
  const router = useRouter();
  useEffect(() => { router.replace("/company/tasks"); }, [router]);
  return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Maturity remediation is managed through the central Task Management workflow.</div>;
}
