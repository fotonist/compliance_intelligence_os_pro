import { Suspense } from "react";
import MatrixInstancesClient from "./MatrixInstancesClient";

export default function MatrixInstancesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">
          Loading...
        </div>
      }
    >
      <MatrixInstancesClient />
    </Suspense>
  );
}
