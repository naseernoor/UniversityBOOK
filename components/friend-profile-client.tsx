"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { toAssetUrl } from "@/lib/blob-url";

type LectureMaterial = {
  name: string;
  url: string;
};

type Subject = {
  id: string;
  name: string;
  credits: number;
  code: string | null;
  teacherName: string | null;
  chance: number;
  score: number;
  lectureMaterials: LectureMaterial[];
};

type Semester = {
  id: string;
  index: number;
  name: string | null;
  status: "ONGOING" | "FINISHED";
  percentage: number;
  subjects: Subject[];
};

type Profile = {
  firstName: string;
  lastName: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  university: string;
  faculty: string;
  department: string;
  degreeLevel: string;
  totalSemesters: number;
  idealPercentage: number | null;
};

type FriendProfilePayload = {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
    role?: "USER" | "ADMIN" | "SUPER_ADMIN";
    isBlueVerified?: boolean;
    profile: Profile | null;
  };
  semesters: Semester[];
  overallPercentage: number;
};

type FriendProfileClientProps = {
  userId: string;
};

export default function FriendProfileClient({ userId }: FriendProfileClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FriendProfilePayload | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/users/${userId}/profile`);
    const payload = (await response.json()) as FriendProfilePayload & { error?: string };

    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Could not load profile");
      return;
    }

    setData(payload);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return <div className="panel">Loading profile...</div>;
  }

  if (error) {
    return <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div>;
  }

  if (!data) {
    return <div className="panel">No profile data available.</div>;
  }

  return (
    <div className="space-y-5">
      <section className="hero-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">
              {data.user.username ?? data.user.email ?? data.user.name ?? "Student"}
              {data.user.isBlueVerified ? (
                <span className="ml-2 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                  Verified
                </span>
              ) : null}
            </h1>
            <p className="mt-2 text-sm text-brand-100">
              Shared semesters visible to you as an accepted friend.
            </p>
          </div>
          <Image
            src={toAssetUrl(data.user.image) || "/avatar-placeholder.svg"}
            alt="Profile"
            width={64}
            height={64}
            className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Overall Percentage</p>
          <p className="mt-2 text-2xl font-black text-brand-950">{data.overallPercentage.toFixed(2)}%</p>
        </article>

        <article className="metric-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Visible Semesters</p>
          <p className="mt-2 text-2xl font-black text-brand-950">{data.semesters.length}</p>
        </article>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-bold text-brand-950">Student Info</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Info
            label="Name"
            value={`${data.user.profile?.firstName ?? ""} ${data.user.profile?.lastName ?? ""}`.trim()}
          />
          <Info label="University" value={data.user.profile?.university ?? "-"} />
          <Info label="Gender" value={data.user.profile?.gender ?? "-"} />
          <Info label="Faculty" value={data.user.profile?.faculty ?? "-"} />
          <Info label="Department" value={data.user.profile?.department ?? "-"} />
          <Info label="Degree" value={data.user.profile?.degreeLevel ?? "-"} />
          <Info
            label="Target Percentage"
            value={
              data.user.profile?.idealPercentage ? `${data.user.profile.idealPercentage}%` : "Not set"
            }
          />
        </dl>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-brand-950">Shared Semesters</h2>
        {data.semesters.length === 0 ? (
          <div className="panel text-sm text-brand-700">This user has not shared any semester with you yet.</div>
        ) : (
          data.semesters.map((semester) => (
            <article key={semester.id} className="panel">
              <h3 className="text-lg font-bold text-brand-950">
                Semester {semester.index}
                {semester.name ? ` - ${semester.name}` : ""}
              </h3>
              <p className="text-sm text-brand-700">
                Status: {semester.status} · Percentage: {semester.percentage.toFixed(2)}%
              </p>

              <div className="mt-3 overflow-hidden rounded-lg border border-brand-200">
                <table className="min-w-full divide-y divide-brand-200 text-sm">
                  <thead className="bg-brand-50 text-left text-brand-800">
                    <tr>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Teacher</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Chance</th>
                      <th className="px-3 py-2">Score %</th>
                      <th className="px-3 py-2">Lectures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 bg-white">
                    {semester.subjects.map((subject) => (
                      <tr key={subject.id}>
                        <td className="px-3 py-2">{subject.name}</td>
                        <td className="px-3 py-2">{subject.teacherName ?? "-"}</td>
                        <td className="px-3 py-2">{subject.code ?? "-"}</td>
                        <td className="px-3 py-2">{subject.credits}</td>
                        <td className="px-3 py-2">{subject.chance}</td>
                        <td className="px-3 py-2">{subject.score.toFixed(2)}%</td>
                        <td className="px-3 py-2">
                          {subject.lectureMaterials.length === 0
                            ? "-"
                            : `${subject.lectureMaterials.length} files`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

type InfoProps = {
  label: string;
  value: string;
};

function Info({ label, value }: InfoProps) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-brand-600">{label}</dt>
      <dd className="mt-1 font-medium text-brand-900">{value || "-"}</dd>
    </div>
  );
}
