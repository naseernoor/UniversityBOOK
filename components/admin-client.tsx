"use client";

import { useCallback, useEffect, useState } from "react";

import { toAssetUrl } from "@/lib/blob-url";

type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
type SemesterVerificationStatus = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";

type Actor = {
  id: string;
  username: string | null;
  email: string | null;
  role: UserRole;
};

type AdminUser = {
  id: string;
  username: string | null;
  email: string | null;
  role: UserRole;
  image: string | null;
  isBlueVerified: boolean;
  emailVerified: string | null;
  createdAt: string;
  profile: {
    firstName: string;
    lastName: string;
    university: string;
  } | null;
  _count: {
    posts: number;
    comments: number;
    semesters: number;
    sentFriendRequests: number;
    receivedFriendRequests: number;
  };
};

type ProfileVerificationRequest = {
  id: string;
  status: VerificationStatus;
  documentType: "ID_CARD" | "PASSPORT" | "OTHER";
  documentUrl: string;
  documentName: string | null;
  createdAt: string;
  reviewNote: string | null;
  user: {
    id: string;
    username: string | null;
    email: string | null;
    isBlueVerified: boolean;
    profile: {
      firstName: string;
      lastName: string;
      university: string;
    } | null;
  };
};

type SemesterVerificationRequest = {
  id: string;
  index: number;
  name: string | null;
  verificationStatus: SemesterVerificationStatus;
  verificationDocumentUrl: string | null;
  verificationDocumentName: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationReviewNote: string | null;
  user: {
    id: string;
    username: string | null;
    email: string | null;
    isBlueVerified: boolean;
    profile: {
      firstName: string;
      lastName: string;
      university: string;
    } | null;
  };
};

type UserActivity = {
  user: {
    id: string;
    username: string | null;
    email: string | null;
    role: UserRole;
  };
  activity: {
    posts: Array<{
      id: string;
      content: string;
      visibility: "PUBLIC" | "FRIENDS";
      createdAt: string;
      _count: {
        likes: number;
        comments: number;
      };
    }>;
    comments: Array<{
      id: string;
      postId: string;
      parentId: string | null;
      content: string;
      createdAt: string;
    }>;
    friendRequests: Array<{
      id: string;
      senderId: string;
      recipientId: string;
      status: "PENDING" | "ACCEPTED" | "REJECTED";
      createdAt: string;
    }>;
    semesters: Array<{
      id: string;
      index: number;
      name: string | null;
      status: "ONGOING" | "FINISHED";
      verificationStatus: SemesterVerificationStatus;
      updatedAt: string;
    }>;
    profileVerifications: Array<{
      id: string;
      status: VerificationStatus;
      documentType: "ID_CARD" | "PASSPORT" | "OTHER";
      createdAt: string;
      reviewedAt: string | null;
      reviewNote: string | null;
    }>;
    adminActions: Array<{
      id: string;
      action: string;
      entityType: string | null;
      entityId: string | null;
      createdAt: string;
      admin: {
        username: string | null;
        email: string | null;
      };
    }>;
  };
};

type AdminClientProps = {
  actor: Actor;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
};

export default function AdminClient({ actor }: AdminClientProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [profileRequests, setProfileRequests] = useState<ProfileVerificationRequest[]>([]);
  const [semesterRequests, setSemesterRequests] = useState<SemesterVerificationRequest[]>([]);
  const [selectedUserActivity, setSelectedUserActivity] = useState<UserActivity | null>(null);
  const [query, setQuery] = useState("");
  const [activityUserId, setActivityUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearStatus = () => {
    setError(null);
    setMessage(null);
  };

  const loadUsers = useCallback(async (searchQuery?: string) => {
    const response = await fetch(
      `/api/admin/users${searchQuery && searchQuery.trim().length > 0 ? `?q=${encodeURIComponent(searchQuery)}` : ""}`
    );
    const data = (await response.json()) as { users?: AdminUser[]; error?: string };

    if (!response.ok || !data.users) {
      throw new Error(data.error ?? "Failed to load users");
    }

    setUsers(data.users);
  }, []);

  const loadProfileRequests = useCallback(async () => {
    const response = await fetch("/api/admin/verification/profile?status=PENDING");
    const data = (await response.json()) as {
      requests?: ProfileVerificationRequest[];
      error?: string;
    };

    if (!response.ok || !data.requests) {
      throw new Error(data.error ?? "Failed to load profile verification requests");
    }

    setProfileRequests(data.requests);
  }, []);

  const loadSemesterRequests = useCallback(async () => {
    const response = await fetch("/api/admin/verification/semesters?status=PENDING");
    const data = (await response.json()) as {
      semesters?: SemesterVerificationRequest[];
      error?: string;
    };

    if (!response.ok || !data.semesters) {
      throw new Error(data.error ?? "Failed to load semester verification requests");
    }

    setSemesterRequests(data.semesters);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    clearStatus();

    try {
      await Promise.all([loadUsers(query), loadProfileRequests(), loadSemesterRequests()]);
      setLoading(false);
    } catch (loadError) {
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data");
    }
  }, [loadProfileRequests, loadSemesterRequests, loadUsers, query]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateUser = async (userId: string, payload: { role?: UserRole; isBlueVerified?: boolean }) => {
    clearStatus();
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to update user");
      return;
    }
    setMessage(data.message ?? "User updated");
    await loadUsers(query);
  };

  const reviewProfileRequest = async (
    requestId: string,
    action: "APPROVE" | "REJECT",
    note?: string
  ) => {
    clearStatus();
    const response = await fetch(`/api/admin/verification/profile/${requestId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, note })
    });
    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to review profile request");
      return;
    }
    setMessage(data.message ?? "Profile verification updated");
    await Promise.all([loadProfileRequests(), loadUsers(query)]);
  };

  const reviewSemesterRequest = async (
    semesterId: string,
    action: "APPROVE" | "REJECT",
    note?: string
  ) => {
    clearStatus();
    const response = await fetch(`/api/semesters/${semesterId}/verification`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, note })
    });
    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to review semester request");
      return;
    }
    setMessage(data.message ?? "Semester verification updated");
    await loadSemesterRequests();
  };

  const loadUserActivity = async (userId: string) => {
    if (!userId) {
      setSelectedUserActivity(null);
      return;
    }

    clearStatus();
    const response = await fetch(`/api/admin/users/${userId}/activity`);
    const data = (await response.json()) as UserActivity & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to load user activity");
      return;
    }
    setSelectedUserActivity(data);
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">UniBOOK Admin</p>
        <h1 className="mt-2 text-3xl font-black text-white">Control Center</h1>
        <p className="mt-2 text-sm text-brand-100">
          Role: <strong>{actor.role}</strong> · Manage users, verification, and activity.
        </p>
      </section>

      {loading ? <div className="panel">Loading admin data...</div> : null}
      {error ? <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div> : null}
      {message ? <div className="panel border-emerald-200 text-sm font-medium text-emerald-700">{message}</div> : null}

      <section className="panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-brand-950">Users</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username/email"
            />
            <button type="button" className="btn-secondary" onClick={() => void loadUsers(query)}>
              Search
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-200 text-sm">
            <thead className="bg-brand-50 text-left text-brand-800">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Badge</th>
                <th className="px-3 py-2">Stats</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-brand-950">
                      {user.profile
                        ? `${user.profile.firstName} ${user.profile.lastName}`
                        : user.username ?? user.email ?? "User"}
                    </p>
                    <p className="text-xs text-brand-700">{user.email ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2">
                    {actor.role === "SUPER_ADMIN" ? (
                      <select
                        className="input max-w-[180px]"
                        value={user.role}
                        onChange={(event) =>
                          void updateUser(user.id, { role: event.target.value as UserRole })
                        }
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    ) : (
                      <span className="badge border-brand-300 bg-brand-50 text-brand-800">{user.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`badge ${
                        user.isBlueVerified
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-brand-300 bg-brand-50 text-brand-700"
                      }`}
                    >
                      {user.isBlueVerified ? "Blue Verified" : "Not Verified"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-brand-700">
                    Posts {user._count.posts} · Comments {user._count.comments} · Semesters {user._count.semesters}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void updateUser(user.id, { isBlueVerified: !user.isBlueVerified })}
                      >
                        {user.isBlueVerified ? "Remove Badge" : "Give Badge"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setActivityUserId(user.id);
                          void loadUserActivity(user.id);
                        }}
                      >
                        Activity
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel space-y-3">
          <h2 className="text-lg font-bold text-brand-950">Profile Verification Requests</h2>
          {profileRequests.length === 0 ? (
            <p className="text-sm text-brand-700">No pending profile verification requests.</p>
          ) : (
            profileRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-brand-200 bg-white p-3">
                <p className="font-semibold text-brand-950">
                  {request.user.profile
                    ? `${request.user.profile.firstName} ${request.user.profile.lastName}`
                    : request.user.username ?? request.user.email ?? "User"}
                </p>
                <p className="text-xs text-brand-700">
                  {request.documentType} · {formatDate(request.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    className="btn-secondary"
                    href={toAssetUrl(request.documentUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open document
                  </a>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void reviewProfileRequest(request.id, "APPROVE")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void reviewProfileRequest(request.id, "REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </article>

        <article className="panel space-y-3">
          <h2 className="text-lg font-bold text-brand-950">Semester Verification Requests</h2>
          {semesterRequests.length === 0 ? (
            <p className="text-sm text-brand-700">No pending semester verification requests.</p>
          ) : (
            semesterRequests.map((semester) => (
              <div key={semester.id} className="rounded-xl border border-brand-200 bg-white p-3">
                <p className="font-semibold text-brand-950">
                  {semester.user.profile
                    ? `${semester.user.profile.firstName} ${semester.user.profile.lastName}`
                    : semester.user.username ?? semester.user.email ?? "User"}
                </p>
                <p className="text-xs text-brand-700">
                  Semester {semester.index}
                  {semester.name ? ` - ${semester.name}` : ""} · Requested {formatDate(semester.verificationRequestedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {semester.verificationDocumentUrl ? (
                    <a
                      className="btn-secondary"
                      href={toAssetUrl(semester.verificationDocumentUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open transcript
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void reviewSemesterRequest(semester.id, "APPROVE")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void reviewSemesterRequest(semester.id, "REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </article>
      </section>

      <section className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-950">User Activity Inspector</h2>
          <select
            className="input max-w-[280px]"
            value={activityUserId}
            onChange={(event) => {
              const value = event.target.value;
              setActivityUserId(value);
              void loadUserActivity(value);
            }}
          >
            <option value="">Select a user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username ?? user.email ?? user.id}
              </option>
            ))}
          </select>
        </div>

        {!selectedUserActivity ? (
          <p className="text-sm text-brand-700">Select a user to inspect activity.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Recent Posts</h3>
              {selectedUserActivity.activity.posts.slice(0, 6).map((post) => (
                <article key={post.id} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                  <p className="text-sm text-brand-900">{post.content || "(No text)"}</p>
                  <p className="text-xs text-brand-700">
                    {formatDate(post.createdAt)} · Likes {post._count.likes} · Comments {post._count.comments}
                  </p>
                </article>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Recent Comments</h3>
              {selectedUserActivity.activity.comments.slice(0, 8).map((comment) => (
                <article key={comment.id} className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                  <p className="text-sm text-brand-900">{comment.content}</p>
                  <p className="text-xs text-brand-700">
                    {formatDate(comment.createdAt)}
                    {comment.parentId ? " · Reply" : " · Comment"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
