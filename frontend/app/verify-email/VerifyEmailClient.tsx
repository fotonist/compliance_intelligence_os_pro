"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://compliance-intelligence-os-pro-2.onrender.com";

type VerificationState = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] =
    useState<VerificationState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyEmail() {
      if (!token) {
        if (!cancelled) {
          setState("error");
          setError("The verification token is missing.");
        }
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/identity-verification/email/verify?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.detail ||
              "This verification link is invalid or has expired."
          );
        }

        if (!data?.verified) {
          throw new Error(
            "Email verification could not be completed."
          );
        }

        if (!cancelled) {
          setEmail(data.email ?? null);
          setState("success");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Email verification failed:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Email verification failed."
          );
          setState("error");
        }
      }
    }

    verifyEmail();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#102a43]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(460px,0.95fr)_minmax(520px,1.05fr)]">
        <aside className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_15%_12%,#ffffff_0%,rgba(255,255,255,0.92)_12%,transparent_34%),radial-gradient(circle_at_82%_82%,rgba(16,185,129,0.28)_0%,transparent_28%),linear-gradient(125deg,#ffffff_0%,#e7f4fb_28%,#72c8e8_55%,#1d5f91_76%,#102a43_100%)] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="absolute inset-0 opacity-[0.22] bg-[linear-gradient(rgba(15,42,67,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(15,42,67,0.18)_1px,transparent_1px)] bg-[size:48px_48px]" />

          <div className="relative z-10 p-12 xl:p-16">
            <div className="mb-14 inline-flex items-center">
              <Image
                src="/complianceos-pro-logo.png"
                alt="ComplianceOS Pro"
                width={91}
                height={90}
                priority
                className="h-[90px] w-[91px] object-contain"
              />
            </div>

            <div className="max-w-xl">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
                Governance & Intelligence Platform
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.04] tracking-[-0.04em] text-[#09243d] xl:text-5xl">
                Secure identity,
                <br />
                trusted governance.
              </h1>

              <p className="mt-6 max-w-lg text-[15px] font-medium leading-7 text-[#244863]">
                Verify your identity to securely access your
                organization&apos;s compliance workspace and
                intelligence platform.
              </p>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/40 px-12 py-6 text-xs font-medium text-slate-500 xl:px-16">
            ComplianceOS Pro · Secure enterprise access
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-[470px]">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <Image
                  src="/complianceos-pro-logo.png"
                  alt="ComplianceOS Pro"
                  width={220}
                  height={70}
                  priority
                  className="h-auto w-[200px] object-contain"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
              {state === "loading" && <LoadingState />}

              {state === "success" && (
                <SuccessState email={email} />
              )}

              {state === "error" && (
                <ErrorState error={error} />
              )}
            </div>

            <div className="mt-6 text-center text-[11px] leading-5 text-slate-400">
              Authorized access only. All authentication attempts
              are logged.
              <br />
              ISO 27001 · KVKK · GDPR aligned platform
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Loader2 size={22} className="animate-spin" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Verifying your email
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Please wait while we securely verify your email address.
      </p>

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <ShieldCheck size={18} />
        <span>Secure verification in progress</span>
      </div>
    </>
  );
}

function SuccessState({
  email,
}: {
  email: string | null;
}) {
  return (
    <>
      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={23} />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Email verified
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Your email address has been successfully verified.
      </p>

      {email && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          {email}
        </div>
      )}

      <a
        href="/login"
        className="group mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b5cff] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#084ed6]"
      >
        Continue to Sign In
        <ArrowRight
          size={17}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </a>
    </>
  );
}

function ErrorState({
  error,
}: {
  error: string | null;
}) {
  return (
    <>
      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <XCircle size={23} />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Verification failed
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        We could not verify your email address.
      </p>

      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
        {error ||
          "The verification link is invalid or has expired."}
      </div>

      <a
        href="/login"
        className="group mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Return to Sign In
        <ArrowRight
          size={17}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </a>
    </>
  );
}

export default function VerifyEmailClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
          <Loader2
            size={28}
            className="animate-spin text-blue-600"
          />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
