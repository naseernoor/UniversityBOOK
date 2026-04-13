import { Semester, Subject } from "@prisma/client";

import {
  calculateOverallPercentage,
  calculateRequiredAverage,
  calculateSemesterPercentage
} from "@/lib/calculations";

export type LectureMaterial = {
  name: string;
  url: string;
};

type SubjectWithExtras = Subject & {
  lectureMaterials: LectureMaterial[];
};

type SemesterWithSubjects = Semester & {
  subjects: Subject[];
  visibility?: Array<{
    viewerId: string;
  }>;
};

const parseLectureMaterials = (value: string | null): LectureMaterial[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          "url" in item &&
          typeof item.name === "string" &&
          typeof item.url === "string"
        ) {
          return {
            name: item.name,
            url: item.url
          };
        }
        return null;
      })
      .filter((item): item is LectureMaterial => item !== null);
  } catch {
    return [];
  }
};

export const withSemesterPercentages = (semesters: SemesterWithSubjects[]) => {
  return semesters.map((semester) => {
    const subjects: SubjectWithExtras[] = semester.subjects.map((subject) => ({
      ...subject,
      lectureMaterials: parseLectureMaterials(subject.lectureMaterialsJson)
    }));

    const percentage = calculateSemesterPercentage(
      subjects.map((subject) => ({
        credits: subject.credits,
        score: subject.score
      }))
    );

    return {
      ...semester,
      subjects,
      percentage,
      visibleFriendIds: semester.visibility?.map((entry) => entry.viewerId) ?? []
    };
  });
};

export const buildPerformanceSummary = (params: {
  semesters: SemesterWithSubjects[];
  totalSemesters: number;
  idealPercentage: number | null;
  minimumPassingMarks: number;
}) => {
  const enrichedSemesters = withSemesterPercentages(params.semesters);
  const finishedSemesters = enrichedSemesters.filter((semester) => semester.status === "FINISHED");

  const overallPercentage = calculateOverallPercentage(
    finishedSemesters.map((semester) => ({
      subjects: semester.subjects.map((subject) => ({
        credits: subject.credits,
        score: subject.score
      }))
    }))
  );

  const projection = calculateRequiredAverage({
    idealPercentage: params.idealPercentage,
    totalSemesters: params.totalSemesters,
    completedSemesterPercentages: [...finishedSemesters]
      .sort((a, b) => a.index - b.index)
      .map((semester) => semester.percentage)
  });

  const allSubjects = enrichedSemesters.flatMap((semester) =>
    semester.subjects.map((subject) => ({
      ...subject,
      semesterId: semester.id,
      semesterIndex: semester.index,
      semesterName: semester.name
    }))
  );

  const chanceStats = {
    secondChanceCount: allSubjects.filter((subject) => subject.chance === 2).length,
    thirdChanceCount: allSubjects.filter((subject) => subject.chance === 3).length
  };

  const needSecondChance = allSubjects.filter(
    (subject) => subject.chance === 1 && subject.score < params.minimumPassingMarks
  );

  const needThirdChance = allSubjects.filter(
    (subject) => subject.chance === 2 && subject.score < params.minimumPassingMarks
  );

  return {
    semesters: enrichedSemesters,
    overallPercentage,
    projection,
    finishedSemesters: finishedSemesters.length,
    chanceStats,
    retakeQueues: {
      needSecondChance,
      needThirdChance
    }
  };
};
