"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type AuthProvider = {
  id: string;
  name: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);

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
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (!result || result.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
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
