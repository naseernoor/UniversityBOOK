"use client";

import Link from "next/link";
import { useState } from "react";

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

export default function ForgotPasswordForm({ initialEmail = "" }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not process request");
        return;
      }

      setMessage(data.message ?? "If that email exists, a password reset link has been sent.");
    } catch (requestError) {
      console.error("Forgot password request failed", requestError);
      setError("Could not process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-semibold text-brand-900">Reset your password</h1>
        <p className="mb-5 text-sm text-brand-700">
          Enter your registered email address. We will send you a secure reset link.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-brand-800">
        Back to{" "}
        <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
