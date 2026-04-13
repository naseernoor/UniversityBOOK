"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { toAssetUrl } from "@/lib/blob-url";

type Friend = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image?: string | null;
  isBlueVerified?: boolean;
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

type SuggestedFriend = {
  id: string;
  username: string | null;
  email: string | null;
  image: string | null;
  isBlueVerified: boolean;
  profile: {
    firstName: string;
    lastName: string;
    university: string;
    faculty: string;
    department: string;
  };
  acceptsRequests: boolean;
  score: number;
  reasons: string[];
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

type Conversation = {
  friend: Friend;
  latestMessage: {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    createdAt: string;
  } | null;
  unreadCount: number;
};

type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const personName = (params: {
  username: string | null;
  email: string | null;
  name?: string | null;
  profile?: {
    firstName: string;
    lastName: string;
  } | null;
}) =>
  params.profile
    ? `${params.profile.firstName} ${params.profile.lastName}`
    : params.username ?? params.email ?? params.name ?? "User";

export default function FriendsClient() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [messageDraft, setMessageDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedFriend = useMemo(
    () =>
      conversations.find((conversation) => conversation.friend.id === selectedFriendId)?.friend ??
      friends.find((friend) => friend.id === selectedFriendId) ??
      null,
    [conversations, friends, selectedFriendId]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [friendsResponse, requestsResponse, suggestionsResponse, conversationsResponse] =
      await Promise.all([
        fetch("/api/friends/list"),
        fetch("/api/friends/requests"),
        fetch("/api/friends/suggestions"),
        fetch("/api/messages/conversations")
      ]);

    if (
      !friendsResponse.ok ||
      !requestsResponse.ok ||
      !suggestionsResponse.ok ||
      !conversationsResponse.ok
    ) {
      setLoading(false);
      setError("Failed to load friends data");
      return;
    }

    const friendsData = (await friendsResponse.json()) as { friends: Friend[] };
    const requestsData = (await requestsResponse.json()) as {
      incoming: IncomingRequest[];
      outgoing: OutgoingRequest[];
    };
    const suggestionsData = (await suggestionsResponse.json()) as { suggestions: SuggestedFriend[] };
    const conversationsData = (await conversationsResponse.json()) as { conversations: Conversation[] };

    setFriends(friendsData.friends);
    setIncoming(requestsData.incoming);
    setOutgoing(requestsData.outgoing);
    setSuggestions(suggestionsData.suggestions);
    setConversations(conversationsData.conversations);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadMessages = async (friendId: string) => {
    if (!friendId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setError(null);

    const response = await fetch(`/api/messages/${friendId}`);
    const data = (await response.json()) as { messages?: DirectMessage[]; error?: string };

    if (!response.ok || !data.messages) {
      setLoadingMessages(false);
      setError(data.error ?? "Failed to load messages");
      return;
    }

    setMessages(data.messages);
    setLoadingMessages(false);
    await loadData();
  };

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

  const removeRequest = async (requestId: string) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/friends/requests/${requestId}`, {
      method: "DELETE"
    });

    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setError(data.error ?? "Could not remove request");
      return;
    }

    setMessage(data.message ?? "Request removed");
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

    if (selectedFriendId === friendId) {
      setSelectedFriendId("");
      setMessages([]);
    }

    setMessage(data.message ?? "Friend removed");
    await searchUsers();
    await loadData();
  };

  const sendMessage = async () => {
    if (!selectedFriendId) {
      setError("Select a friend to start messaging");
      return;
    }

    const content = messageDraft.trim();
    if (!content) {
      setError("Message cannot be empty");
      return;
    }

    setSendingMessage(true);
    setError(null);

    const response = await fetch(`/api/messages/${selectedFriendId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    });

    const data = (await response.json()) as { error?: string; message?: DirectMessage };
    setSendingMessage(false);

    if (!response.ok || !data.message) {
      setError(data.error ?? "Failed to send message");
      return;
    }

    setMessageDraft("");
    setMessages((previous) => [...previous, data.message as DirectMessage]);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <h1 className="text-3xl font-black text-white">Friends, Suggestions, Messages</h1>
        <p className="mt-2 text-sm text-brand-50">
          Find friends, discover suggested connections, and chat privately with accepted friends.
        </p>
      </section>

      {loading ? <div className="panel">Loading...</div> : null}
      {error ? <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div> : null}
      {message ? (
        <div className="panel border-emerald-200 text-sm font-medium text-emerald-700">{message}</div>
      ) : null}

      <section className="panel space-y-3">
        <h2 className="text-lg font-semibold text-brand-900">Suggested friends for you</h2>
        {suggestions.length === 0 ? (
          <p className="text-sm text-brand-700">No suggestions right now. Add more profile details to improve matching.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((user) => (
              <article key={user.id} className="rounded-2xl border border-brand-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Image
                    src={toAssetUrl(user.image) || "/avatar-placeholder.svg"}
                    alt="Suggested friend"
                    width={42}
                    height={42}
                    className="h-11 w-11 rounded-xl border border-brand-200 object-cover"
                  />
                  <div>
                    <p className="font-semibold text-brand-900">
                      {personName({
                        username: user.username,
                        email: user.email,
                        profile: {
                          firstName: user.profile.firstName,
                          lastName: user.profile.lastName
                        }
                      })}
                      {user.isBlueVerified ? (
                        <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                          Verified
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-brand-700">
                      Match score: <strong>{user.score}</strong>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-brand-700">
                  {user.profile.university} · {user.profile.faculty}
                </p>
                <p className="mt-1 text-xs text-brand-600">{user.reasons.join(" · ") || "Suggested for you"}</p>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  disabled={!user.acceptsRequests}
                  onClick={() => sendRequest(user.id)}
                >
                  {user.acceptsRequests ? "Send friend request" : "Requests closed"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

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
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeRequest(request.id)}
                  >
                    Remove
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
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => removeRequest(request.id)}
                >
                  Cancel request
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr,1.7fr]">
        <div className="panel space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-sm text-brand-700">You have no friends added yet.</p>
          ) : (
            friends.map((friend) => (
              <article
                key={friend.id}
                className={`rounded-xl border p-3 ${
                  selectedFriendId === friend.id
                    ? "border-brand-400 bg-brand-50"
                    : "border-brand-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setSelectedFriendId(friend.id);
                      void loadMessages(friend.id);
                    }}
                  >
                    <p className="font-semibold text-brand-900">
                      {friend.username ?? friend.email ?? friend.name ?? "Friend"}
                    </p>
                    <p className="text-sm text-brand-700">
                      {friend.profile
                        ? `${friend.profile.firstName} ${friend.profile.lastName}`
                        : "Profile not completed"}
                    </p>
                  </button>

                  <div className="flex gap-2">
                    <Link href={`/user/${friend.id}`} className="btn-secondary">
                      Profile
                    </Link>
                    <button type="button" className="btn-secondary" onClick={() => removeFriend(friend.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="panel space-y-3">
          <h2 className="text-lg font-semibold text-brand-900">
            Messages {selectedFriend ? `with ${personName(selectedFriend)}` : ""}
          </h2>
          {!selectedFriend ? (
            <p className="text-sm text-brand-700">Select a friend from the left to start messaging.</p>
          ) : (
            <>
              <div className="h-[420px] space-y-2 overflow-y-auto rounded-xl border border-brand-200 bg-brand-50 p-3">
                {loadingMessages ? (
                  <p className="text-sm text-brand-700">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-brand-700">No messages yet. Say hello.</p>
                ) : (
                  messages.map((item) => {
                    const mine = item.senderId !== selectedFriend.id;
                    return (
                      <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <article
                          className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                            mine ? "bg-brand-700 text-white" : "border border-brand-200 bg-white text-brand-900"
                          }`}
                        >
                          <p className="font-pashto whitespace-pre-wrap text-sm" dir="auto">
                            {item.content}
                          </p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-brand-100" : "text-brand-600"}`}>
                            {formatDate(item.createdAt)}
                          </p>
                        </article>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-2">
                <textarea
                  className="input font-pashto min-h-16"
                  dir="auto"
                  placeholder="Write your message..."
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={sendingMessage}
                  onClick={() => void sendMessage()}
                >
                  {sendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
