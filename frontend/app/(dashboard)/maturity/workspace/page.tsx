"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MaturityWorkspaceEntry() {
  const router = useRouter();
  useEffect(() => { router.replace("/maturity"); }, [router]);
  return <div className="p-8 text-sm text-slate-500">Opening PAM Assessments...</div>;
}
