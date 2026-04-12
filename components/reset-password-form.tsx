"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ResetPasswordFormProps = {
  token?: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Missing reset token");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          password
        })
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not reset password");
        return;
      }

      setMessage(data.message ?? "Password reset successful");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (requestError) {
      console.error("Reset password request failed", requestError);
      setError("Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-semibold text-brand-900">Create a new password</h1>
        <p className="mb-5 text-sm text-brand-700">
          Choose a strong password to secure your account.
        </p>

        {!token ? (
          <p className="text-sm font-medium text-red-700">Invalid or missing reset token.</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="label" htmlFor="password">
                New Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>

            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
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
