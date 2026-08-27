"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PolicyDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const policyId = params?.policyId;

    if (policyId) {
      router.replace(`/governance?policyId=${policyId}`);
    } else {
      router.replace("/governance");
    }
  }, [router, params]);

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] text-sm text-slate-500">
        Opening policy...
      </div>
    </div>
  );
}
