"use client";

import { useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      router.replace("/login");
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="ml-2 rounded-md border border-slate-700 px-2 py-1 text-xs text-red-400 hover:bg-slate-800 hover:text-red-300"
      title="Logout"
    >
      Logout
    </button>
  );
}
