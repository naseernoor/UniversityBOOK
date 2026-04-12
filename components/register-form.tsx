"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { DEGREE_DEFAULT_SEMESTERS, DEGREE_LABELS, DegreeLevel } from "@/lib/academic";

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  fatherName: string;
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

const currentYear = new Date().getFullYear();

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    fatherName: "",
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload: RegisterPayload = {
      email: form.email,
      username: form.username,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      fatherName: form.fatherName,
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

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setLoading(false);
      setError(data.error ?? "Registration failed");
      return;
    }

    const loginResult = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    });

    setLoading(false);

    if (!loginResult || loginResult.error) {
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="panel">
        <h1 className="mb-2 text-2xl font-bold text-brand-950">Create your account</h1>
        <p className="mb-6 text-sm text-brand-700">
          Add your academic profile now. You can still use Google or Apple login later.
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
              value={form.username}
              onChange={(event) => setField("username", event.target.value)}
              required
            />
          </Field>

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
              value={form.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              required
            />
          </Field>

          <Field label="Last Name" required>
            <input
              type="text"
              className="input"
              value={form.lastName}
              onChange={(event) => setField("lastName", event.target.value)}
              required
            />
          </Field>

          <Field label="Father Name" required>
            <input
              type="text"
              className="input"
              value={form.fatherName}
              onChange={(event) => setField("fatherName", event.target.value)}
              required
            />
          </Field>

          <Field label="University" required>
            <input
              type="text"
              className="input"
              value={form.university}
              onChange={(event) => setField("university", event.target.value)}
              required
            />
          </Field>

          <Field label="Faculty" required>
            <input
              type="text"
              className="input"
              value={form.faculty}
              onChange={(event) => setField("faculty", event.target.value)}
              required
            />
          </Field>

          <Field label="Department" required>
            <input
              type="text"
              className="input"
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
            <button type="submit" className="btn-primary w-full" disabled={loading}>
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
