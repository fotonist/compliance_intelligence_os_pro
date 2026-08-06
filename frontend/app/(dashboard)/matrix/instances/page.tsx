"use client";

import { Suspense } from "react";
import MatrixInstancesContent from "./MatrixInstancesContent";

export default function MatrixInstancesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <MatrixInstancesContent />
    </Suspense>
  );
}
