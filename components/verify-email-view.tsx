"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VerifyEmailViewProps = {
  token?: string;
};

export default function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your account...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }

    let cancelled = false;
    const verify = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = (await response.json()) as { message?: string; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error ?? "Verification failed");
          return;
        }

        setStatus("success");
        setMessage(data.message ?? "Email verified successfully");
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        console.error("Email verification failed", requestError);
        setStatus("error");
        setMessage("Verification failed");
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-semibold text-brand-900">Email verification</h1>
        <p
          className={`text-sm font-medium ${
            status === "success" ? "text-emerald-700" : status === "error" ? "text-red-700" : "text-brand-700"
          }`}
        >
          {message}
        </p>
      </div>

      <p className="text-center text-sm text-brand-800">
        Continue to{" "}
        <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
