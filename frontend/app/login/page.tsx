"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

      // ✅ Token storage
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem(
        "token_type",
        data.token_type ?? "bearer"
      );

      // ⚠️ Dev cookie (middleware / POC)
      document.cookie = `access_token=${data.access_token}; path=/; SameSite=Lax`;

      router.replace("/matrix");
    } catch (err) {
      console.error(err);
      setError(
        "Authentication failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* LEFT */}
      <aside className="hidden lg:flex w-[420px] flex-col justify-between bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 p-10">
        <div>
          <h1 className="text-2xl font-bold mb-4">
            Compliance Automation
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Integrated platform for risk, control and evidence
            management aligned with ISO&nbsp;27001, KVKK and GDPR.
          </p>
        </div>

        <div className="text-xs text-slate-500 space-y-2">
          <p>🔒 Secure access</p>
          <p>🧾 Audit logging enabled</p>
          <p>🛡 Role-based authorization</p>
        </div>
      </aside>

      {/* RIGHT */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-1">
            Sign In
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Authorized access only. All attempts are logged.
          </p>

          {error && (
            <div className="mb-4 rounded bg-red-900/40 border border-red-800 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Corporate Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded bg-blue-600 hover:bg-blue-500 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Authenticating…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">
            This system operates under ISO&nbsp;27001, KVKK and GDPR.
            Unauthorized access attempts are logged.
          </div>
        </div>
      </main>
    </div>
  );
}
