"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Edit3,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Vote,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Committee = {
  id: number;
  committee_code: string;
  name: string;
  committee_type: string;
  status: string;
  chairperson_id?: number | null;
  secretary_id?: number | null;
  meeting_cadence?: string | null;
  effective_date?: string | null;
  review_date?: string | null;
  created_at: string;
  updated_at: string;
};

type CommitteeDetail = Committee & {
  tenant_id: number;
  description?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  is_deleted: boolean;
  members: Member[];
  member_count: number;
  voting_member_count: number;
  meeting_summary: MeetingSummary;
};

type Member = {
  id: number;
  tenant_id: number;
  committee_id: number;
  user_id: number;
  member_role: string;
  is_voting_member: boolean;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MeetingSummary = {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  next_meeting_id?: number | null;
  next_meeting_code?: string | null;
  next_meeting_title?: string | null;
  next_meeting_at?: string | null;
};

type Meeting = {
  id: number;
  meeting_code: string;
  title: string;
  meeting_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  location?: string | null;
  chairperson_id?: number | null;
};

type HistoryItem = {
  id: number;
  committee_id: number;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  comment?: string | null;
  performed_by?: number | null;
  created_at: string;
};

type User = {
  id: number;
  full_name?: string | null;
  email?: string | null;
};

type CommitteeForm = {
  committee_code: string;
  name: string;
  committee_type: string;
  description: string;
  chairperson_id: string;
  secretary_id: string;
  status: string;
  meeting_cadence: string;
  effective_date: string;
  review_date: string;
};

type MemberForm = {
  user_id: string;
  member_role: string;
  is_voting_member: boolean;
  start_date: string;
  end_date: string;
  status: string;
};

const EMPTY_FORM: CommitteeForm = {
  committee_code: "",
  name: "",
  committee_type: "",
  description: "",
  chairperson_id: "",
  secretary_id: "",
  status: "ACTIVE",
  meeting_cadence: "",
  effective_date: "",
  review_date: "",
};

const EMPTY_MEMBER_FORM: MemberForm = {
  user_id: "",
  member_role: "MEMBER",
  is_voting_member: true,
  start_date: "",
  end_date: "",
  status: "ACTIVE",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
    case "INACTIVE":
      return "bg-slate-100 text-slate-600 ring-slate-500/10";
    case "SUSPENDED":
      return "bg-amber-50 text-amber-700 ring-amber-600/10";
    case "DISSOLVED":
      return "bg-red-50 text-red-700 ring-red-600/10";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-600/10";
  }
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function userName(users: User[], id?: number | null) {
  if (!id) return "—";

  const user = users.find((item) => item.id === id);

  return user?.full_name || user?.email || `User #${id}`;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function GovernanceCommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCommittee, setSelectedCommittee] =
    useState<CommitteeDetail | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Committee | null>(null);

  const [form, setForm] = useState<CommitteeForm>(EMPTY_FORM);
  const [memberForm, setMemberForm] =
    useState<MemberForm>(EMPTY_MEMBER_FORM);
  const [saving, setSaving] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadCommittees = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [committeeResponse, userResponse] = await Promise.all([
        apiFetch("/governance-committees"),
        apiFetch("/users"),
      ]);

      const committeeData = await committeeResponse.json();
      const userData = await userResponse.json();

      setCommittees(
        Array.isArray(committeeData)
          ? committeeData
          : Array.isArray(committeeData?.items)
            ? committeeData.items
            : []
      );

      setUsers(
        Array.isArray(userData)
          ? userData
          : Array.isArray(userData?.items)
            ? userData.items
            : []
      );
    } catch (err) {
      setError(errorMessage(err, "Failed to load governance committees."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCommittees(true);
  }, [loadCommittees]);

  const openCommittee = useCallback(async (committeeId: number) => {
    try {
      setDetailLoading(true);
      setError("");

      const [detailResponse, meetingResponse, historyResponse] =
        await Promise.all([
          apiFetch(`/governance-committees/${committeeId}`),
          apiFetch(`/governance-committees/${committeeId}/meetings`),
          apiFetch(`/governance-committees/${committeeId}/history`),
        ]);

      const detailData = await detailResponse.json();
      const meetingData = await meetingResponse.json();
      const historyData = await historyResponse.json();

      setSelectedCommittee(detailData);

      setMeetings(
        Array.isArray(meetingData)
          ? meetingData
          : Array.isArray(meetingData?.items)
            ? meetingData.items
            : []
      );

      setHistory(
        Array.isArray(historyData)
          ? historyData
          : Array.isArray(historyData?.items)
            ? historyData.items
            : []
      );
    } catch (err) {
      setError(errorMessage(err, "Failed to load committee details."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filteredCommittees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return committees.filter((committee) => {
      const matchesSearch =
        !query ||
        committee.committee_code.toLowerCase().includes(query) ||
        committee.name.toLowerCase().includes(query) ||
        committee.committee_type.toLowerCase().includes(query) ||
        (committee.meeting_cadence || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        committee.status.toUpperCase() === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        committee.committee_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [committees, search, statusFilter, typeFilter]);

  const committeeTypes = useMemo(
    () =>
      Array.from(
        new Set(
          committees
            .map((committee) => committee.committee_type)
            .filter(Boolean)
        )
      ).sort(),
    [committees]
  );

  const activeCount = committees.filter(
    (committee) => committee.status.toUpperCase() === "ACTIVE"
  ).length;

  const inactiveCount = committees.filter(
    (committee) => committee.status.toUpperCase() === "INACTIVE"
  ).length;

  const reviewDueCount = committees.filter((committee) => {
    if (!committee.review_date) return false;

    const reviewDate = new Date(committee.review_date);
    if (Number.isNaN(reviewDate.getTime())) return false;

    return reviewDate <= new Date();
  }).length;

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  }

  function openEdit(committee: CommitteeDetail) {
    setForm({
      committee_code: committee.committee_code,
      name: committee.name,
      committee_type: committee.committee_type,
      description: committee.description || "",
      chairperson_id: committee.chairperson_id
        ? String(committee.chairperson_id)
        : "",
      secretary_id: committee.secretary_id
        ? String(committee.secretary_id)
        : "",
      status: committee.status,
      meeting_cadence: committee.meeting_cadence || "",
      effective_date: committee.effective_date || "",
      review_date: committee.review_date || "",
    });

    setShowEdit(true);
  }

  async function saveCommittee() {
    if (!form.committee_code.trim() || !form.name.trim() || !form.committee_type.trim()) {
      setError("Committee code, name and committee type are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        committee_code: form.committee_code.trim(),
        name: form.name.trim(),
        committee_type: form.committee_type.trim(),
        description: form.description.trim() || null,
        chairperson_id: form.chairperson_id
          ? Number(form.chairperson_id)
          : null,
        secretary_id: form.secretary_id
          ? Number(form.secretary_id)
          : null,
        status: form.status,
        meeting_cadence: form.meeting_cadence.trim() || null,
        effective_date: form.effective_date || null,
        review_date: form.review_date || null,
      };

      const response = showEdit && selectedCommittee
        ? await apiFetch(
            `/governance-committees/${selectedCommittee.id}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            }
          )
        : await apiFetch("/governance-committees", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        throw new Error(
          showEdit
            ? "Failed to update committee."
            : "Failed to create committee."
        );
      }

      const saved = await response.json();

      setShowCreate(false);
      setShowEdit(false);

      await loadCommittees();

      if (saved?.id) {
        await openCommittee(saved.id);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to save committee."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommittee() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError("");

      const response = await apiFetch(
        `/governance-committees/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete committee.");
      }

      if (selectedCommittee?.id === deleteTarget.id) {
        setSelectedCommittee(null);
        setMeetings([]);
        setHistory([]);
      }

      setDeleteTarget(null);
      await loadCommittees();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete committee."));
    } finally {
      setDeleting(false);
    }
  }

  async function addMember() {
    if (!selectedCommittee || !memberForm.user_id) {
      setError("Select a user before adding a member.");
      return;
    }

    try {
      setMemberSaving(true);
      setError("");

      const response = await apiFetch(
        `/governance-committees/${selectedCommittee.id}/members`,
        {
          method: "POST",
          body: JSON.stringify({
            user_id: Number(memberForm.user_id),
            member_role: memberForm.member_role.trim() || "MEMBER",
            is_voting_member: memberForm.is_voting_member,
            start_date: memberForm.start_date || null,
            end_date: memberForm.end_date || null,
            status: memberForm.status,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add committee member.");
      }

      setMemberForm(EMPTY_MEMBER_FORM);
      setShowMemberForm(false);
      await openCommittee(selectedCommittee.id);
    } catch (err) {
      setError(errorMessage(err, "Failed to add committee member."));
    } finally {
      setMemberSaving(false);
    }
  }

  async function removeMember(member: Member) {
    if (!selectedCommittee) return;

    try {
      setError("");

      const response = await apiFetch(
        `/governance-committees/${selectedCommittee.id}/members/${member.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to remove committee member.");
      }

      await openCommittee(selectedCommittee.id);
    } catch (err) {
      setError(errorMessage(err, "Failed to remove committee member."));
    }
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              <Link
                href="/governance"
                className="transition hover:text-slate-900"
              >
                Governance
              </Link>
              <span>/</span>
              <span className="text-slate-700">Committees</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <Building2 size={19} className="text-slate-700" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Governance Committees
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Maintain the authoritative governance committee register,
                  membership, meeting oversight and committee history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadCommittees()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus size={16} />
              New Committee
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total Committees
              </span>
              <Building2 size={16} className="text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {committees.length}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active
              </span>
              <ShieldCheck size={16} className="text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">
              {activeCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Inactive
              </span>
              <Clock3 size={16} className="text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-700">
              {inactiveCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Review Due
              </span>
              <History size={16} className="text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-amber-700">
              {reviewDueCount}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Committee Register
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {filteredCommittees.length} committee
                  {filteredCommittees.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search committees..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-64"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="all">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISSOLVED">Dissolved</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="all">All types</option>
                  {committeeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : filteredCommittees.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Building2 size={20} />
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                No governance committees found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                {committees.length === 0
                  ? "Create the first governance committee to establish the committee register."
                  : "Try changing the search or filter criteria."}
              </p>

              {committees.length === 0 && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus size={15} />
                  Create Committee
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Committee
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Chairperson
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Cadence
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Effective
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Review
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredCommittees.map((committee) => (
                    <tr
                      key={committee.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void openCommittee(committee.id)}
                          className="text-left"
                        >
                          <div className="font-medium text-slate-900 transition group-hover:text-slate-700">
                            {committee.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {committee.committee_code}
                          </div>
                        </button>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {committee.committee_type}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {userName(users, committee.chairperson_id)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {committee.meeting_cadence || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(committee.effective_date)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(committee.review_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                            committee.status
                          )}`}
                        >
                          {statusLabel(committee.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void openCommittee(committee.id)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950"
                        >
                          Open
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedCommittee && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => setSelectedCommittee(null)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[760px] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    <span>Committee</span>
                    <span>/</span>
                    <span>{selectedCommittee.committee_code}</span>
                  </div>

                  <h2 className="truncate text-xl font-semibold text-slate-950">
                    {selectedCommittee.name}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                        selectedCommittee.status
                      )}`}
                    >
                      {statusLabel(selectedCommittee.status)}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {selectedCommittee.committee_type}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCommittee(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(selectedCommittee)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <Edit3 size={14} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedCommittee)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <Users size={15} className="text-slate-400" />
                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {selectedCommittee.member_count}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Members
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <Vote size={15} className="text-slate-400" />
                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {selectedCommittee.voting_member_count}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Voting
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <CalendarDays size={15} className="text-slate-400" />
                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {selectedCommittee.meeting_summary.total}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Meetings
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <Check size={15} className="text-emerald-600" />
                    <div className="mt-3 text-xl font-semibold text-slate-950">
                      {selectedCommittee.meeting_summary.completed}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Completed
                    </div>
                  </div>
                </div>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Committee Profile
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Chairperson
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {userName(users, selectedCommittee.chairperson_id)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Secretary
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {userName(users, selectedCommittee.secretary_id)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Meeting Cadence
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {selectedCommittee.meeting_cadence || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Effective Date
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {formatDate(selectedCommittee.effective_date)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Review Date
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {formatDate(selectedCommittee.review_date)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Last Updated
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {formatDateTime(selectedCommittee.updated_at)}
                      </div>
                    </div>

                    {selectedCommittee.description && (
                      <div className="sm:col-span-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Description
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {selectedCommittee.description}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Members
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Committee membership and voting rights
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMemberForm(EMPTY_MEMBER_FORM);
                        setShowMemberForm(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                    >
                      <Plus size={14} />
                      Add Member
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedCommittee.members.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-slate-500">
                        No committee members have been assigned.
                      </div>
                    ) : (
                      selectedCommittee.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800">
                              {userName(users, member.user_id)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{member.member_role}</span>
                              <span>•</span>
                              <span>
                                {member.is_voting_member
                                  ? "Voting member"
                                  : "Non-voting"}
                              </span>
                              <span>•</span>
                              <span>{statusLabel(member.status)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void removeMember(member)}
                            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Meetings
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Committee meeting oversight
                        </p>
                      </div>

                      <div className="text-xs text-slate-500">
                        {selectedCommittee.meeting_summary.scheduled} scheduled
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {selectedCommittee.meeting_summary.next_meeting_id && (
                      <Link
                        href={`/governance/meetings/${selectedCommittee.meeting_summary.next_meeting_id}`}
                        className="block bg-slate-50/70 px-5 py-4 transition hover:bg-slate-100"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Next Meeting
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {selectedCommittee.meeting_summary.next_meeting_title ||
                            selectedCommittee.meeting_summary.next_meeting_code ||
                            "Upcoming meeting"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            selectedCommittee.meeting_summary.next_meeting_at
                          )}
                        </div>
                      </Link>
                    )}

                    {meetings.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-slate-500">
                        No meetings are linked to this committee.
                      </div>
                    ) : (
                      meetings.slice(0, 8).map((meeting) => (
                        <Link
                          key={meeting.id}
                          href={`/governance/meetings/${meeting.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800">
                              {meeting.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {meeting.meeting_code}
                              {" · "}
                              {formatDateTime(meeting.scheduled_at)}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                                meeting.status
                              )}`}
                            >
                              {statusLabel(meeting.status)}
                            </span>
                            <ChevronRight size={15} className="text-slate-400" />
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>

                <section className="mt-6 rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <History size={15} className="text-slate-500" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        Governance History
                      </h3>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {history.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-slate-500">
                        No committee history records found.
                      </div>
                    ) : (
                      history.slice(0, 10).map((item) => (
                        <div key={item.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {statusLabel(item.action)}
                              </div>

                              {item.field_name && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.field_name}
                                  {item.new_value
                                    ? ` → ${item.new_value}`
                                    : ""}
                                </div>
                              )}

                              {item.comment && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.comment}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 text-xs text-slate-400">
                              {formatDateTime(item.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}

      {(showCreate || showEdit) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => {
              if (!saving) {
                setShowCreate(false);
                setShowEdit(false);
              }
            }}
          />

          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {showEdit ? "Edit Committee" : "New Committee"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Maintain the controlled governance committee record.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowCreate(false);
                    setShowEdit(false);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label="Committee Code"
                  required
                  value={form.committee_code}
                  placeholder="e.g. AUD-COM-001"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      committee_code: value,
                    }))
                  }
                />

                <Field
                  label="Committee Type"
                  required
                  value={form.committee_type}
                  placeholder="e.g. Audit Committee"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      committee_type: value,
                    }))
                  }
                />

                <div className="sm:col-span-2">
                  <Field
                    label="Name"
                    required
                    value={form.name}
                    placeholder="e.g. Audit & Risk Committee"
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                  />
                </div>

                <SelectField
                  label="Chairperson"
                  value={form.chairperson_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      chairperson_id: value,
                    }))
                  }
                  users={users}
                />

                <SelectField
                  label="Secretary"
                  value={form.secretary_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      secretary_id: value,
                    }))
                  }
                  users={users}
                />

                <Field
                  label="Meeting Cadence"
                  value={form.meeting_cadence}
                  placeholder="Monthly"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      meeting_cadence: value,
                    }))
                  }
                />

                <SelectSimple
                  label="Status"
                  value={form.status}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value,
                    }))
                  }
                  options={[
                    ["ACTIVE", "Active"],
                    ["INACTIVE", "Inactive"],
                    ["SUSPENDED", "Suspended"],
                    ["DISSOLVED", "Dissolved"],
                  ]}
                />

                <DateField
                  label="Effective Date"
                  value={form.effective_date}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      effective_date: value,
                    }))
                  }
                />

                <DateField
                  label="Review Date"
                  value={form.review_date}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      review_date: value,
                    }))
                  }
                />

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    placeholder="Committee mandate and governance scope..."
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowCreate(false);
                    setShowEdit(false);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCommittee()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  {showEdit ? "Save Changes" : "Create Committee"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMemberForm && selectedCommittee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => {
              if (!memberSaving) setShowMemberForm(false);
            }}
          />

          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Add Committee Member
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Assign an existing user to this committee.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={memberSaving}
                  onClick={() => setShowMemberForm(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <SelectField
                label="User"
                required
                value={memberForm.user_id}
                onChange={(value) =>
                  setMemberForm((current) => ({
                    ...current,
                    user_id: value,
                  }))
                }
                users={users}
              />

              <Field
                label="Member Role"
                value={memberForm.member_role}
                onChange={(value) =>
                  setMemberForm((current) => ({
                    ...current,
                    member_role: value,
                  }))
                }
              />

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    Voting Member
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Include this member in formal committee voting.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMemberForm((current) => ({
                      ...current,
                      is_voting_member: !current.is_voting_member,
                    }))
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    memberForm.is_voting_member
                      ? "bg-slate-950"
                      : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                      memberForm.is_voting_member
                        ? "left-6"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DateField
                  label="Start Date"
                  value={memberForm.start_date}
                  onChange={(value) =>
                    setMemberForm((current) => ({
                      ...current,
                      start_date: value,
                    }))
                  }
                />

                <DateField
                  label="End Date"
                  value={memberForm.end_date}
                  onChange={(value) =>
                    setMemberForm((current) => ({
                      ...current,
                      end_date: value,
                    }))
                  }
                />
              </div>

              <SelectSimple
                label="Status"
                value={memberForm.status}
                onChange={(value) =>
                  setMemberForm((current) => ({
                    ...current,
                    status: value,
                  }))
                }
                options={[
                  ["ACTIVE", "Active"],
                  ["INACTIVE", "Inactive"],
                ]}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={memberSaving}
                onClick={() => setShowMemberForm(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={memberSaving}
                onClick={() => void addMember()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {memberSaving && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={18} />
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-950">
                Delete Committee
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                This will remove the committee from the active register.
                Existing governance history is retained by the backend.
              </p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-medium text-slate-800">
                  {deleteTarget.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {deleteTarget.committee_code}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteCommittee()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                Delete Committee
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  users,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  users: User[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      >
        <option value="">Select user</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.full_name || user.email || `User #${user.id}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectSimple({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

