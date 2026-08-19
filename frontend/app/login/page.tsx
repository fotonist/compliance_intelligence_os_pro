"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const res = await fetch(`${API_BASE}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) throw new Error("Login failed");

      const data = await res.json();

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_type", data.token_type ?? "bearer");
      document.cookie = `access_token=${data.access_token}; path=/; SameSite=Lax`;

      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#102a43]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(460px,0.95fr)_minmax(520px,1.05fr)]">
        <aside className="relative hidden overflow-hidden bg-[#061426] lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative z-10 p-12 xl:p-16">
            <div className="mb-12 inline-flex rounded-2xl bg-white px-5 py-4 shadow-2xl shadow-black/20">
              <Image
                src="/complianceos-logo.svg"
                alt="ComplianceOS Pro"
                width={260}
                height={80}
                priority
                className="h-auto w-[230px] object-contain"
              />
            </div>

            <div className="max-w-xl">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
                Governance &amp; Intelligence Platform
              </div>
              <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Compliance intelligence,
                <br />
                built for enterprise governance.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
                A unified operating environment for standards, controls, risks,
                evidence, internal audit and executive compliance intelligence.
              </p>
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
              <Feature label="Risk Intelligence" />
              <Feature label="Control Governance" />
              <Feature label="Audit Readiness" />
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 px-12 py-6 text-xs text-slate-500 xl:px-16">
            ComplianceOS Pro · Secure enterprise access
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-[470px]">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <Image
                  src="/complianceos-logo.svg"
                  alt="ComplianceOS Pro"
                  width={220}
                  height={70}
                  priority
                  className="h-auto w-[200px] object-contain"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
              <div className="mb-8">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <LockKeyhole size={21} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Sign in to ComplianceOS
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Access your organization&apos;s compliance workspace and
                  intelligence dashboard.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Password
                    </label>
                    <span className="text-[11px] text-slate-400">Secure authentication</span>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b5cff] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#084ed6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Authenticating…" : "Sign In"}
                  {!loading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>

              <div className="mt-7 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
                <SecurityItem icon={<ShieldCheck size={15} />} text="Role-based access" />
                <SecurityItem icon={<CheckCircle2 size={15} />} text="Audit logging enabled" />
              </div>
            </div>

            <div className="mt-6 text-center text-[11px] leading-5 text-slate-400">
              Authorized access only. All authentication attempts are logged.
              <br />
              ISO 27001 · KVKK · GDPR aligned platform
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-medium text-slate-300">
      <div className="mb-2 h-1.5 w-6 rounded-full bg-emerald-400" />
      {label}
    </div>
  );
}

function SecurityItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
      <span className="text-emerald-500">{icon}</span>
      {text}
    </div>
  );
}
