"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-brand-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
              <Image
                src={session.user.image ?? "/avatar-placeholder.svg"}
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
