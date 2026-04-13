"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { toAssetUrl } from "@/lib/blob-url";

export default function NavBar() {
  const { data: session } = useSession();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      body: string;
      link: string | null;
      readAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session?.user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const loadNotifications = async () => {
      setLoadingNotifications(true);
      const response = await fetch("/api/notifications");
      const data = (await response.json()) as {
        notifications?: Array<{
          id: string;
          title: string;
          body: string;
          link: string | null;
          readAt: string | null;
          createdAt: string;
        }>;
        unreadCount?: number;
      };

      if (!response.ok) {
        setLoadingNotifications(false);
        return;
      }

      setNotifications(data.notifications ?? []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      setLoadingNotifications(false);
    };

    void loadNotifications();
  }, [session?.user]);

  const markNotificationAsRead = async (notificationId: string) => {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: "PATCH"
    });

    if (!response.ok) {
      return;
    }

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              readAt: new Date().toISOString()
            }
          : notification
      )
    );
    setUnreadCount((previous) => Math.max(previous - 1, 0));
  };

  const markAllAsRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        markAll: true
      })
    });

    if (!response.ok) {
      return;
    }

    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString()
      }))
    );
    setUnreadCount(0);
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <header className="sticky top-0 z-30 border-b border-brand-200/70 bg-white/80 backdrop-blur-xl">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-r from-brand-800 to-brand-600 px-2 py-1 text-xs font-black uppercase tracking-wider text-white">
            UB
          </span>
          <span className="text-lg font-black tracking-tight text-brand-950 transition group-hover:text-brand-700">
            UniBOOK
          </span>
        </Link>

        <nav className="flex items-center gap-3 text-sm font-semibold text-brand-800">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="nav-pill">
                Dashboard
              </Link>
              <Link href="/friends" className="nav-pill">
                Friends
              </Link>
              {session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? (
                <Link href="/admin" className="nav-pill">
                  Admin
                </Link>
              ) : null}
              <Link href="/register" className="nav-pill">
                New Account
              </Link>
              <div className="relative">
                <button
                  type="button"
                  className="btn-secondary px-3"
                  onClick={() => setOpenNotifications((previous) => !previous)}
                >
                  Notifications
                  {unreadCount > 0 ? (
                    <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>

                {openNotifications ? (
                  <div className="absolute right-0 z-50 mt-2 w-96 rounded-2xl border border-brand-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-brand-100 px-3 py-2">
                      <p className="text-sm font-semibold text-brand-950">Notifications</p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-700"
                        onClick={() => void markAllAsRead()}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2">
                      {loadingNotifications ? (
                        <p className="px-2 py-3 text-sm text-brand-700">Loading...</p>
                      ) : notifications.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-brand-700">No notifications yet.</p>
                      ) : (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href={notification.link ?? "/dashboard"}
                            className={`mb-2 block rounded-xl border px-3 py-2 text-left ${
                              notification.readAt
                                ? "border-brand-100 bg-brand-50/40"
                                : "border-sky-200 bg-sky-50"
                            }`}
                            onClick={() => {
                              void markNotificationAsRead(notification.id);
                              setOpenNotifications(false);
                            }}
                          >
                            <p className="text-sm font-semibold text-brand-900">{notification.title}</p>
                            <p className="mt-1 text-xs text-brand-700">{notification.body}</p>
                            <p className="mt-1 text-[11px] text-brand-600">{formatDate(notification.createdAt)}</p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
              <Image
                src={toAssetUrl(session.user.image) || "/avatar-placeholder.svg"}
                alt="User"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl border border-brand-200 object-cover"
              />
            </>
          ) : (
            <>
              <Link href="/login" className="nav-pill">
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
