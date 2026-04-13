"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DEGREE_DEFAULT_SEMESTERS, DEGREE_LABELS, DegreeLevel } from "@/lib/academic";

type SemesterStatus = "ONGOING" | "FINISHED";
type PostVisibility = "FRIENDS" | "PUBLIC";

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
  status: SemesterStatus;
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

type PostComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string | null;
    email: string | null;
    image: string | null;
    profile: {
      firstName: string;
      lastName: string;
    } | null;
  };
};

type Post = {
  id: string;
  content: string;
  visibility: PostVisibility;
  includeOverallPercentage: boolean;
  overallPercentageSnapshot: number | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
    profile: {
      firstName: string;
      lastName: string;
      university: string;
    } | null;
  };
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  comments: PostComment[];
  sharedSemesters: Array<{
    id: string;
    index: number;
    name: string | null;
    status: SemesterStatus;
    percentage: number;
    subjects: Array<{
      id: string;
      name: string;
      credits: number;
      chance: number;
      score: number;
      code: string | null;
      teacherName: string | null;
    }>;
  }>;
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
  index: number;
  name: string;
  status: SemesterStatus;
  subjects: SubjectDraft[];
};

type TranscriptOptions = {
  showFatherName: boolean;
  showUniversity: boolean;
  showFaculty: boolean;
  showDepartment: boolean;
  showSemesterStatus: boolean;
  showCredits: boolean;
  showTeacher: boolean;
  showCode: boolean;
  showChance: boolean;
};

type ExcelIssue = {
  row: number;
  field: string;
  message: string;
};

type ActiveView = "FEED" | "PROFILE" | "SEMESTERS";

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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const formatSemesterNumber = (index: number, totalSemesters: number) => {
  const padLength = String(Math.max(totalSemesters, 9)).length;
  return String(index).padStart(padLength, "0");
};

const getFirstAvailableIndex = (semesters: Array<{ index: number }>, totalSemesters: number) => {
  const used = new Set(semesters.map((semester) => semester.index));
  for (let index = 1; index <= totalSemesters; index += 1) {
    if (!used.has(index)) {
      return index;
    }
  }
  return totalSemesters;
};

const createInitialProfileForm = (user: UserPayload) => ({
  username: user.username ?? "",
  firstName: user.profile?.firstName ?? "",
  lastName: user.profile?.lastName ?? "",
  fatherName: user.profile?.fatherName ?? "",
  university: user.profile?.university ?? "",
  faculty: user.profile?.faculty ?? "",
  department: user.profile?.department ?? "",
  degreeLevel: user.profile?.degreeLevel ?? ("BACHELOR" as DegreeLevel),
  yearOfEnrollment: user.profile?.yearOfEnrollment ?? new Date().getFullYear(),
  dateOfBirth: user.profile?.dateOfBirth ? toDateInput(user.profile.dateOfBirth) : "",
  totalSemesters:
    user.profile?.totalSemesters ?? DEGREE_DEFAULT_SEMESTERS[user.profile?.degreeLevel ?? "BACHELOR"],
  minimumPassingMarks: user.profile?.minimumPassingMarks ?? 50,
  idealPercentage:
    typeof user.profile?.idealPercentage === "number" ? user.profile.idealPercentage.toString() : ""
});

export default function DashboardClient({ initialUser }: DashboardClientProps) {
  const [activeView, setActiveView] = useState<ActiveView>("FEED");

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
  const [completedSemesters, setCompletedSemesters] = useState(0);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [addingSemester, setAddingSemester] = useState(false);
  const [deletingSemesterId, setDeletingSemesterId] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [savingEditingSemester, setSavingEditingSemester] = useState(false);
  const [sharingSemesterId, setSharingSemesterId] = useState<string | null>(null);
  const [uploadingLectureKey, setUploadingLectureKey] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);
  const [generatingTranscript, setGeneratingTranscript] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excelIssues, setExcelIssues] = useState<ExcelIssue[]>([]);

  const [profileForm, setProfileForm] = useState(() => createInitialProfileForm(initialUser));

  const [addSemesterForm, setAddSemesterForm] = useState<SemesterDraft>({
    index: 1,
    name: "",
    status: "ONGOING",
    subjects: [createEmptySubject()]
  });

  const [editSemesterForm, setEditSemesterForm] = useState<SemesterDraft | null>(null);

  const [visibilityDrafts, setVisibilityDrafts] = useState<Record<string, string[]>>({});

  const [postForm, setPostForm] = useState({
    content: "",
    visibility: "FRIENDS" as PostVisibility,
    includeOverallPercentage: false,
    sharedSemesterIds: [] as string[]
  });

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const [transcriptOptions, setTranscriptOptions] = useState<TranscriptOptions>({
    showFatherName: true,
    showUniversity: true,
    showFaculty: true,
    showDepartment: true,
    showSemesterStatus: true,
    showCredits: true,
    showTeacher: true,
    showCode: true,
    showChance: true
  });

  const totalSemesters = Math.max(1, Number(profileForm.totalSemesters) || 1);

  const usedSemesterIndexes = useMemo(
    () => new Set(semesters.map((semester) => semester.index)),
    [semesters]
  );

  const availableSemesterCount = Math.max(totalSemesters - usedSemesterIndexes.size, 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profileRes, semestersRes, friendsRes, postsRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/semesters"),
      fetch("/api/friends/list"),
      fetch("/api/posts")
    ]);

    if (!profileRes.ok || !semestersRes.ok || !friendsRes.ok || !postsRes.ok) {
      setLoading(false);
      setError("Failed to load dashboard data");
      return;
    }

    const profileData = (await profileRes.json()) as { user: UserPayload };
    const semestersData = (await semestersRes.json()) as {
      semesters: Semester[];
      overallPercentage: number;
      projection: Projection;
      chanceStats: ChanceStats;
      retakeQueues: RetakeQueues;
      completedSemesters?: number;
      finishedSemesters?: number;
    };
    const friendsData = (await friendsRes.json()) as { friends: Friend[] };
    const postsData = (await postsRes.json()) as { posts: Post[] };

    setUser(profileData.user);
    setSemesters(semestersData.semesters);
    setOverallPercentage(semestersData.overallPercentage);
    setProjection(semestersData.projection);
    setChanceStats(semestersData.chanceStats);
    setRetakeQueues(semestersData.retakeQueues);
    setFriends(friendsData.friends);
    setPosts(postsData.posts);

    const finishedCount =
      typeof semestersData.completedSemesters === "number"
        ? semestersData.completedSemesters
        : typeof semestersData.finishedSemesters === "number"
          ? semestersData.finishedSemesters
          : semestersData.semesters.filter((semester) => semester.status === "FINISHED").length;
    setCompletedSemesters(finishedCount);

    setVisibilityDrafts(
      Object.fromEntries(
        semestersData.semesters.map((semester) => [semester.id, semester.visibleFriendIds ?? []])
      )
    );

    setProfileForm(createInitialProfileForm(profileData.user));

    const resolvedTotalSemesters =
      profileData.user.profile?.totalSemesters ?? DEGREE_DEFAULT_SEMESTERS.BACHELOR;

    setAddSemesterForm((previous) => ({
      ...previous,
      index: getFirstAvailableIndex(semestersData.semesters, resolvedTotalSemesters)
    }));

    setPostForm((previous) => ({
      ...previous,
      sharedSemesterIds: previous.sharedSemesterIds.filter((id) =>
        semestersData.semesters.some((semester) => semester.id === id)
      )
    }));

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clearNotifications = () => {
    setError(null);
    setMessage(null);
    setExcelIssues([]);
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    clearNotifications();

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
    clearNotifications();

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

  const resolveSemesterPayload = (draft: SemesterDraft) => ({
    index: Number(draft.index),
    name: draft.name.trim().length > 0 ? draft.name.trim() : null,
    status: draft.status,
    subjects: draft.subjects.map((subject) => ({
      name: subject.name,
      credits: Number(subject.credits),
      code: subject.code === "" ? null : subject.code,
      teacherName: subject.teacherName === "" ? null : subject.teacherName,
      lectureMaterials: subject.lectureMaterials,
      chance: Number(subject.chance),
      score: Number(subject.score)
    }))
  });

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
    clearNotifications();

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
    clearNotifications();

    if (availableSemesterCount <= 0) {
      setAddingSemester(false);
      setError(`You already used all ${totalSemesters} semester slots. Increase total semesters in profile if needed.`);
      return;
    }

    const payload = resolveSemesterPayload(addSemesterForm);

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
    setEditingSemesterId(semester.id);
    setEditSemesterForm({
      index: semester.index,
      name: semester.name ?? "",
      status: semester.status,
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
    clearNotifications();

    const payload = resolveSemesterPayload(editSemesterForm);

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
    clearNotifications();

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
    clearNotifications();

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

  const handleExportExcel = async () => {
    setExportingExcel(true);
    clearNotifications();

    try {
      const response = await fetch("/api/reports/excel");

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Failed to export Excel report");
        setExportingExcel(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `marks-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage("Excel report downloaded");
    } catch (requestError) {
      console.error("Excel export failed", requestError);
      setError("Failed to export Excel report");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleImportExcel = async (file: File | null) => {
    if (!file) {
      return;
    }

    setImportingExcel(true);
    clearNotifications();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/reports/excel", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
        issues?: ExcelIssue[];
      };

      if (!response.ok) {
        if (data.issues && data.issues.length > 0) {
          setExcelIssues(data.issues);
          setError(data.error ?? "Excel file has validation issues");
        } else {
          setError(data.error ?? "Failed to import Excel report");
        }
        return;
      }

      setMessage(data.message ?? "Excel marks imported");
      await loadData();
    } catch (requestError) {
      console.error("Excel import failed", requestError);
      setError("Failed to import Excel report");
    } finally {
      setImportingExcel(false);
    }
  };

  const toggleSemesterForPost = (semesterId: string) => {
    setPostForm((previous) => ({
      ...previous,
      sharedSemesterIds: previous.sharedSemesterIds.includes(semesterId)
        ? previous.sharedSemesterIds.filter((id) => id !== semesterId)
        : [...previous.sharedSemesterIds, semesterId]
    }));
  };

  const createPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPosting(true);
    clearNotifications();

    const payload = {
      content: postForm.content,
      visibility: postForm.visibility,
      includeOverallPercentage: postForm.includeOverallPercentage,
      sharedSemesterIds: postForm.sharedSemesterIds
    };

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as { error?: string; post?: Post };
    setPosting(false);

    if (!response.ok || !data.post) {
      setError(data.error ?? "Failed to publish post");
      return;
    }

    setPostForm({
      content: "",
      visibility: "FRIENDS",
      includeOverallPercentage: false,
      sharedSemesterIds: []
    });

    setPosts((previous) => [data.post as Post, ...previous]);
    setMessage("Post published");
  };

  const toggleLike = async (postId: string) => {
    clearNotifications();

    const response = await fetch(`/api/posts/${postId}/like`, {
      method: "POST"
    });

    const data = (await response.json()) as { error?: string; liked?: boolean; likesCount?: number };

    if (!response.ok || typeof data.liked !== "boolean" || typeof data.likesCount !== "number") {
      setError(data.error ?? "Failed to update like");
      return;
    }

    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByMe: data.liked ?? post.likedByMe,
              likesCount: data.likesCount ?? post.likesCount
            }
          : post
      )
    );
  };

  const addComment = async (postId: string) => {
    const content = (commentDrafts[postId] ?? "").trim();
    if (content.length === 0) {
      setError("Comment cannot be empty");
      return;
    }

    setPostingCommentId(postId);
    clearNotifications();

    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    });

    const data = (await response.json()) as {
      error?: string;
      comment?: PostComment;
      commentsCount?: number;
    };

    setPostingCommentId(null);

    if (!response.ok || !data.comment || typeof data.commentsCount !== "number") {
      setError(data.error ?? "Failed to add comment");
      return;
    }

    setCommentDrafts((previous) => ({
      ...previous,
      [postId]: ""
    }));

    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, data.comment as PostComment],
              commentsCount: data.commentsCount ?? post.commentsCount
            }
          : post
      )
    );
  };

  const downloadTranscriptPdf = async () => {
    setGeneratingTranscript(true);
    clearNotifications();

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ unit: "mm", format: "a4" });

      doc.setFillColor(18, 74, 61);
      doc.rect(0, 0, 210, 34, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(17);
      doc.setFont("helvetica", "bold");
      doc.text("Official Academic Transcript", 14, 13);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("UniversityBOOK - Student Report", 14, 19);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

      const studentName = `${profileForm.firstName} ${profileForm.lastName}`.trim() || user.username || "Student";
      doc.text(`Student: ${studentName}`, 14, 30);

      const infoRows: string[][] = [
        ["Username", profileForm.username || "-"],
        ["Email", user.email ?? "-"],
        ["Degree", DEGREE_LABELS[profileForm.degreeLevel]],
        ["Year Of Enrollment", String(profileForm.yearOfEnrollment)],
        ["Date Of Birth", profileForm.dateOfBirth || "-"],
        ["Total Semesters", String(profileForm.totalSemesters)]
      ];

      if (transcriptOptions.showFatherName) {
        infoRows.push(["Father Name", profileForm.fatherName || "-"]);
      }
      if (transcriptOptions.showUniversity) {
        infoRows.push(["University", profileForm.university || "-"]);
      }
      if (transcriptOptions.showFaculty) {
        infoRows.push(["Faculty", profileForm.faculty || "-"]);
      }
      if (transcriptOptions.showDepartment) {
        infoRows.push(["Department", profileForm.department || "-"]);
      }

      infoRows.push(["Overall Percentage", `${overallPercentage.toFixed(2)}%`]);
      infoRows.push(["Finished Semesters", String(completedSemesters)]);

      autoTable(doc, {
        startY: 40,
        head: [["Field", "Value"]],
        body: infoRows,
        theme: "grid",
        headStyles: {
          fillColor: [24, 96, 78]
        },
        styles: {
          fontSize: 9
        }
      });

      let currentY = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;

      const sortedSemesters = [...semesters].sort((a, b) => a.index - b.index);

      for (const semester of sortedSemesters) {
        if (currentY > 235) {
          doc.addPage();
          currentY = 20;
        }

        const semesterNumber = formatSemesterNumber(semester.index, totalSemesters);
        doc.setTextColor(28, 35, 31);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const statusText = transcriptOptions.showSemesterStatus ? ` (${semester.status})` : "";
        doc.text(
          `Semester ${semesterNumber}${semester.name ? ` - ${semester.name}` : ""}${statusText}`,
          14,
          currentY + 5
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Semester Percentage: ${semester.percentage.toFixed(2)}%`, 14, currentY + 10);

        const columns = ["Subject", "Score %"];
        if (transcriptOptions.showCredits) {
          columns.push("Credits");
        }
        if (transcriptOptions.showChance) {
          columns.push("Chance");
        }
        if (transcriptOptions.showCode) {
          columns.push("Code");
        }
        if (transcriptOptions.showTeacher) {
          columns.push("Teacher");
        }

        const body = semester.subjects.map((subject) => {
          const row = [subject.name, subject.score.toFixed(2)];
          if (transcriptOptions.showCredits) {
            row.push(String(subject.credits));
          }
          if (transcriptOptions.showChance) {
            row.push(String(subject.chance));
          }
          if (transcriptOptions.showCode) {
            row.push(subject.code ?? "-");
          }
          if (transcriptOptions.showTeacher) {
            row.push(subject.teacherName ?? "-");
          }
          return row;
        });

        autoTable(doc, {
          startY: currentY + 13,
          head: [columns],
          body,
          theme: "grid",
          headStyles: {
            fillColor: [38, 120, 99]
          },
          styles: {
            fontSize: 8
          }
        });

        currentY = ((doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 8;
      }

      const safeUsername = (user.username ?? "student").replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`transcript-${safeUsername}.pdf`);

      setMessage("Transcript PDF downloaded");
    } catch (requestError) {
      console.error("PDF generation failed", requestError);
      setError("Failed to generate transcript PDF");
    } finally {
      setGeneratingTranscript(false);
    }
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
            dir="auto"
            value={draft.name}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "name", event.target.value)}
            required
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

        <Field label="Code (Optional)">
          <input
            className="input"
            dir="auto"
            value={draft.code}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "code", event.target.value)}
          />
        </Field>

        <Field label="Teacher Name (Optional)">
          <input
            className="input"
            dir="auto"
            value={draft.teacherName}
            onChange={(event) => updateDraftSubject(mode, subjectIndex, "teacherName", event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 rounded-xl border border-brand-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Lecture Materials (Optional) ({draft.lectureMaterials.length})
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
          <p className="mt-2 text-sm text-brand-600">No lecture files uploaded.</p>
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

  return (
    <div className="space-y-8">
      <section className="hero-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">UniversityBOOK</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-brand-100">
              Feed-first workspace. Open Profile to edit your information and Add Semester to manage marks.
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

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeView === "FEED"
                ? "bg-white text-brand-900"
                : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => setActiveView("FEED")}
          >
            Feed
          </button>
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeView === "PROFILE"
                ? "bg-white text-brand-900"
                : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => setActiveView("PROFILE")}
          >
            Profile
          </button>
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeView === "SEMESTERS"
                ? "bg-white text-brand-900"
                : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={() => setActiveView("SEMESTERS")}
          >
            Add Semester
          </button>
        </div>
      </section>

      {loading ? <div className="panel">Loading dashboard...</div> : null}
      {error ? <div className="panel border-red-200 text-sm font-medium text-red-700">{error}</div> : null}
      {message ? <div className="panel border-emerald-200 text-sm font-medium text-emerald-700">{message}</div> : null}

      {!loading && activeView === "FEED" ? (
        <>
          <section className="panel space-y-4">
            <h2 className="text-xl font-bold text-brand-950">Create Post</h2>
            <form className="space-y-4" onSubmit={createPost}>
              <Field label="Text (Optional if sharing semesters/overall)">
                <textarea
                  className="input min-h-28"
                  dir="auto"
                  value={postForm.content}
                  onChange={(event) =>
                    setPostForm((previous) => ({
                      ...previous,
                      content: event.target.value
                    }))
                  }
                  placeholder="Share an update, question, or summary..."
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Visibility" required>
                  <select
                    className="input"
                    value={postForm.visibility}
                    onChange={(event) =>
                      setPostForm((previous) => ({
                        ...previous,
                        visibility: event.target.value as PostVisibility
                      }))
                    }
                  >
                    <option value="FRIENDS">Friends</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </Field>

                <label className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
                  <input
                    type="checkbox"
                    checked={postForm.includeOverallPercentage}
                    onChange={(event) =>
                      setPostForm((previous) => ({
                        ...previous,
                        includeOverallPercentage: event.target.checked
                      }))
                    }
                  />
                  Include overall percentage snapshot
                </label>
              </div>

              <div className="rounded-xl border border-brand-200 bg-white p-3">
                <p className="text-sm font-semibold text-brand-900">Share semester marks</p>
                <p className="text-xs text-brand-700">Select one or more semesters to attach to this post.</p>
                {semesters.length === 0 ? (
                  <p className="mt-2 text-sm text-brand-700">No semesters available to share yet.</p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {semesters.map((semester) => {
                      const label = formatSemesterNumber(semester.index, totalSemesters);
                      return (
                        <label
                          key={semester.id}
                          className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={postForm.sharedSemesterIds.includes(semester.id)}
                            onChange={() => toggleSemesterForPost(semester.id)}
                          />
                          <span>
                            Semester {label}
                            {semester.name ? ` - ${semester.name}` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" disabled={posting}>
                {posting ? "Publishing..." : "Publish post"}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-brand-950">Feed</h2>
            {posts.length === 0 ? (
              <div className="panel text-sm text-brand-700">No posts yet. Create the first post.</div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className="panel space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={post.author.image ?? "/avatar-placeholder.svg"}
                        alt="Author"
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-xl border border-brand-200 object-cover"
                      />
                      <div>
                        <p className="font-semibold text-brand-950">
                          {post.author.profile
                            ? `${post.author.profile.firstName} ${post.author.profile.lastName}`
                            : post.author.username ?? post.author.email ?? post.author.name ?? "Student"}
                        </p>
                        <p className="text-xs text-brand-700">
                          @{post.author.username ?? "user"} · {formatDateTime(post.createdAt)} · {post.visibility}
                        </p>
                      </div>
                    </div>
                  </div>

                  {post.content.trim().length > 0 ? (
                    <p className="whitespace-pre-wrap text-sm text-brand-900" dir="auto">
                      {post.content}
                    </p>
                  ) : null}

                  {post.includeOverallPercentage && typeof post.overallPercentageSnapshot === "number" ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                      Shared Overall Percentage: {post.overallPercentageSnapshot.toFixed(2)}%
                    </div>
                  ) : null}

                  {post.sharedSemesters.length > 0 ? (
                    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                      <p className="text-sm font-semibold text-brand-900">Shared Semester Marks</p>
                      {post.sharedSemesters.map((semester) => (
                        <div key={`${post.id}-${semester.id}`} className="overflow-hidden rounded-lg border border-brand-200 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 px-3 py-2">
                            <p className="text-sm font-semibold text-brand-900">
                              Semester {formatSemesterNumber(semester.index, totalSemesters)}
                              {semester.name ? ` - ${semester.name}` : ""}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`badge ${semester.status === "FINISHED" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                                {semester.status}
                              </span>
                              <span className="text-xs font-semibold text-brand-700">{semester.percentage.toFixed(2)}%</span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-brand-50 text-left text-brand-700">
                                <tr>
                                  <th className="px-3 py-2">Subject</th>
                                  <th className="px-3 py-2">Score</th>
                                  <th className="px-3 py-2">Chance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-brand-100">
                                {semester.subjects.map((subject) => (
                                  <tr key={subject.id}>
                                    <td className="px-3 py-2">{subject.name}</td>
                                    <td className="px-3 py-2">{subject.score.toFixed(2)}%</td>
                                    <td className="px-3 py-2">{subject.chance}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={`btn-secondary ${post.likedByMe ? "border-brand-500 bg-brand-100" : ""}`}
                      onClick={() => void toggleLike(post.id)}
                    >
                      {post.likedByMe ? "Liked" : "Like"} ({post.likesCount})
                    </button>
                    <span className="text-xs text-brand-700">Comments: {post.commentsCount}</span>
                  </div>

                  <div className="space-y-2 rounded-xl border border-brand-200 bg-white p-3">
                    {post.comments.length === 0 ? (
                      <p className="text-sm text-brand-700">No comments yet.</p>
                    ) : (
                      post.comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
                          <p className="text-xs font-semibold text-brand-800">
                            {comment.user.profile
                              ? `${comment.user.profile.firstName} ${comment.user.profile.lastName}`
                              : comment.user.username ?? comment.user.email ?? "User"}
                            <span className="ml-2 font-normal text-brand-600">{formatDateTime(comment.createdAt)}</span>
                          </p>
                          <p className="mt-1 text-sm text-brand-900" dir="auto">
                            {comment.content}
                          </p>
                        </div>
                      ))
                    )}

                    <div className="flex gap-2">
                      <input
                        className="input"
                        placeholder="Write a comment..."
                        dir="auto"
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((previous) => ({
                            ...previous,
                            [post.id]: event.target.value
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={postingCommentId === post.id}
                        onClick={() => void addComment(post.id)}
                      >
                        {postingCommentId === post.id ? "Posting..." : "Comment"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      ) : null}

      {!loading && activeView === "PROFILE" ? (
        <section className="grid gap-5 lg:grid-cols-[2fr,1fr]">
          <div className="panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-950">Profile Information</h2>
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
                  dir="auto"
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
                  dir="auto"
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
                  dir="auto"
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
                  dir="auto"
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
                  dir="auto"
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
                  dir="auto"
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
                  dir="auto"
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
                  max={50}
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

          <div className="space-y-4">
            <article className="panel">
              <h3 className="text-lg font-bold text-brand-950">Performance Snapshot</h3>
              <div className="mt-3 space-y-3">
                <Metric title="Overall Percentage" value={`${overallPercentage.toFixed(2)}%`} />
                <Metric title="Finished Semesters" value={`${completedSemesters}`} />
                <Metric title="Subjects in 2nd Chance" value={`${chanceStats.secondChanceCount}`} />
                <Metric title="Subjects in 3rd Chance" value={`${chanceStats.thirdChanceCount}`} />
                <Metric
                  title="Needed in Remaining"
                  value={projection ? `${projection.requiredAverage.toFixed(2)}%` : "Set ideal %"}
                  subtitle={projection ? `${projection.remainingSemesters} semesters left` : "Add ideal percentage"}
                />
              </div>
            </article>

            <article className="panel space-y-3">
              <h3 className="text-lg font-bold text-brand-950">Transcript PDF</h3>
              <p className="text-sm text-brand-700">
                Choose which fields to display in your official transcript and download it.
              </p>

              <div className="grid gap-2 text-sm text-brand-900">
                {(
                  [
                    ["showFatherName", "Show father name"],
                    ["showUniversity", "Show university"],
                    ["showFaculty", "Show faculty"],
                    ["showDepartment", "Show department"],
                    ["showSemesterStatus", "Show semester status"],
                    ["showCredits", "Show credits"],
                    ["showTeacher", "Show teacher"],
                    ["showCode", "Show subject code"],
                    ["showChance", "Show chance"]
                  ] as Array<[keyof TranscriptOptions, string]>
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={transcriptOptions[key]}
                      onChange={(event) =>
                        setTranscriptOptions((previous) => ({
                          ...previous,
                          [key]: event.target.checked
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <button type="button" className="btn-primary w-full" disabled={generatingTranscript} onClick={() => void downloadTranscriptPdf()}>
                {generatingTranscript ? "Generating transcript..." : "Download transcript PDF"}
              </button>
            </article>
          </div>
        </section>
      ) : null}

      {!loading && activeView === "SEMESTERS" ? (
        <>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="panel">
              <h2 className="mb-3 text-xl font-bold text-brand-950">Add Semester</h2>
              <p className="mb-3 text-sm text-brand-700">
                Semester number is manual. Allowed range: {formatSemesterNumber(1, totalSemesters)} to {formatSemesterNumber(totalSemesters, totalSemesters)}.
              </p>

              <form className="space-y-4" onSubmit={handleAddSemester}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Semester Number" required>
                    <input
                      type="number"
                      className="input"
                      value={addSemesterForm.index}
                      min={1}
                      max={totalSemesters}
                      onChange={(event) =>
                        setAddSemesterForm((previous) => ({
                          ...previous,
                          index: Number(event.target.value)
                        }))
                      }
                      required
                    />
                  </Field>

                  <Field label="Status" required>
                    <select
                      className="input"
                      value={addSemesterForm.status}
                      onChange={(event) =>
                        setAddSemesterForm((previous) => ({
                          ...previous,
                          status: event.target.value as SemesterStatus
                        }))
                      }
                    >
                      <option value="ONGOING">ONGOING</option>
                      <option value="FINISHED">FINISHED</option>
                    </select>
                  </Field>

                  <Field label="Semester Name (Optional)">
                    <input
                      className="input"
                      dir="auto"
                      value={addSemesterForm.name}
                      onChange={(event) =>
                        setAddSemesterForm((previous) => ({
                          ...previous,
                          name: event.target.value
                        }))
                      }
                    />
                  </Field>
                </div>

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

            <div className="space-y-4">
              <article className="panel space-y-3">
                <h2 className="text-xl font-bold text-brand-950">Excel Import / Export</h2>
                <p className="text-sm text-brand-700">
                  Download all marks to Excel or upload marks from Excel. Validation issues are shown with row numbers.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" disabled={exportingExcel} onClick={() => void handleExportExcel()}>
                    {exportingExcel ? "Preparing..." : "Download Excel"}
                  </button>
                  <label className="btn-primary cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleImportExcel(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    {importingExcel ? "Uploading..." : "Upload Excel"}
                  </label>
                </div>

                {excelIssues.length > 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">Excel issues to fix before re-upload:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                      {excelIssues.map((issue, index) => (
                        <li key={`${issue.row}-${issue.field}-${index}`}>
                          Row {issue.row}, {issue.field}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>

              <article className="panel space-y-2">
                <h3 className="text-lg font-bold text-brand-950">Retake Queue</h3>
                <p className="text-sm text-brand-700">
                  Minimum passing mark: {profileForm.minimumPassingMarks}%
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-brand-900">Need 2nd Chance</p>
                  {retakeQueues.needSecondChance.length === 0 ? (
                    <p className="text-sm text-brand-700">No subjects currently require a 2nd chance.</p>
                  ) : (
                    retakeQueues.needSecondChance.map((item) => (
                      <RetakeCard key={`second-${item.id}`} item={item} />
                    ))
                  )}
                </div>
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-semibold text-brand-900">Need 3rd Chance</p>
                  {retakeQueues.needThirdChance.length === 0 ? (
                    <p className="text-sm text-brand-700">No subjects currently require a 3rd chance.</p>
                  ) : (
                    retakeQueues.needThirdChance.map((item) => (
                      <RetakeCard key={`third-${item.id}`} item={item} />
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-brand-950">Your Semesters</h2>

            {semesters.length === 0 ? (
              <div className="panel text-sm text-brand-700">No semesters added yet.</div>
            ) : (
              semesters
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((semester) => {
                  const isEditing = editingSemesterId === semester.id && editSemesterForm !== null;

                  return (
                    <article key={semester.id} className="panel space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button type="button" className="text-left" onClick={() => startEditingSemester(semester)}>
                          <h3 className="text-lg font-bold text-brand-950">
                            Semester {formatSemesterNumber(semester.index, totalSemesters)}
                            {semester.name ? ` - ${semester.name}` : ""}
                          </h3>
                          <p className="text-sm text-brand-700">
                            Status: <strong>{semester.status}</strong> · Percentage: <strong>{semester.percentage.toFixed(2)}%</strong>
                            {semester.status === "ONGOING" ? " (excluded from overall)" : ""}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <button type="button" className="btn-secondary" onClick={() => startEditingSemester(semester)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                            onClick={() => void handleDeleteSemester(semester.id)}
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
                          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">Edit Semester</h4>

                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Field label="Semester Number" required>
                                <input
                                  type="number"
                                  className="input"
                                  value={editSemesterForm.index}
                                  min={1}
                                  max={totalSemesters}
                                  onChange={(event) =>
                                    setEditSemesterForm((previous) =>
                                      previous
                                        ? {
                                            ...previous,
                                            index: Number(event.target.value)
                                          }
                                        : previous
                                    )
                                  }
                                  required
                                />
                              </Field>

                              <Field label="Status" required>
                                <select
                                  className="input"
                                  value={editSemesterForm.status}
                                  onChange={(event) =>
                                    setEditSemesterForm((previous) =>
                                      previous
                                        ? {
                                            ...previous,
                                            status: event.target.value as SemesterStatus
                                          }
                                        : previous
                                    )
                                  }
                                >
                                  <option value="ONGOING">ONGOING</option>
                                  <option value="FINISHED">FINISHED</option>
                                </select>
                              </Field>

                              <Field label="Semester Name (Optional)">
                                <input
                                  className="input"
                                  dir="auto"
                                  value={editSemesterForm.name}
                                  onChange={(event) =>
                                    setEditSemesterForm((previous) =>
                                      previous
                                        ? {
                                            ...previous,
                                            name: event.target.value
                                          }
                                        : previous
                                    )
                                  }
                                />
                              </Field>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                                  Editable Subjects ({editSemesterForm.subjects.length})
                                </p>
                                <button type="button" className="btn-secondary" onClick={() => addSubjectDraft("edit")}>
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
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-700">Friend Visibility</h4>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={sharingSemesterId === semester.id}
                            onClick={() => void saveVisibility(semester.id)}
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
    <article className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{title}</p>
      <p className="mt-1 text-xl font-black text-brand-950">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-brand-700">{subtitle}</p> : null}
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
