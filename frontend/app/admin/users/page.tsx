"use client";

import { useEffect, useMemo, useState } from "react";


import {
  fetchUsers,
  fetchRoles,
  updateUserRoles,
} from "../../../services/admin";

type Role = {
  id: number;
  name: string;
};

type User = {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;

  is_active: boolean;
  is_locked: boolean;

  mfa_enabled: boolean;

  last_login_at?: string;

  roles: Role[];
};

export default function AdminUsersPage() {
const [editedRoles, setEditedRoles] = useState<number[]>([]);
const [message, setMessage] = useState<{
  type: "success" | "error";
  text: string;
} | null>(null);

const [savingRoles, setSavingRoles] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);
const [roleEditorOpen, setRoleEditorOpen] = useState(false);
 async function load() {

  setLoading(true);

  try {

    const [u, r] = await Promise.all([
      fetchUsers(),
      fetchRoles(),
    ]);

    setUsers(u);
    setRoles(r);

    if (u.length > 0) {

      const selected =
        selectedUser
          ? u.find(x => x.id === selectedUser.id)
          : u[0];

      setSelectedUser(selected ?? u[0]);
    }

  } catch (err) {

    console.error(err);

    setMessage({
      type: "error",
      text: "Failed to load users or roles."
    });

  } finally {

    setLoading(false);

  }

}
async function saveRoles() {

  if (!selectedUser) return;

  console.log("editedRoles =", editedRoles);

  setSavingRoles(true);

  try {

    await updateUserRoles(
      selectedUser.id,
      editedRoles
    );

    await load();

    setRoleEditorOpen(false);

    setMessage({
  type: "success",
  text: "User roles updated successfully."
});

  } catch (err) {

    console.error(err);

    setMessage({
  type: "error",
  text: "Failed to update user roles."
});

  } finally {

    setSavingRoles(false);

  }

}
  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {

    return users.filter((u) => {

      const value =
        `${u.email} ${u.full_name ?? ""}`.toLowerCase();

      return value.includes(search.toLowerCase());

    });

  }, [users, search]);

  if (loading) {

    return (
      <div className="p-8 text-slate-400">
        Loading users...
      </div>
    );

  }

  return (

    <div className="h-full flex">

      <aside className="w-96 border-r border-slate-800 bg-slate-950">

        <div className="p-5 border-b border-slate-800">

          <h1 className="text-2xl font-semibold">

            User Management

          </h1>

          <input
            className="mt-4 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Search user..."
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
          />

        </div>

        <div className="overflow-y-auto">

          {filteredUsers.map(user=>(
            <button

              key={user.id}

              onClick={()=>setSelectedUser(user)}

              className={`

                w-full
                border-b
                border-slate-800
                p-4
                text-left

                ${
                  selectedUser?.id===user.id
                    ? "bg-slate-900"
                    : "hover:bg-slate-900/50"
                }

              `}

            >

              <div className="font-medium">

                {user.full_name || user.email}

              </div>

              <div className="text-sm text-slate-400">

                {user.email}

              </div>

            </button>
          ))}

        </div>

      </aside>
	        <main className="flex-1 bg-slate-950">

        {!selectedUser ? (

          <div className="flex h-full items-center justify-center text-slate-500">

            Select a user

          </div>

        ) : (

          <div className="h-full">

            <div className="border-b border-slate-800 p-8">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-3xl font-semibold">

                    {selectedUser.full_name || selectedUser.email}

                  </h2>

                  <div className="mt-2 text-slate-400">

                    {selectedUser.email}

                  </div>

                </div>

                <div className="flex gap-2">

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium

                    ${
                      selectedUser.is_active
                        ? "bg-emerald-700/30 text-emerald-300"
                        : "bg-red-700/30 text-red-300"
                    }`}
                  >

                    {selectedUser.is_active
                      ? "ACTIVE"
                      : "DISABLED"}

                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium

                    ${
                      selectedUser.is_locked
                        ? "bg-red-700/30 text-red-300"
                        : "bg-sky-700/30 text-sky-300"
                    }`}
                  >

                    {selectedUser.is_locked
                      ? "LOCKED"
                      : "UNLOCKED"}

                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium

                    ${
                      selectedUser.mfa_enabled
                        ? "bg-violet-700/30 text-violet-300"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >

                    {selectedUser.mfa_enabled
                      ? "MFA ENABLED"
                      : "NO MFA"}

                  </span>

                </div>

              </div>

            </div>

            <div className="grid grid-cols-3 gap-6 p-8">

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

                <div className="mb-5 text-sm uppercase tracking-wider text-slate-400">

                  Identity

                </div>

                <div className="space-y-4">

                  <Field
                    label="Full Name"
                    value={selectedUser.full_name ?? "-"}
                  />

                  <Field
                    label="Email"
                    value={selectedUser.email}
                  />

                  <Field
                    label="Phone"
                    value={selectedUser.phone ?? "-"}
                  />

                </div>

              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

                <div className="mb-5 text-sm uppercase tracking-wider text-slate-400">

                  Security

                </div>

                <div className="space-y-4">

                  <Field
                    label="Account"
                    value={
                      selectedUser.is_active
                        ? "Enabled"
                        : "Disabled"
                    }
                  />

                  <Field
                    label="Locked"
                    value={
                      selectedUser.is_locked
                        ? "Yes"
                        : "No"
                    }
                  />

                  <Field
                    label="MFA"
                    value={
                      selectedUser.mfa_enabled
                        ? "Enabled"
                        : "Disabled"
                    }
                  />

                  <Field
                    label="Last Login"
                    value={
                      selectedUser.last_login_at ?? "-"
                    }
                  />

                </div>

              </div>
			                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

                <div className="flex items-center justify-between">

                  <div className="text-sm uppercase tracking-wider text-slate-400">

                    Assigned Roles

                  </div>

                  <button
  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
  onClick={() => {

    if (!selectedUser) return;

    setEditedRoles(
      selectedUser.roles.map((r) => r.id)
    );

    setRoleEditorOpen(true);

  }}
>
  Edit Roles
</button>

                </div>

                <div className="mt-6 flex flex-wrap gap-2">

                  {selectedUser.roles.length === 0 && (

                    <span className="text-slate-500">

                      No role assigned

                    </span>

                  )}

                  {selectedUser.roles.map((role) => (

                    <span

                      key={role.id}

                      className="rounded-full border border-sky-700 bg-sky-900/30 px-3 py-1 text-sm text-sky-300"

                    >

                      {role.name}

                    </span>

                  ))}

                </div>

                <div className="mt-8 border-t border-slate-800 pt-6">

                  <div className="mb-3 text-sm uppercase tracking-wider text-slate-400">

                    Available Roles

                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    {roles.map((role) => {

                      const assigned = selectedUser.roles.some(
                        (r) => r.id === role.id
                      );

                      return (

                        <div
                          key={role.id}
                          className={`
                            rounded-lg
                            border
                            p-3

                            ${
                              assigned
                                ? "border-emerald-700 bg-emerald-900/20"
                                : "border-slate-700 bg-slate-950"
                            }
                          `}
                        >

                          <div className="flex items-center justify-between">

                            <div>

                              <div className="font-medium">

                                {role.name}

                              </div>

                              <div className="text-xs text-slate-500">

                                Role

                              </div>

                            </div>

                            {assigned ? (

                              <span className="text-emerald-400">

                                Assigned

                              </span>

                            ) : (

                              <span className="text-slate-500">

                                Available

                              </span>

                            )}

                          </div>

                        </div>

                      );

                    })}

                  </div>

                </div>

              </div>

            </div>
			          </div>

        )}
{roleEditorOpen && selectedUser && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">

    <div className="w-[700px] rounded-xl bg-slate-900 border border-slate-700 p-6">

      <div className="flex items-center justify-between mb-6">

        <h2 className="text-2xl font-semibold">
          Edit Roles
        </h2>

        <button
          onClick={() => setRoleEditorOpen(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>

      </div>

      <div className="grid grid-cols-2 gap-3">

        {roles.map((role) => {

          const assigned =
            selectedUser.roles.some(r => r.id === role.id);

          return (

            <label
  key={role.id}
  className="flex items-center gap-3 rounded-lg border border-slate-700 p-3"
>

  <input
    type="checkbox"
    checked={editedRoles.includes(role.id)}
    onChange={(e) => {
      if (e.target.checked) {
        setEditedRoles((prev) =>
          prev.includes(role.id)
            ? prev
            : [...prev, role.id]
        );
      } else {
        setEditedRoles((prev) =>
          prev.filter((id) => id !== role.id)
        );
      }
    }}
  />

  {role.name}

</label>

          );

        })}

      </div>

      <div className="mt-8 flex justify-end gap-3">

  <button
    onClick={() => setRoleEditorOpen(false)}
    className="rounded bg-slate-700 px-4 py-2"
  >
    Cancel
  </button>

  <button
    onClick={saveRoles}
    disabled={savingRoles}
    className="rounded bg-sky-600 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {savingRoles ? "Saving..." : "Save"}
  </button>

</div>

    </div>

  </div>
  
)}
{message && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">

    <div className="w-[420px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">

      <div
        className={`px-6 py-4 text-lg font-semibold ${
          message.type === "success"
            ? "bg-emerald-600 text-white"
            : "bg-red-600 text-white"
        }`}
      >
        {message.type === "success"
          ? "Operation Successful"
          : "Operation Failed"}
      </div>

      <div className="px-6 py-6 text-slate-200">
        {message.text}
      </div>

      <div className="flex justify-end border-t border-slate-700 p-4">

        <button
          onClick={() => setMessage(null)}
          className="rounded-lg bg-sky-600 px-5 py-2 text-white hover:bg-sky-500"
        >
          OK
        </button>

      </div>

    </div>

  </div>
)}
      </main>

    </div>

  );
}

type FieldProps = {
  label: string;
  value: React.ReactNode;
};

function Field({
  label,
  value,
}: FieldProps) {

  return (

    <div className="space-y-1">

      <div className="text-xs uppercase tracking-wider text-slate-500">

        {label}

      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">

        {value}

      </div>

    </div>

  );

}