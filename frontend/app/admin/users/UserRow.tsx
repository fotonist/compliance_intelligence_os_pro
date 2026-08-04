"use client";

type Role = { id: number; name: string };
type User = {
  id: number;
  email?: string;
  full_name?: string;
  is_active?: boolean;
  roles?: Role[];
};

export default function UserRow({
  user,
  onManageRoles,
}: {
  user: User;
  onManageRoles: () => void;
}) {
  const roles = user.roles || [];
  const active = user.is_active !== false;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="font-semibold truncate">
            {user.email || `User #${user.id}`}
          </div>

          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              active
                ? "bg-emerald-950/30 border-emerald-800 text-emerald-200"
                : "bg-slate-950/30 border-slate-700 text-slate-300"
            }`}
          >
            {active ? "Active" : "Inactive"}
          </span>
        </div>

        {user.full_name && (
          <div className="text-sm text-slate-400 mt-1 truncate">
            {user.full_name}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {roles.length === 0 ? (
            <span className="text-xs text-slate-500">No roles</span>
          ) : (
            roles.map((r) => (
              <span
                key={r.id}
                className="text-xs px-2 py-0.5 rounded-full border bg-slate-950/30 border-slate-700 text-slate-200"
              >
                {r.name}
              </span>
            ))
          )}
        </div>
      </div>

      <button
        onClick={onManageRoles}
        className="shrink-0 px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-sm"
      >
        Manage Roles
      </button>
    </div>
  );
}
