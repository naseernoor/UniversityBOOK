"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Friend = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  profile: {
    firstName: string;
    lastName: string;
    university: string;
  } | null;
};

type SearchResult = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  profile: {
    university: string;
  } | null;
  relationshipStatus: "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "FRIENDS";
  acceptsRequests?: boolean;
};

type IncomingRequest = {
  id: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  };
};

type OutgoingRequest = {
  id: string;
  createdAt: string;
  recipient: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  };
};

export default function FriendsClient() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [friendsResponse, requestsResponse] = await Promise.all([
      fetch("/api/friends/list"),
      fetch("/api/friends/requests")
    ]);

    if (!friendsResponse.ok || !requestsResponse.ok) {
      setLoading(false);
      setError("Failed to load friends data");
      return;
    }

    const friendsData = (await friendsResponse.json()) as { friends: Friend[] };
    const requestsData = (await requestsResponse.json()) as {
      incoming: IncomingRequest[];
      outgoing: OutgoingRequest[];
    };

    setFriends(friendsData.friends);
    setIncoming(requestsData.incoming);
    setOutgoing(requestsData.outgoing);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const searchUsers = async () => {
    setError(null);
    setMessage(null);

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    const response = await fetch(`/api/friends/search?q=${encodeURIComponent(trimmedQuery)}`);
    const data = (await response.json()) as { users: SearchResult[]; error?: string };

    if (!response.ok) {
      setError(data.error ?? "Search failed");
      return;
    }

    setResults(data.users);
  };

  const sendRequest = async (targetUserId: string) => {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetUserId })
    });

    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(data.error ?? "Could not send request");
      return;
    }

    setMessage(data.message ?? "Friend request sent");
    await searchUsers();
    await loadData();
  };

  const updateRequest = async (requestId: string, action: "ACCEPT" | "REJECT") => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/friends/requests/${requestId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
    });

    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(data.error ?? "Could not update request");
      return;
    }

    setMessage(data.message ?? "Request updated");
    await searchUsers();
    await loadData();
  };

  const removeFriend = async (friendId: string) => {
    setError(null);
    setMessage(null);

    const shouldRemove = window.confirm("Remove this friend?");
    if (!shouldRemove) {
      return;
    }

    const response = await fetch(`/api/friends/${friendId}`, {
      method: "DELETE"
    });

    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(data.error ?? "Could not remove friend");
      return;
    }

    setMessage(data.message ?? "Friend removed");
    await searchUsers();
    await loadData();
  };

  return (
    <div className="space-y-6">
      <section className="panel bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 text-white">
        <h1 className="text-2xl font-semibold">Friends & Sharing</h1>
        <p className="mt-2 text-sm text-brand-50">
          Search by username or email, connect with friends, and let them view selected semesters.
        </p>
      </section>

      {loading ? <div className="panel">Loading...</div> : null}
      {error ? <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div> : null}
      {message ? (
        <div className="panel border-emerald-200 text-sm font-medium text-emerald-700">{message}</div>
      ) : null}

      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Find users</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            value={query}
            placeholder="Search by username or email"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="btn-primary" onClick={searchUsers}>
            Search
          </button>
        </div>

        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((user) => (
              <article
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-white p-3"
              >
                <div>
                  <p className="font-semibold text-brand-900">
                    {user.username ?? user.email ?? user.name ?? "Unknown user"}
                  </p>
                  <p className="text-sm text-brand-700">{user.email}</p>
                  <p className="text-xs text-brand-600">{user.profile?.university ?? "University not set"}</p>
                </div>

                <div className="flex items-center gap-2">
                  {user.relationshipStatus === "NONE" ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={user.acceptsRequests === false}
                      onClick={() => sendRequest(user.id)}
                    >
                      {user.acceptsRequests === false ? "Requests closed" : "Add friend"}
                    </button>
                  ) : null}
                  {user.relationshipStatus === "PENDING_SENT" ? (
                    <span className="badge border-amber-300 bg-amber-50 text-amber-700">Request sent</span>
                  ) : null}
                  {user.relationshipStatus === "PENDING_RECEIVED" ? (
                    <span className="badge border-sky-300 bg-sky-50 text-sky-700">Awaiting your response</span>
                  ) : null}
                  {user.relationshipStatus === "FRIENDS" ? (
                    <span className="badge border-emerald-300 bg-emerald-50 text-emerald-700">Friends</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-brand-700">No search results yet.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">Incoming requests</h2>
          {incoming.length === 0 ? (
            <p className="text-sm text-brand-700">No incoming requests.</p>
          ) : (
            incoming.map((request) => (
              <article
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-white p-3"
              >
                <div>
                  <p className="font-semibold text-brand-900">
                    {request.sender.username ?? request.sender.email ?? request.sender.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-brand-600">{request.sender.email}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => updateRequest(request.id, "ACCEPT")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => updateRequest(request.id, "REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="panel space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">Outgoing requests</h2>
          {outgoing.length === 0 ? (
            <p className="text-sm text-brand-700">No outgoing requests.</p>
          ) : (
            outgoing.map((request) => (
              <article
                key={request.id}
                className="flex items-center justify-between rounded-lg border border-brand-200 bg-white p-3"
              >
                <div>
                  <p className="font-semibold text-brand-900">
                    {request.recipient.username ??
                      request.recipient.email ??
                      request.recipient.name ??
                      "Unknown"}
                  </p>
                  <p className="text-xs text-brand-600">Pending</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Friends ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-brand-700">You have no friends added yet.</p>
        ) : (
          friends.map((friend) => (
            <article
              key={friend.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-white p-3"
            >
              <div>
                <p className="font-semibold text-brand-900">
                  {friend.username ?? friend.email ?? friend.name ?? "Friend"}
                </p>
                <p className="text-sm text-brand-700">
                  {friend.profile
                    ? `${friend.profile.firstName} ${friend.profile.lastName}`
                    : "Profile not completed"}
                </p>
              </div>

              <Link href={`/user/${friend.id}`} className="btn-secondary">
                View shared profile
              </Link>
              <button type="button" className="btn-secondary" onClick={() => removeFriend(friend.id)}>
                Remove friend
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
