"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch, logout } from "@/app/lib/auth";

type Role = { id: number; name: string };
type User = {
  id: number;
  email?: string;
  roles?: Role[];
};

export default function UserRoleModal({
  user,
  onClose,
  onUpdated,
}: {
  user: User;
  onClose: () => void;
  onUpdated: (u: any) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRoleId, setBusyRoleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userRoleIds = useMemo(() => {
    const ids = Array.isArray(user.roles) ? user.roles.map((r) => r.id) : [];
    return new Set(ids);
  }, [user]);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/roles");

      if (res.status === 401) {
        setError("Session expired. Please sign in again.");
        logout();
        return;
      }

      if (res.status === 403) {
        setError("Access denied. You do not have permission to manage roles.");
        return;
      }

      if (!res.ok) {
        setError(`Failed to load roles (HTTP ${res.status}).`);
        return;
      }

      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Unexpected error while loading roles.");
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    const res = await authFetch(`/users/${user.id}`);

    if (res.status === 401) {
      logout();
      return;
    }
    if (!res.ok) return;

    const updated = await res.json();
    onUpdated(updated);
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRole = async (roleId: number) => {
    setBusyRoleId(roleId);
    setError(null);

    try {
      const res = await authFetch(`/users/${user.id}/roles/${roleId}`, {
        method: "POST",
      });

      if (res.status === 401) {
        logout();
        return;
      }
      if (res.status === 403) {
        setError("Access denied.");
        return;
      }
      if (!res.ok) {
        setError(`Failed to assign role (HTTP ${res.status}).`);
        return;
      }

      await refreshUser();
    } catch (e) {
      console.error(e);
      setError("Unexpected error while assigning role.");
    } finally {
      setBusyRoleId(null);
    }
  };

  const removeRole = async (roleId: number) => {
    setBusyRoleId(roleId);
    setError(null);

    try {
      const res = await authFetch(`/users/${user.id}/roles/${roleId}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        logout();
        return;
      }
      if (res.status === 403) {
        setError("Access denied.");
        return;
      }
      if (!res.ok) {
        setError(`Failed to remove role (HTTP ${res.status}).`);
        return;
      }

      await refreshUser();
    } catch (e) {
      console.error(e);
      setError("Unexpected error while removing role.");
    } finally {
      setBusyRoleId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Manage Roles</h2>
            <p className="text-sm text-slate-400 truncate mt-1">
              {user.email || `User #${user.id}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
          >
            Close
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded border border-red-900/60 bg-red-950/40 text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-slate-300">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="text-slate-300">No roles found.</div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {roles.map((role) => {
                const hasRole = userRoleIds.has(role.id);
                const busy = busyRoleId === role.id;

                return (
                  <div
                    key={role.id}
                    className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{role.name}</div>
                      <div className="text-xs text-slate-500">Role ID: {role.id}</div>
                    </div>

                    {hasRole ? (
                      <button
                        disabled={busy}
                        onClick={() => removeRole(role.id)}
                        className="px-3 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 disabled:opacity-60"
                      >
                        {busy ? "Working..." : "Remove"}
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => addRole(role.id)}
                        className="px-3 py-1.5 rounded text-sm bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {busy ? "Working..." : "Add"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
