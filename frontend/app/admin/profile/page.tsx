"use client";

import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type ProfileUser = {
  email: string;
  full_name?: string;
  role?: string;
  roles?: any;
};

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Password form states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feedback messages
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // -------------------------------------------------------
  // LOAD PROFILE
  // -------------------------------------------------------
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const res = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Profile load error", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // -------------------------------------------------------
  // NORMALIZE ROLES (CRITICAL FIX)
  // -------------------------------------------------------
  const getRoles = (): string[] => {
    if (!user) return [];

    // Case 1: roles is already an array of strings
    if (Array.isArray(user.roles)) {
      if (typeof user.roles[0] === "string") {
        return user.roles;
      }

      // Case 2: roles is array of objects [{ name: "admin" }]
      if (typeof user.roles[0] === "object") {
        return user.roles.map((r: any) => r.name).filter(Boolean);
      }
    }

    // Case 3: single role field
    if (typeof user.role === "string") {
      return [user.role];
    }

    return [];
  };

  // -------------------------------------------------------
  // HANDLE PASSWORD CHANGE
  // -------------------------------------------------------
  const handleChangePassword = async () => {
    setMessage("");
    setError("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");

      const params = new URLSearchParams();
      params.append("old_password", oldPassword);
      params.append("new_password", newPassword);

      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: params,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Password change failed.");
        return;
      }

      setMessage("Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change password error", err);
      setError("Unexpected error.");
    }
  };

  if (loading) return <p className="text-slate-300">Loading profile...</p>;
  if (!user) return <p className="text-red-400">Failed to load profile.</p>;

  const roles = getRoles();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>

      {/* USER INFO CARD */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-2">
        <p className="text-lg font-semibold">{user.email}</p>
        <p className="text-slate-400">
          {user.full_name || "No full name"}
        </p>

        {/* ROLES */}
        <div className="flex flex-wrap gap-2 mt-3">
          {roles.length === 0 ? (
            <span className="text-xs text-slate-400">
              No roles assigned
            </span>
          ) : (
            roles.map((role) => (
              <span
                key={role}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  role === "admin"
                    ? "bg-red-600 border-red-700 text-white"
                    : "bg-slate-700 border-slate-600 text-slate-300"
                }`}
              >
                {role}
              </span>
            ))
          )}
        </div>
      </div>

      {/* CHANGE PASSWORD CARD */}
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-3">
          Change Password
        </h2>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="Current Password"
            className="w-full p-2 rounded bg-slate-900 border border-slate-600"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="New Password"
            className="w-full p-2 rounded bg-slate-900 border border-slate-600"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            className="w-full p-2 rounded bg-slate-900 border border-slate-600"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button
            onClick={handleChangePassword}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
          >
            Update Password
          </button>

          {message && <p className="text-green-400">{message}</p>}
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
