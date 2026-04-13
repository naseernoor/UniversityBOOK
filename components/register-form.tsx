"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DEGREE_DEFAULT_SEMESTERS, DEGREE_LABELS, DegreeLevel } from "@/lib/academic";

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  university: string;
  faculty: string;
  department: string;
  degreeLevel: DegreeLevel;
  yearOfEnrollment: number;
  dateOfBirth: string;
  totalSemesters: number;
  minimumPassingMarks: number;
  idealPercentage?: number;
};

type UsernameCheckResult = {
  available: boolean;
  message?: string;
  normalized?: string;
};

const currentYear = new Date().getFullYear();

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameMessage, setUsernameMessage] = useState<string>("");

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    fatherName: "",
    gender: "PREFER_NOT_TO_SAY" as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY",
    university: "",
    faculty: "",
    department: "",
    degreeLevel: "BACHELOR" as DegreeLevel,
    yearOfEnrollment: currentYear,
    dateOfBirth: "",
    totalSemesters: DEGREE_DEFAULT_SEMESTERS.BACHELOR,
    minimumPassingMarks: 50,
    idealPercentage: ""
  });

  const setField = (key: keyof typeof form, value: string | number | DegreeLevel) => {
    setForm((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  const handleDegreeChange = (degreeLevel: DegreeLevel) => {
    setForm((previous) => ({
      ...previous,
      degreeLevel,
      totalSemesters: DEGREE_DEFAULT_SEMESTERS[degreeLevel]
    }));
  };

  useEffect(() => {
    const username = form.username.trim();

    if (username.length === 0) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username must be at least 3 characters");
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/register/check-username?username=${encodeURIComponent(username)}`,
          { signal: controller.signal }
        );

        const data = (await response.json()) as UsernameCheckResult;

        if (data.available) {
          setUsernameStatus("available");
          setUsernameMessage("Username is available");
          return;
        }

        if (data.message?.toLowerCase().includes("letters") || data.message?.toLowerCase().includes("least")) {
          setUsernameStatus("invalid");
          setUsernameMessage(data.message ?? "Invalid username");
          return;
        }

        setUsernameStatus("taken");
        setUsernameMessage(data.message ?? "Username is already taken");
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }
        setUsernameStatus("invalid");
        setUsernameMessage("Could not validate username right now");
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [form.username]);

  const canSubmit = useMemo(() => {
    if (loading) {
      return false;
    }
    if (usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking") {
      return false;
    }
    return true;
  }, [loading, usernameStatus]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: RegisterPayload = {
      email: form.email,
      username: form.username,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      fatherName: form.fatherName,
      gender: form.gender,
      university: form.university,
      faculty: form.faculty,
      department: form.department,
      degreeLevel: form.degreeLevel,
      yearOfEnrollment: Number(form.yearOfEnrollment),
      dateOfBirth: form.dateOfBirth,
      totalSemesters: Number(form.totalSemesters),
      minimumPassingMarks: Number(form.minimumPassingMarks)
    };

    if (form.idealPercentage !== "") {
      payload.idealPercentage = Number(form.idealPercentage);
    }

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string; message?: string };

    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }

    setSuccess(data.message ?? "Registration successful. Check your email to verify your account.");
    router.push(`/login?registered=1&email=${encodeURIComponent(form.email)}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-bold text-brand-950">Create your account</h1>
        <p className="mb-6 text-sm text-brand-700">
          Add your academic profile now. You can type fields in English, Persian, or Pashto.
        </p>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Email" required>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              required
            />
          </Field>

          <Field label="Username" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.username}
              onChange={(event) => setField("username", event.target.value)}
              required
            />
          </Field>

          <div className="md:col-span-2">
            {usernameStatus !== "idle" ? (
              <p
                className={`text-sm font-medium ${
                  usernameStatus === "available"
                    ? "text-emerald-700"
                    : usernameStatus === "checking"
                      ? "text-brand-700"
                      : "text-red-600"
                }`}
              >
                {usernameMessage}
              </p>
            ) : null}
          </div>

          <Field label="Password" required>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              required
              minLength={8}
            />
          </Field>

          <Field label="Degree Level" required>
            <select
              className="input"
              value={form.degreeLevel}
              onChange={(event) => handleDegreeChange(event.target.value as DegreeLevel)}
              required
            >
              {Object.entries(DEGREE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="First Name" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              required
            />
          </Field>

          <Field label="Last Name" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.lastName}
              onChange={(event) => setField("lastName", event.target.value)}
              required
            />
          </Field>

          <Field label="Father Name" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.fatherName}
              onChange={(event) => setField("fatherName", event.target.value)}
              required
            />
          </Field>

          <Field label="Gender" required>
            <select
              className="input"
              value={form.gender}
              onChange={(event) =>
                setField(
                  "gender",
                  event.target.value as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
                )
              }
              required
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </Field>

          <Field label="University" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.university}
              onChange={(event) => setField("university", event.target.value)}
              required
            />
          </Field>

          <Field label="Faculty" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.faculty}
              onChange={(event) => setField("faculty", event.target.value)}
              required
            />
          </Field>

          <Field label="Department" required>
            <input
              type="text"
              className="input"
              dir="auto"
              value={form.department}
              onChange={(event) => setField("department", event.target.value)}
              required
            />
          </Field>

          <Field label="Year of Enrollment" required>
            <input
              type="number"
              className="input"
              value={form.yearOfEnrollment}
              onChange={(event) => setField("yearOfEnrollment", Number(event.target.value))}
              required
              min={1900}
              max={2100}
            />
          </Field>

          <Field label="Date of Birth" required>
            <input
              type="date"
              className="input"
              value={form.dateOfBirth}
              onChange={(event) => setField("dateOfBirth", event.target.value)}
              required
            />
          </Field>

          <Field label="Total Semesters" required>
            <input
              type="number"
              className="input"
              value={form.totalSemesters}
              onChange={(event) => setField("totalSemesters", Number(event.target.value))}
              required
              min={1}
              max={20}
            />
          </Field>

          <Field label="Minimum Passing Marks" required>
            <input
              type="number"
              className="input"
              value={form.minimumPassingMarks}
              onChange={(event) => setField("minimumPassingMarks", Number(event.target.value))}
              required
              min={0}
              max={100}
              step={0.01}
            />
          </Field>

          <Field label="Ideal Final Percentage (Optional)">
            <input
              type="number"
              className="input"
              value={form.idealPercentage}
              onChange={(event) => setField("idealPercentage", event.target.value)}
              min={0}
              max={100}
              step={0.01}
            />
          </Field>

          <div className="md:col-span-2 space-y-2">
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>
      </div>

      <p className="text-center text-sm text-brand-700">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand-800 underline-offset-4 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
};

function Field({ label, children, required = false }: FieldProps) {
  return (
    <label>
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
