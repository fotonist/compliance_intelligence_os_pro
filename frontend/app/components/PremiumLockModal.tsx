"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { FEATURE_CONFIG } from "../config/features";
import { apiFetch } from "../lib/api";

type FeatureKey =
  | "aiRiskForecast"
  | "evidenceIntelligence"
  | "operationalIntelligence"
  | "executiveAnalytics";

type Props = {
  feature: FeatureKey;
  title: string;
  description: string;
  features: string[];
};

export default function PremiumFeatureCard({
  feature,
  title,
  description,
  features,
}: Props) {

  const [showRequest, setShowRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  async function submitRequest() {
  try {
    const res = await apiFetch(
      "/company/license/request",
      {
        method: "POST",
        body: JSON.stringify({
          module_code: feature.toUpperCase(),
          module_name: title,
        }),
      }
    );

    if (!res.ok) {
      throw new Error("Request failed");
    }

    setRequestSent(true);

  } catch (error) {
    console.error(
      "Premium request failed:",
      error
    );
  }
}
  const featureConfig = FEATURE_CONFIG[feature];

  function closeModal() {
    setShowRequest(false);
    setRequestSent(false);
  }


  return (
    <div
      className="
        border
        border-slate-700
        bg-slate-900
        rounded-xl
        p-6
        relative
        overflow-hidden
      "
    >

      {/* LICENSE BADGE */}
      <div
        className="
          absolute
          top-0
          right-0
          px-3
          py-1
          rounded-bl-xl
          bg-amber-500/20
          text-amber-300
          text-xs
          font-medium
        "
      >
        {featureConfig?.license || "Premium"}
      </div>


      {/* TITLE */}
      <div className="flex items-center gap-2">

        <Lock
          size={18}
          className="text-amber-300"
        />

        <h3 className="text-lg font-semibold text-white">
          {title}
        </h3>

      </div>


      {/* DESCRIPTION */}
      <p
        className="
          text-sm
          text-slate-400
          mt-4
          leading-relaxed
        "
      >
        {description}
      </p>


      <div
        className="
          mt-3
          text-xs
          text-slate-500
        "
      >
        Available with {featureConfig?.license || "Premium License"}
      </div>


      {/* FEATURES */}
      <div
        className="
          mt-5
          space-y-2
        "
      >

        {features.map((featureItem) => (

          <div
            key={featureItem}
            className="
              text-sm
              text-slate-300
            "
          >
            • {featureItem}
          </div>

        ))}

      </div>


      {/* REQUEST BUTTON */}
      <button
        onClick={() => setShowRequest(true)}
        className="
          mt-6
          w-full
          px-4
          py-2
          rounded-lg
          bg-indigo-600
          text-sm
          text-white
          hover:bg-indigo-500
          transition
        "
      >
        Request Activation
      </button>



      {/* ACTIVATION MODAL */}
      {showRequest && (

        <div
          className="
            fixed
            inset-0
            bg-black/80
            flex
            items-center
            justify-center
            z-50
          "
        >

          <div
            className="
              bg-slate-900
              border
              border-slate-700
              rounded-xl
              p-6
              w-[420px]
            "
          >

            {!requestSent ? (

              <>

                <h3 className="text-lg font-semibold text-white">
                  Premium Module Activation
                </h3>


                <p className="text-sm text-slate-400 mt-3">
                  This capability requires Premium License activation.
                </p>


                <div
                  className="
                    mt-4
                    rounded
                    bg-slate-950
                    border
                    border-slate-800
                    p-3
                  "
                >

                  <div className="text-xs text-slate-500">
                    Requested Module
                  </div>


                  <div className="text-white font-medium">
                    {title}
                  </div>

                </div>


                <div className="flex justify-end gap-3 mt-6">

                  <button
                    onClick={closeModal}
                    className="
                      px-4
                      py-2
                      rounded
                      border
                      border-slate-700
                      text-slate-300
                      hover:bg-slate-800
                    "
                  >
                    Cancel
                  </button>


                  <button
                    onClick={submitRequest}
                    className="
                      px-4
                      py-2
                      rounded
                      bg-indigo-600
                      text-white
                      hover:bg-indigo-500
                    "
                  >
                    Submit Request
                  </button>

                </div>

              </>

            ) : (

              <>

                <div
                  className="
                    rounded-lg
                    border
                    border-emerald-500/30
                    bg-emerald-500/10
                    p-4
                  "
                >

                  <div className="text-emerald-300 font-semibold">
                    ✓ Request Submitted
                  </div>


                  <div className="text-sm text-slate-400 mt-2">
                    Your activation request has been recorded.
                    Our team will review your request.
                  </div>

                </div>


                <button
                  onClick={closeModal}
                  className="
                    mt-5
                    w-full
                    px-4
                    py-2
                    rounded
                    bg-slate-700
                    text-white
                    hover:bg-slate-600
                  "
                >
                  Close
                </button>

              </>

            )}

          </div>

        </div>

      )}

    </div>
  );
}