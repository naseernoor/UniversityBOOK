"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildSemesterTemplates,
  DEGREE_DEFAULT_SEMESTERS,
  DEGREE_LABELS,
  DegreeLevel
} from "@/lib/academic";

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
  percentage: number;
  visibleFriendIds: string[];
  subjects: Subject[];
};

type Projection = {
  requiredAverage: number;
  remainingSemesters: number;
  canAchieve: boolean;
} | null;

type ChanceStats = {
  secondChanceCount: number;
  thirdChanceCount: number;
};

type RetakeItem = {
  id: string;
  name: string;
  score: number;
  chance: number;
  semesterId: string;
  semesterIndex: number;
  semesterName: string | null;
  teacherName: string | null;
};

type RetakeQueues = {
  needSecondChance: RetakeItem[];
  needThirdChance: RetakeItem[];
};

type Profile = {
  firstName: string;
  lastName: string;
  fatherName: string;
  university: string;
  faculty: string;
  department: string;
  degreeLevel: DegreeLevel;
  yearOfEnrollment: number;
  dateOfBirth: string | Date;
  totalSemesters: number;
  minimumPassingMarks: number;
  idealPercentage: number | null;
};

type UserPayload = {
  id: string;
  email: string | null;
  username: string | null;
  image: string | null;
  profile: Profile | null;
};

type Friend = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  profile: {
    firstName: string;
    lastName: string;
    university: string;
  } | null;
};

type DashboardClientProps = {
  initialUser: UserPayload;
};

type SubjectDraft = {
  name: string;
  credits: number;
  code: string;
  teacherName: string;
  chance: number;
  score: number;
  lectureMaterials: LectureMaterial[];
};

type SemesterDraft = {
  templateKey: string;
  customIndex: number;
  customName: string;
  subjects: SubjectDraft[];
};

const OTHER_TEMPLATE_KEY = "OTHER";

const createEmptySubject = (): SubjectDraft => ({
  name: "",
  credits: 3,
  code: "",
  teacherName: "",
  chance: 1,
  score: 0,
  lectureMaterials: []
});

const toDateInput = (value: string | Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().split("T")[0];
};

const getNextSemesterIndex = (items: Array<{ index: number }>) =>
  Math.max(...items.map((item) => item.index), 0) + 1;

export default function DashboardClient({ initialUser }: DashboardClientProps) {
  const [user, setUser] = useState(initialUser);
  const [overallPercentage, setOverallPercentage] = useState(0);
  const [projection, setProjection] = useState<Projection>(null);
  const [chanceStats, setChanceStats] = useState<ChanceStats>({
    secondChanceCount: 0,
    thirdChanceCount: 0
  });
  const [retakeQueues, setRetakeQueues] = useState<RetakeQueues>({
    needSecondChance: [],
    needThirdChance: []
  });
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [addingSemester, setAddingSemester] = useState(false);
  const [deletingSemesterId, setDeletingSemesterId] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [savingEditingSemester, setSavingEditingSemester] = useState(false);
  const [sharingSemesterId, setSharingSemesterId] = useState<string | null>(null);
  const [uploadingLectureKey, setUploadingLectureKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState(() => ({
    username: initialUser.username ?? "",
    firstName: initialUser.profile?.firstName ?? "",
    lastName: initialUser.profile?.lastName ?? "",
    fatherName: initialUser.profile?.fatherName ?? "",
    university: initialUser.profile?.university ?? "",
    faculty: initialUser.profile?.faculty ?? "",
    department: initialUser.profile?.department ?? "",
    degreeLevel: initialUser.profile?.degreeLevel ?? ("BACHELOR" as DegreeLevel),
    yearOfEnrollment: initialUser.profile?.yearOfEnrollment ?? new Date().getFullYear(),
    dateOfBirth: initialUser.profile?.dateOfBirth ? toDateInput(initialUser.profile.dateOfBirth) : "",
    totalSemesters:
      initialUser.profile?.totalSemesters ??
      DEGREE_DEFAULT_SEMESTERS[initialUser.profile?.degreeLevel ?? "BACHELOR"],
    minimumPassingMarks: initialUser.profile?.minimumPassingMarks ?? 50,
    idealPercentage:
      typeof initialUser.profile?.idealPercentage === "number"
        ? initialUser.profile.idealPercentage.toString()
        : ""
  }));

  const [addSemesterForm, setAddSemesterForm] = useState<SemesterDraft>({
    templateKey: OTHER_TEMPLATE_KEY,
    customIndex: 1,
    customName: "",
    subjects: [createEmptySubject()]
  });

  const [editSemesterForm, setEditSemesterForm] = useState<SemesterDraft | null>(null);

  const [visibilityDrafts, setVisibilityDrafts] = useState<Record<string, string[]>>({});

  const completedSemesters = semesters.length;

  const semesterTemplates = useMemo(
    () =>
      buildSemesterTemplates({
        totalSemesters: Number(profileForm.totalSemesters) || 1,
        yearOfEnrollment: Number(profileForm.yearOfEnrollment) || new Date().getFullYear()
      }),
    [profileForm.totalSemesters, profileForm.yearOfEnrollment]
  );

  const usedSemesterIndexes = useMemo(() => new Set(semesters.map((semester) => semester.index)), [semesters]);

  const getTemplateForSemester = (semester: Pick<Semester, "index" | "name">) =>
    semesterTemplates.find(
      (template) =>
        template.index === semester.index &&
        (semester.name === template.name || semester.name === null || semester.name === "")
    );

  const getAvailableCreateTemplates = () =>
    semesterTemplates.filter((template) => !usedSemesterIndexes.has(template.index));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profileRes, semestersRes, friendsRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/semesters"),
      fetch("/api/friends/list")
    ]);

    if (!profileRes.ok || !semestersRes.ok || !friendsRes.ok) {
      setLoading(false);
      setError("Failed to load data");
      return;
    }

    const profileData = (await profileRes.json()) as { user: UserPayload };
    const semestersData = (await semestersRes.json()) as {
      semesters: Semester[];
      overallPercentage: number;
      projection: Projection;
      chanceStats: ChanceStats;
      retakeQueues: RetakeQueues;
    };
    const friendsData = (await friendsRes.json()) as { friends: Friend[] };

    setUser(profileData.user);
    setSemesters(semestersData.semesters);
    setOverallPercentage(semestersData.overallPercentage);
    setProjection(semestersData.projection);
    setChanceStats(semestersData.chanceStats);
    setRetakeQueues(semestersData.retakeQueues);
    setFriends(friendsData.friends);
    setVisibilityDrafts(
      Object.fromEntries(
        semestersData.semesters.map((semester) => [semester.id, semester.visibleFriendIds ?? []])
      )
    );

    const degreeLevel = profileData.user.profile?.degreeLevel ?? ("BACHELOR" as DegreeLevel);

    setProfileForm({
      username: profileData.user.username ?? "",
      firstName: profileData.user.profile?.firstName ?? "",
      lastName: profileData.user.profile?.lastName ?? "",
      fatherName: profileData.user.profile?.fatherName ?? "",
      university: profileData.user.profile?.university ?? "",
      faculty: profileData.user.profile?.faculty ?? "",
      department: profileData.user.profile?.department ?? "",
      degreeLevel,
      yearOfEnrollment: profileData.user.profile?.yearOfEnrollment ?? new Date().getFullYear(),
      dateOfBirth: profileData.user.profile?.dateOfBirth
        ? toDateInput(profileData.user.profile.dateOfBirth)
        : "",
      totalSemesters:
        profileData.user.profile?.totalSemesters ?? DEGREE_DEFAULT_SEMESTERS[degreeLevel],
      minimumPassingMarks: profileData.user.profile?.minimumPassingMarks ?? 50,
      idealPercentage:
        typeof profileData.user.profile?.idealPercentage === "number"
          ? profileData.user.profile.idealPercentage.toString()
          : ""
    });

    const templatesForUser = buildSemesterTemplates({
      totalSemesters:
        profileData.user.profile?.totalSemesters ?? DEGREE_DEFAULT_SEMESTERS[degreeLevel],
      yearOfEnrollment: profileData.user.profile?.yearOfEnrollment ?? new Date().getFullYear()
    });
    const usedIndexes = new Set(semestersData.semesters.map((semester) => semester.index));
    const available = templatesForUser.filter((template) => !usedIndexes.has(template.index));
    setAddSemesterForm({
      templateKey: available[0]?.key ?? OTHER_TEMPLATE_KEY,
      customIndex: getNextSemesterIndex(semestersData.semesters),
      customName: "",
      subjects: [createEmptySubject()]
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setMessage(null);

    const payload = {
      username: profileForm.username,
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      fatherName: profileForm.fatherName,
      university: profileForm.university,
      faculty: profileForm.faculty,
      department: profileForm.department,
      degreeLevel: profileForm.degreeLevel,
      yearOfEnrollment: Number(profileForm.yearOfEnrollment),
      dateOfBirth: profileForm.dateOfBirth,
      totalSemesters: Number(profileForm.totalSemesters),
      minimumPassingMarks: Number(profileForm.minimumPassingMarks),
      idealPercentage: profileForm.idealPercentage === "" ? null : Number(profileForm.idealPercentage)
    };

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string };

    setSavingProfile(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to save profile");
      return;
    }

    setMessage("Profile updated");
    await loadData();
  };

  const handleDegreeChange = (degreeLevel: DegreeLevel) => {
    setProfileForm((previous) => ({
      ...previous,
      degreeLevel,
      totalSemesters: DEGREE_DEFAULT_SEMESTERS[degreeLevel]
    }));
  };

  const handleProfilePhotoUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setUploadingProfilePhoto(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/profile/photo", {
      method: "POST",
      body: formData
    });

    const data = (await response.json()) as { error?: string; imageUrl?: string };

    setUploadingProfilePhoto(false);

    if (!response.ok || !data.imageUrl) {
      setError(data.error ?? "Failed to upload profile photo");
      return;
    }

    setUser((previous) => ({
      ...previous,
      image: data.imageUrl ?? null
    }));

    setMessage("Profile photo updated");
  };

  const resolveSemesterPayload = (draft: SemesterDraft) => {
    const chosenTemplate = semesterTemplates.find((template) => template.key === draft.templateKey);

    if (draft.templateKey !== OTHER_TEMPLATE_KEY && chosenTemplate) {
      return {
        index: chosenTemplate.index,
        name: chosenTemplate.name,
        subjects: draft.subjects
      };
    }

    return {
      index: Number(draft.customIndex),
      name: draft.customName.trim().length > 0 ? draft.customName.trim() : `Custom Semester ${draft.customIndex}`,
      subjects: draft.subjects
    };
  };

  const updateDraftSubject = <K extends keyof SubjectDraft>(
    mode: "add" | "edit",
    subjectIndex: number,
    key: K,
    value: SubjectDraft[K]
  ) => {
    if (mode === "add") {
      setAddSemesterForm((previous) => ({
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                [key]: value
              }
            : subject
        )
      }));
      return;
    }

    setEditSemesterForm((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                [key]: value
              }
            : subject
        )
      };
    });
  };

  const addSubjectDraft = (mode: "add" | "edit") => {
    if (mode === "add") {
      setAddSemesterForm((previous) => ({
        ...previous,
        subjects: [...previous.subjects, createEmptySubject()]
      }));
      return;
    }

    setEditSemesterForm((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        subjects: [...previous.subjects, createEmptySubject()]
      };
    });
  };

  const removeSubjectDraft = (mode: "add" | "edit", subjectIndex: number) => {
    if (mode === "add") {
      setAddSemesterForm((previous) => ({
        ...previous,
        subjects: previous.subjects.filter((_, currentIndex) => currentIndex !== subjectIndex)
      }));
      return;
    }

    setEditSemesterForm((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        subjects: previous.subjects.filter((_, currentIndex) => currentIndex !== subjectIndex)
      };
    });
  };

  const addLectureMaterial = (mode: "add" | "edit", subjectIndex: number, material: LectureMaterial) => {
    if (mode === "add") {
      setAddSemesterForm((previous) => ({
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                lectureMaterials: [...subject.lectureMaterials, material]
              }
            : subject
        )
      }));
      return;
    }

    setEditSemesterForm((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                lectureMaterials: [...subject.lectureMaterials, material]
              }
            : subject
        )
      };
    });
  };

  const removeLectureMaterial = (mode: "add" | "edit", subjectIndex: number, materialIndex: number) => {
    if (mode === "add") {
      setAddSemesterForm((previous) => ({
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                lectureMaterials: subject.lectureMaterials.filter((_, index) => index !== materialIndex)
              }
            : subject
        )
      }));
      return;
    }

    setEditSemesterForm((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        subjects: previous.subjects.map((subject, currentIndex) =>
          currentIndex === subjectIndex
            ? {
                ...subject,
                lectureMaterials: subject.lectureMaterials.filter((_, index) => index !== materialIndex)
              }
            : subject
        )
      };
    });
  };

  const uploadLecture = async (mode: "add" | "edit", subjectIndex: number, file: File | null) => {
    if (!file) {
      return;
    }

    const key = `${mode}-${subjectIndex}`;
    setUploadingLectureKey(key);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads/lecture", {
      method: "POST",
      body: formData
    });

    const data = (await response.json()) as {
      error?: string;
      material?: { name: string; url: string };
    };

    setUploadingLectureKey(null);

    if (!response.ok || !data.material) {
      setError(data.error ?? "Failed to upload lecture");
      return;
    }

    addLectureMaterial(mode, subjectIndex, {
      name: data.material.name,
      url: data.material.url
    });
  };

  const handleAddSemester = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingSemester(true);
    setError(null);
    setMessage(null);

    const resolved = resolveSemesterPayload(addSemesterForm);

    const payload = {
      index: resolved.index,
      name: resolved.name,
      subjects: resolved.subjects.map((subject) => ({
        name: subject.name,
        credits: Number(subject.credits),
        code: subject.code === "" ? null : subject.code,
        teacherName: subject.teacherName === "" ? null : subject.teacherName,
        lectureMaterials: subject.lectureMaterials,
        chance: Number(subject.chance),
        score: Number(subject.score)
      }))
    };

    const response = await fetch("/api/semesters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string };

    setAddingSemester(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create semester");
      return;
    }

    setMessage("Semester added");
    await loadData();
  };

  const startEditingSemester = (semester: Semester) => {
    const template = getTemplateForSemester(semester);
    setEditingSemesterId(semester.id);
    setEditSemesterForm({
      templateKey: template?.key ?? OTHER_TEMPLATE_KEY,
      customIndex: semester.index,
      customName: template ? "" : semester.name ?? "",
      subjects: semester.subjects.map((subject) => ({
        name: subject.name,
        credits: subject.credits,
        code: subject.code ?? "",
        teacherName: subject.teacherName ?? "",
        chance: subject.chance,
        score: subject.score,
        lectureMaterials: subject.lectureMaterials ?? []
      }))
    });
  };

  const cancelEditingSemester = () => {
    setEditingSemesterId(null);
    setEditSemesterForm(null);
  };

  const saveEditedSemester = async (semesterId: string) => {
    if (!editSemesterForm) {
      return;
    }

    setSavingEditingSemester(true);
    setError(null);
    setMessage(null);

    const resolved = resolveSemesterPayload(editSemesterForm);

    const payload = {
      index: resolved.index,
      name: resolved.name,
      subjects: resolved.subjects.map((subject) => ({
        name: subject.name,
        credits: Number(subject.credits),
        code: subject.code === "" ? null : subject.code,
        teacherName: subject.teacherName === "" ? null : subject.teacherName,
        lectureMaterials: subject.lectureMaterials,
        chance: Number(subject.chance),
        score: Number(subject.score)
      }))
    };

    const response = await fetch(`/api/semesters/${semesterId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string };

    setSavingEditingSemester(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to update semester");
      return;
    }

    setEditingSemesterId(null);
    setEditSemesterForm(null);
    setMessage("Semester updated");
    await loadData();
  };

  const handleDeleteSemester = async (semesterId: string) => {
    const shouldDelete = window.confirm("Delete this semester and all its subjects?");
    if (!shouldDelete) {
      return;
    }

    setDeletingSemesterId(semesterId);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/semesters/${semesterId}`, {
      method: "DELETE"
    });

    const data = (await response.json()) as { error?: string };

    setDeletingSemesterId(null);

    if (!response.ok) {
      setError(data.error ?? "Failed to delete semester");
      return;
    }

    setMessage("Semester deleted");
    await loadData();
  };

  const toggleFriendVisibility = (semesterId: string, friendId: string) => {
    setVisibilityDrafts((previous) => {
      const current = previous[semesterId] ?? [];
      const next = current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId];

      return {
        ...previous,
        [semesterId]: next
      };
    });
  };

  const saveVisibility = async (semesterId: string) => {
    setSharingSemesterId(semesterId);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/semesters/${semesterId}/visibility`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visibleFriendIds: visibilityDrafts[semesterId] ?? []
      })
    });

    const data = (await response.json()) as { error?: string };

    setSharingSemesterId(null);

    if (!response.ok) {
      setError(data.error ?? "Failed to update sharing");
      return;
    }

    setMessage("Visibility updated");
    await loadData();
  };

  const renderSubjectDraftCard = (
    mode: "add" | "edit",
    draft: SubjectDraft,
    subjectIndex: number,
    allowRemove: boolean
  ) => (
    <div key={`${mode}-subject-${subjectIndex}`} className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Subject {subjectIndex + 1}</p>
        {allowRemove ? (
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-wide text-red-600"
            onClick={() => removeSubjectDraft(mode, subjectIndex)}
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            className="input"
            value={draft.name}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "name", event.target.value)}
            required
          />
        </Field>

        <Field label="Code (Optional)">
          <input
            className="input"
            value={draft.code}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "code", event.target.value)}
          />
        </Field>

        <Field label="Teacher Name (Optional)">
          <input
            className="input"
            value={draft.teacherName}
            onChange={(event) =>
              updateDraftSubject(mode, subjectIndex, "teacherName", event.target.value)
            }
          />
        </Field>

        <Field label="Credits" required>
          <input
            type="number"
            className="input"
            value={draft.credits}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "credits", Number(event.target.value))}
            step={0.5}
            min={0.5}
            required
          />
        </Field>

        <Field label="Chance" required>
          <select
            className="input"
            value={draft.chance}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "chance", Number(event.target.value))}
          >
            <option value={1}>1st Chance</option>
            <option value={2}>2nd Chance</option>
            <option value={3}>3rd Chance</option>
            <option value={4}>4th Chance</option>
          </select>
        </Field>

        <Field label="Score Percentage" required>
          <input
            type="number"
            className="input"
            value={draft.score}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "score", Number(event.target.value))}
            step={0.01}
            min={0}
            max={100}
            required
          />
        </Field>
      </div>

      <div className="mt-3 rounded-xl border border-brand-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Lecture Materials ({draft.lectureMaterials.length})
          </p>
          <label className="btn-secondary cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void uploadLecture(mode, subjectIndex, file);
                event.currentTarget.value = "";
              }}
            />
            {uploadingLectureKey === `${mode}-${subjectIndex}` ? "Uploading..." : "Upload lecture"}
          </label>
        </div>

        {draft.lectureMaterials.length === 0 ? (
          <p className="mt-2 text-sm text-brand-600">No lecture files uploaded yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {draft.lectureMaterials.map((material, materialIndex) => (
              <div
                key={`${material.url}-${materialIndex}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm"
              >
                <a href={material.url} target="_blank" rel="noreferrer" className="truncate text-brand-800 underline">
                  {material.name}
                </a>
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide text-red-600"
                  onClick={() => removeLectureMaterial(mode, subjectIndex, materialIndex)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSemesterSelector = (mode: "add" | "edit", draft: SemesterDraft, semesterBeingEdited?: Semester) => {
    const options =
      mode === "add"
        ? getAvailableCreateTemplates()
        : semesterTemplates.filter(
            (template) =>
              template.index === semesterBeingEdited?.index || !usedSemesterIndexes.has(template.index)
          );

    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Semester Template" required>
          <select
            className="input"
            value={draft.templateKey}
            onChange={(event) => {
              const value = event.target.value;
              if (mode === "add") {
                setAddSemesterForm((previous) => ({ ...previous, templateKey: value }));
                return;
              }
              setEditSemesterForm((previous) => (previous ? { ...previous, templateKey: value } : previous));
            }}
          >
            {options.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
            <option value={OTHER_TEMPLATE_KEY}>Other (custom)</option>
          </select>
        </Field>

        {draft.templateKey === OTHER_TEMPLATE_KEY ? (
          <>
            <Field label="Custom Semester Index" required>
              <input
                type="number"
                className="input"
                value={draft.customIndex}
                min={1}
                max={50}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (mode === "add") {
                    setAddSemesterForm((previous) => ({ ...previous, customIndex: value }));
                    return;
                  }
                  setEditSemesterForm((previous) =>
                    previous ? { ...previous, customIndex: value } : previous
                  );
                }}
              />
            </Field>

            <Field label="Custom Semester Name" required>
              <input
                className="input"
                value={draft.customName}
                onChange={(event) => {
                  const value = event.target.value;
                  if (mode === "add") {
                    setAddSemesterForm((previous) => ({ ...previous, customName: value }));
                    return;
                  }
                  setEditSemesterForm((previous) =>
                    previous ? { ...previous, customName: value } : previous
                  );
                }}
                required
              />
            </Field>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section className="hero-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Academic Control Center</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              {user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : "Student Dashboard"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-brand-100">
              Track semester performance, manage retakes, upload lecture resources, and control visibility for each friend.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
            <Image
              src={user.image ?? "/avatar-placeholder.svg"}
              alt="Profile"
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-white">@{user.username ?? "student"}</p>
              <p className="text-xs text-brand-100">{user.email ?? "No email"}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? <div className="panel">Loading...</div> : null}
      {error ? <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div> : null}
      {message ? <div className="panel border-emerald-200 text-sm font-medium text-emerald-700">{message}</div> : null}

      {!loading ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric title="Overall Percentage" value={`${overallPercentage.toFixed(2)}%`} />
            <Metric title="Completed Semesters" value={`${completedSemesters}`} />
            <Metric title="Subjects in 2nd Chance" value={`${chanceStats.secondChanceCount}`} />
            <Metric title="Subjects in 3rd Chance" value={`${chanceStats.thirdChanceCount}`} />
            <Metric
              title="Needed in Remaining"
              value={
                projection
                  ? `${projection.requiredAverage.toFixed(2)}%`
                  : "Set ideal %"
              }
              subtitle={
                projection
                  ? `${projection.remainingSemesters} semesters left`
                  : "Add ideal percentage in profile"
              }
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-brand-950">Profile</h2>
                <label className="btn-secondary cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleProfilePhotoUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingProfilePhoto ? "Uploading photo..." : "Upload photo"}
                </label>
              </div>

              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleProfileSubmit}>
                <Field label="Email">
                  <input className="input bg-brand-50" value={user.email ?? "No email"} readOnly />
                </Field>

                <Field label="Username" required>
                  <input
                    className="input"
                    value={profileForm.username}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        username: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Degree Level" required>
                  <select
                    className="input"
                    value={profileForm.degreeLevel}
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
                    value={profileForm.firstName}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        firstName: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Last Name" required>
                  <input
                    className="input"
                    value={profileForm.lastName}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        lastName: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Father Name" required>
                  <input
                    className="input"
                    value={profileForm.fatherName}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        fatherName: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="University" required>
                  <input
                    className="input"
                    value={profileForm.university}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        university: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Faculty" required>
                  <input
                    className="input"
                    value={profileForm.faculty}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        faculty: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Department" required>
                  <input
                    className="input"
                    value={profileForm.department}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        department: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Year of Enrollment" required>
                  <input
                    type="number"
                    className="input"
                    value={profileForm.yearOfEnrollment}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        yearOfEnrollment: Number(event.target.value)
                      }))
                    }
                    min={1900}
                    max={2100}
                    required
                  />
                </Field>

                <Field label="Date of Birth" required>
                  <input
                    type="date"
                    className="input"
                    value={profileForm.dateOfBirth}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        dateOfBirth: event.target.value
                      }))
                    }
                    required
                  />
                </Field>

                <Field label="Total Semesters" required>
                  <input
                    type="number"
                    className="input"
                    value={profileForm.totalSemesters}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        totalSemesters: Number(event.target.value)
                      }))
                    }
                    min={1}
                    max={20}
                    required
                  />
                </Field>

                <Field label="Minimum Passing Marks" required>
                  <input
                    type="number"
                    className="input"
                    value={profileForm.minimumPassingMarks}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        minimumPassingMarks: Number(event.target.value)
                      }))
                    }
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
                    value={profileForm.idealPercentage}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        idealPercentage: event.target.value
                      }))
                    }
                    min={0}
                    max={100}
                    step={0.01}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary w-full" disabled={savingProfile}>
                    {savingProfile ? "Saving profile..." : "Save profile"}
                  </button>
                </div>
              </form>
            </div>

            <div className="panel">
              <h2 className="mb-3 text-xl font-bold text-brand-950">Add Semester</h2>

              <form className="space-y-4" onSubmit={handleAddSemester}>
                {renderSemesterSelector("add", addSemesterForm)}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                      Subjects ({addSemesterForm.subjects.length})
                    </h3>
                    <button type="button" className="btn-secondary" onClick={() => addSubjectDraft("add")}>
                      Add subject
                    </button>
                  </div>

                  {addSemesterForm.subjects.map((draft, index) =>
                    renderSubjectDraftCard("add", draft, index, addSemesterForm.subjects.length > 1)
                  )}
                </div>

                <button type="submit" className="btn-primary w-full" disabled={addingSemester}>
                  {addingSemester ? "Adding semester..." : "Save semester"}
                </button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="panel">
              <h2 className="text-lg font-bold text-brand-950">Need 2nd Chance</h2>
              <p className="mt-1 text-sm text-brand-700">
                Subjects below {profileForm.minimumPassingMarks}% in first chance.
              </p>
              {retakeQueues.needSecondChance.length === 0 ? (
                <p className="mt-3 text-sm text-brand-700">No subjects currently require a 2nd chance.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {retakeQueues.needSecondChance.map((item) => (
                    <RetakeCard key={`second-${item.id}`} item={item} />
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <h2 className="text-lg font-bold text-brand-950">Need 3rd Chance</h2>
              <p className="mt-1 text-sm text-brand-700">
                Subjects below {profileForm.minimumPassingMarks}% in second chance.
              </p>
              {retakeQueues.needThirdChance.length === 0 ? (
                <p className="mt-3 text-sm text-brand-700">No subjects currently require a 3rd chance.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {retakeQueues.needThirdChance.map((item) => (
                    <RetakeCard key={`third-${item.id}`} item={item} />
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-brand-950">Your Semesters</h2>

            {semesters.length === 0 ? (
              <div className="panel text-sm text-brand-700">
                No semesters added yet. Start with your first semester record.
              </div>
            ) : (
              semesters.map((semester) => {
                const isEditing = editingSemesterId === semester.id && editSemesterForm !== null;

                return (
                  <article key={semester.id} className="panel space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => startEditingSemester(semester)}
                      >
                        <h3 className="text-lg font-bold text-brand-950">
                          Semester {semester.index}
                          {semester.name ? ` - ${semester.name}` : ""}
                        </h3>
                        <p className="text-sm text-brand-700">
                          Percentage: <strong>{semester.percentage.toFixed(2)}%</strong> - click semester or subject row to edit
                        </p>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => startEditingSemester(semester)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                          onClick={() => handleDeleteSemester(semester.id)}
                          disabled={deletingSemesterId === semester.id}
                        >
                          {deletingSemesterId === semester.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 overflow-hidden rounded-xl border border-brand-200">
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
                            <tr
                              key={subject.id}
                              className="cursor-pointer hover:bg-brand-50"
                              onClick={() => startEditingSemester(semester)}
                            >
                              <td className="px-3 py-2">{subject.name}</td>
                              <td className="px-3 py-2">{subject.teacherName ?? "-"}</td>
                              <td className="px-3 py-2">{subject.code ?? "-"}</td>
                              <td className="px-3 py-2">{subject.credits}</td>
                              <td className="px-3 py-2">{subject.chance}</td>
                              <td className="px-3 py-2">{subject.score.toFixed(2)}%</td>
                              <td className="px-3 py-2">{subject.lectureMaterials.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {isEditing && editSemesterForm ? (
                      <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">
                          Edit Semester
                        </h4>

                        <div className="space-y-4">
                          {renderSemesterSelector("edit", editSemesterForm, semester)}

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                                Editable Subjects ({editSemesterForm.subjects.length})
                              </p>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => addSubjectDraft("edit")}
                              >
                                Add subject
                              </button>
                            </div>

                            {editSemesterForm.subjects.map((draft, index) =>
                              renderSubjectDraftCard(
                                "edit",
                                draft,
                                index,
                                editSemesterForm.subjects.length > 1
                              )
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => void saveEditedSemester(semester.id)}
                              disabled={savingEditingSemester}
                            >
                              {savingEditingSemester ? "Saving..." : "Save semester changes"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={cancelEditingSemester}
                              disabled={savingEditingSemester}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                          Friend Visibility
                        </h4>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={sharingSemesterId === semester.id}
                          onClick={() => saveVisibility(semester.id)}
                        >
                          {sharingSemesterId === semester.id ? "Saving..." : "Save visibility"}
                        </button>
                      </div>

                      {friends.length === 0 ? (
                        <p className="text-sm text-brand-700">
                          No accepted friends yet. Add friends from the Friends page to share semesters.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {friends.map((friend) => (
                            <label
                              key={`${semester.id}-${friend.id}`}
                              className="flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={(visibilityDrafts[semester.id] ?? []).includes(friend.id)}
                                onChange={() => toggleFriendVisibility(semester.id, friend.id)}
                              />
                              <span>{friend.username ?? friend.email ?? "Friend"}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : null}
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

type MetricProps = {
  title: string;
  value: string;
  subtitle?: string;
};

function Metric({ title, value, subtitle }: MetricProps) {
  return (
    <article className="metric-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{title}</p>
      <p className="mt-2 text-2xl font-black text-brand-950">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-brand-700">{subtitle}</p> : null}
    </article>
  );
}

function RetakeCard({ item }: { item: RetakeItem }) {
  return (
    <article className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
      <p className="font-semibold text-orange-900">{item.name}</p>
      <p className="text-xs text-orange-800">
        Semester {item.semesterIndex}
        {item.semesterName ? ` (${item.semesterName})` : ""} - Score {item.score.toFixed(2)}%
      </p>
      <p className="text-xs text-orange-700">Current chance: {item.chance}</p>
      {item.teacherName ? <p className="text-xs text-orange-700">Teacher: {item.teacherName}</p> : null}
    </article>
  );
}
