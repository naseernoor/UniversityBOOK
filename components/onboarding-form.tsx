"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DEGREE_DEFAULT_SEMESTERS, DEGREE_LABELS, DegreeLevel } from "@/lib/academic";

type OnboardingFormProps = {
  defaultEmail?: string | null;
};

const currentYear = new Date().getFullYear();

export default function OnboardingForm({ defaultEmail }: OnboardingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
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

    const payload = {
      username: form.username,
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
      minimumPassingMarks: Number(form.minimumPassingMarks),
      idealPercentage: form.idealPercentage === "" ? null : Number(form.idealPercentage)
    };

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string };

    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save profile");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl panel">
      <h1 className="mb-2 text-2xl font-bold text-brand-950">Complete your profile</h1>
      <p className="mb-5 text-sm text-brand-700">
        Finish setup to enable semester templates, retake insights, and sharing controls.
      </p>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Field label="Email">
          <input className="input bg-brand-50" value={defaultEmail ?? "No email provided"} readOnly />
        </Field>

        <Field label="Username" required>
          <input
            className="input"
            dir="auto"
            value={form.username}
            onChange={(event) => setField("username", event.target.value)}
            required
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
            className="input"
            dir="auto"
            value={form.firstName}
            onChange={(event) => setField("firstName", event.target.value)}
            required
          />
        </Field>

        <Field label="Last Name" required>
          <input
            className="input"
            dir="auto"
            value={form.lastName}
            onChange={(event) => setField("lastName", event.target.value)}
            required
          />
        </Field>

        <Field label="Father Name" required>
          <input
            className="input"
            dir="auto"
            value={form.fatherName}
            onChange={(event) => setField("fatherName", event.target.value)}
            required
          />
        </Field>

        <Field label="University" required>
          <input
            className="input"
            dir="auto"
            value={form.university}
            onChange={(event) => setField("university", event.target.value)}
            required
          />
        </Field>

        <Field label="Faculty" required>
          <input
            className="input"
            dir="auto"
            value={form.faculty}
            onChange={(event) => setField("faculty", event.target.value)}
            required
          />
        </Field>

        <Field label="Department" required>
          <input
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
            min={1900}
            max={2100}
            required
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
            min={1}
            max={20}
            required
          />
        </Field>

        <Field label="Minimum Passing Marks" required>
          <input
            type="number"
            className="input"
            value={form.minimumPassingMarks}
            onChange={(event) => setField("minimumPassingMarks", Number(event.target.value))}
            min={0}
            max={100}
            step={0.01}
            required
          />
        </Field>

        <Field label="Ideal Final Percentage">
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
            {loading ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
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
