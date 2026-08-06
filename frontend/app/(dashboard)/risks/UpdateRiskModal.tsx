"use client";
import type { RiskItem } from "../../../services/risk";
type Risk = {
  id: number;
  title: string;
  likelihood: number;
  impact: number;
  score?: number;
};

type Props = {
  risk: RiskItem;
  onClose: () => void;
  onUpdated: () => void;
};

export default function UpdateRiskModal({
  risk,
  onClose,
}: Props) {

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

      <div
        className="
          bg-slate-900
          w-[420px]
          rounded-lg
          border
          border-slate-700
          p-6
        "
      >

        <div className="text-xl font-semibold text-white mb-4">
          🔒 Risk Update Locked
        </div>


        <div className="text-sm text-slate-400 leading-relaxed">
          Risk modification is available only with the
          <span className="text-indigo-300">
            {" "}Risk Intelligence License.
          </span>
        </div>


        <div
          className="
            mt-5
            border
            border-slate-800
            rounded
            p-3
            bg-slate-950
            text-sm
          "
        >

          <div className="font-medium text-white">
            {risk.title}
          </div>


          <div className="text-xs text-slate-500 mt-2">
            Current Risk Score:
            {" "}
            {risk.score ?? ((risk.likelihood ?? 0) * (risk.impact ?? 0))}
          </div>


          <div className="text-xs text-slate-500 mt-1">
            Likelihood: {risk.likelihood ?? "-"}
            {" · "}
            Impact: {risk.impact ?? "-"}
          </div>

        </div>


        <div className="flex justify-end mt-5">

          <button
            onClick={onClose}
            className="
              px-4
              py-2
              border
              border-slate-600
              rounded
              text-slate-300
              hover:bg-slate-800
            "
          >
            Close
          </button>

        </div>

      </div>

    </div>
  );
}
