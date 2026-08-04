"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://127.0.0.1:8000";

type User = {
  id: number;
  email: string;
  full_name?: string;
  roles: { id: number; name: string }[];
};

type Role = {
  id: number;
  name: string;
};

export default function UserManagementPage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [assignRoleId, setAssignRoleId] = useState<number | null>(null);

  // Kullanıcı ve Rol verilerini yükle
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        setLoading(true);

        const u = await fetch(`${API_BASE}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usersData = await u.json();

        const r = await fetch(`${API_BASE}/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rolesData = await r.json();

        setUsers(usersData);
        setRoles(rolesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const assignRole = async () => {
    if (!selectedUser || !assignRoleId) return;

    const token = localStorage.getItem("access_token");
    await fetch(
      `${API_BASE}/users/${selectedUser.id}/roles/${assignRoleId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    refreshUsers();
    setSelectedUser(null);
    setAssignRoleId(null);
  };

  const removeRole = async (userId: number, roleId: number) => {
    const token = localStorage.getItem("access_token");

    await fetch(`${API_BASE}/users/${userId}/roles/${roleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    refreshUsers();
  };

  const refreshUsers = async () => {
    const token = localStorage.getItem("access_token");

    const u = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await u.json();
    setUsers(data);
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-semibold mb-6">User Management</h1>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading users...</div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-slate-900 border border-slate-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">{user.email}</p>
                  <p className="text-xs text-slate-400">{user.full_name}</p>
                </div>

                <button
                  onClick={() => setSelectedUser(user)}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm"
                >
                  Assign Role
                </button>
              </div>

              <div className="mt-3 flex gap-2 flex-wrap">
                {user.roles.length === 0 && (
                  <span className="text-slate-500 text-sm italic">
                    No roles assigned
                  </span>
                )}

                {user.roles.map((role) => (
                  <span
                    key={role.id}
                    className="bg-slate-800 px-2 py-1 rounded text-xs flex items-center gap-2"
                  >
                    {role.name}
                    <button
                      onClick={() => removeRole(user.id, role.id)}
                      className="text-red-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-900 p-6 rounded-lg w-96 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              Assign Role to {selectedUser.email}
            </h2>

            <select
              className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm"
              onChange={(e) => setAssignRoleId(Number(e.target.value))}
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={assignRole}
                disabled={!assignRoleId}
                className="px-4 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-sm disabled:opacity-40"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
