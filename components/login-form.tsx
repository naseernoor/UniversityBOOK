"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type AuthProvider = {
  id: string;
  name: string;
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);

  const showRegistrationHint = useMemo(
    () => searchParams.get("registered") === "1",
    [searchParams]
  );

  useEffect(() => {
    if (showRegistrationHint) {
      setInfo("Registration successful. Please verify your email before logging in.");
    }
  }, [showRegistrationHint]);

  useEffect(() => {
    const loadProviders = async () => {
      const response = await fetch("/api/auth/providers");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as Record<string, AuthProvider>;
      setProviders(Object.values(data).filter((provider) => provider.id !== "credentials"));
    };

    void loadProviders();
  }, []);

  const handleCredentialsLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      twoFactorCode: twoFactorCode.trim(),
      redirect: false
    });

    setLoading(false);

    if (!result || result.error) {
      if (result?.error?.includes("TWO_FACTOR_REQUIRED")) {
        setRequiresTwoFactor(true);
        setInfo("A security code was sent. Enter it to finish login.");
        return;
      }
      if (result?.error?.includes("INVALID_TWO_FACTOR_CODE")) {
        setRequiresTwoFactor(true);
        setError("Invalid or expired two-factor code.");
        return;
      }
      if (result?.error?.includes("EMAIL_NOT_VERIFIED")) {
        setError("Email not verified. Please verify your email first.");
      } else {
        setError("Invalid email or password");
      }
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setError("Enter your email first to resend verification.");
      return;
    }

    setResendingVerification(true);
    setError(null);

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: email.trim() })
    });

    const data = (await response.json()) as { message?: string; error?: string };
    setResendingVerification(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to resend verification");
      return;
    }

    setInfo(data.message ?? "If your account exists, we sent a verification email.");
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-semibold text-brand-900">Welcome back</h1>
        <p className="mb-5 text-sm text-brand-700">
          Login with your email/password or continue using Google/Apple.
        </p>

        <form className="space-y-3" onSubmit={handleCredentialsLogin}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setRequiresTwoFactor(false);
                setTwoFactorCode("");
              }}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setRequiresTwoFactor(false);
                setTwoFactorCode("");
              }}
              required
            />
          </div>

          {requiresTwoFactor ? (
            <div>
              <label className="label" htmlFor="two-factor-code">
                Security Code
              </label>
              <input
                id="two-factor-code"
                type="text"
                className="input"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                required
              />
            </div>
          ) : null}

          <div className="text-right">
            <Link
              href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {info ? <p className="text-sm font-medium text-emerald-700">{info}</p> : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <button
            type="button"
            className="btn-secondary w-full"
            onClick={resendVerification}
            disabled={resendingVerification}
          >
            {resendingVerification ? "Resending..." : "Resend verification email"}
          </button>
        </form>

        {providers.length > 0 ? (
          <div className="mt-5 space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="btn-secondary w-full"
                onClick={() => signIn(provider.id, { callbackUrl: "/dashboard" })}
              >
                Continue with {provider.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="text-center text-sm text-brand-800">
        New user?{" "}
        <Link href="/register" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Create your account
        </Link>
      </p>
    </div>
  );
}
