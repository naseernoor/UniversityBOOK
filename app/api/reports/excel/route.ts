import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getServerAuthSession } from "@/lib/auth";
import { calculateOverallPercentage } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";

type ValidationIssue = {
  row: number;
  field: string;
  message: string;
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const toOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Number.NaN;
    }
    return Number(trimmed);
  }
  return Number.NaN;
};

const parseSemesterStatus = (value: unknown): "ONGOING" | "FINISHED" | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "FINISHED";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ONGOING") {
    return "ONGOING";
  }
  if (normalized === "FINISHED") {
    return "FINISHED";
  }
  return null;
};

const parseLectureMaterials = (value: unknown) => {
  const raw = toOptionalString(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((url, index) => {
      const urlParts = url.split("/");
      const last = urlParts[urlParts.length - 1];
      const fallbackName = `Lecture ${index + 1}`;
      return {
        url,
        name: last && last.length > 0 ? decodeURIComponent(last) : fallbackName
      };
    });
};

const semesterLabel = (index: number, totalSemesters: number) => {
  const padLength = String(Math.max(totalSemesters, 9)).length;
  return String(index).padStart(padLength, "0");
};

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, semesters] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        email: true,
        username: true,
        profile: true
      }
    }),
    prisma.semester.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        subjects: {
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: {
        index: "asc"
      }
    })
  ]);

  if (!user?.profile) {
    return NextResponse.json(
      { error: "Please complete your profile before exporting reports" },
      { status: 400 }
    );
  }

  const finishedSemesters = semesters.filter((semester) => semester.status === "FINISHED");
  const overallPercentage = calculateOverallPercentage(
    finishedSemesters.map((semester) => ({
      subjects: semester.subjects.map((subject) => ({
        credits: subject.credits,
        score: subject.score
      }))
    }))
  );

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["Field", "Value"],
    ["Username", user.username ?? ""],
    ["Email", user.email ?? ""],
    ["First Name", user.profile.firstName],
    ["Last Name", user.profile.lastName],
    ["Father Name", user.profile.fatherName],
    ["University", user.profile.university],
    ["Faculty", user.profile.faculty],
    ["Department", user.profile.department],
    ["Degree Level", user.profile.degreeLevel],
    ["Year of Enrollment", user.profile.yearOfEnrollment],
    ["Date of Birth", new Date(user.profile.dateOfBirth).toISOString().split("T")[0]],
    ["Total Semesters", user.profile.totalSemesters],
    ["Minimum Passing Marks", user.profile.minimumPassingMarks],
    ["Ideal Percentage", user.profile.idealPercentage ?? ""],
    ["Finished Semesters", finishedSemesters.length],
    ["Overall Percentage (finished semesters only)", overallPercentage]
  ];

  const marksRows: Array<Array<string | number>> = [
    [
      "SemesterNumber",
      "SemesterName",
      "SemesterStatus",
      "SubjectName",
      "Credits",
      "Score",
      "Chance",
      "SubjectCode",
      "TeacherName",
      "LectureUrls"
    ]
  ];

  for (const semester of semesters) {
    const numberLabel = semesterLabel(semester.index, user.profile.totalSemesters);
    const subjectRows =
      semester.subjects.length > 0
        ? semester.subjects
        : [
            {
              name: "",
              credits: 0,
              score: 0,
              chance: 1,
              code: "",
              teacherName: "",
              lectureMaterialsJson: "[]"
            }
          ];

    for (const subject of subjectRows) {
      let lectureUrls = "";
      try {
        const parsed = JSON.parse(subject.lectureMaterialsJson ?? "[]") as Array<{
          url?: string;
        }>;
        lectureUrls = parsed
          .map((item) => (typeof item.url === "string" ? item.url : ""))
          .filter((item) => item.length > 0)
          .join(", ");
      } catch {
        lectureUrls = "";
      }

      marksRows.push([
        numberLabel,
        semester.name ?? "",
        semester.status,
        subject.name,
        subject.credits,
        subject.score,
        subject.chance,
        subject.code ?? "",
        subject.teacherName ?? "",
        lectureUrls
      ]);
    }
  }

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(marksRows), "Marks");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const fileName = `marks-report-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: {
      userId: session.user.id
    },
    select: {
      totalSemesters: true
    }
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Please complete your profile before importing reports" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const maybeFile = formData.get("file");

  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await maybeFile.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return NextResponse.json({ error: "Excel file has no sheets" }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const issues: ValidationIssue[] = [];

  const semesterMap = new Map<
    number,
    {
      index: number;
      name: string | null;
      status: "ONGOING" | "FINISHED";
      subjects: Array<{
        name: string;
        credits: number;
        score: number;
        chance: number;
        code: string | null;
        teacherName: string | null;
        lectureMaterials: Array<{ name: string; url: string }>;
      }>;
    }
  >();

  rawRows.forEach((rawRow, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
    ) as Record<string, unknown>;

    const isEmpty = Object.values(row).every((value) => {
      if (typeof value === "number") {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length === 0;
      }
      return !value;
    });

    if (isEmpty) {
      return;
    }

    const semesterNumberRaw = row.semesternumber;
    const semesterNumber = parseNumber(semesterNumberRaw);
    if (!Number.isInteger(semesterNumber)) {
      issues.push({
        row: rowNumber,
        field: "SemesterNumber",
        message: "Semester number must be an integer"
      });
      return;
    }
    if (semesterNumber < 1 || semesterNumber > profile.totalSemesters) {
      issues.push({
        row: rowNumber,
        field: "SemesterNumber",
        message: `Semester number must be between 1 and ${profile.totalSemesters}`
      });
      return;
    }

    const semesterStatus = parseSemesterStatus(row.semesterstatus);
    if (!semesterStatus) {
      issues.push({
        row: rowNumber,
        field: "SemesterStatus",
        message: "Semester status must be ONGOING or FINISHED"
      });
      return;
    }

    const subjectName = toOptionalString(row.subjectname);
    if (!subjectName) {
      issues.push({
        row: rowNumber,
        field: "SubjectName",
        message: "Subject name is required"
      });
      return;
    }

    const credits = parseNumber(row.credits);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 100) {
      issues.push({
        row: rowNumber,
        field: "Credits",
        message: "Credits must be a number between 0 and 100"
      });
      return;
    }

    const score = parseNumber(row.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      issues.push({
        row: rowNumber,
        field: "Score",
        message: "Score must be a number between 0 and 100"
      });
      return;
    }

    const chance = parseNumber(row.chance);
    if (!Number.isInteger(chance) || chance < 1 || chance > 4) {
      issues.push({
        row: rowNumber,
        field: "Chance",
        message: "Chance must be 1, 2, 3, or 4"
      });
      return;
    }

    const semesterName = toOptionalString(row.semestername) ?? null;
    const code = toOptionalString(row.subjectcode) ?? null;
    const teacherName = toOptionalString(row.teachername) ?? null;
    const lectureMaterials = parseLectureMaterials(row.lectureurls);

    const existingSemester = semesterMap.get(semesterNumber);

    if (existingSemester) {
      if (existingSemester.status !== semesterStatus) {
        issues.push({
          row: rowNumber,
          field: "SemesterStatus",
          message: "All rows in one semester must use the same status"
        });
      }

      if (
        existingSemester.name &&
        semesterName &&
        existingSemester.name.toLowerCase() !== semesterName.toLowerCase()
      ) {
        issues.push({
          row: rowNumber,
          field: "SemesterName",
          message: "All rows in one semester must use the same semester name"
        });
      }
    }

    if (issues.length > 0) {
      return;
    }

    const targetSemester =
      existingSemester ??
      (() => {
        const created = {
          index: semesterNumber,
          name: semesterName,
          status: semesterStatus,
          subjects: [] as Array<{
            name: string;
            credits: number;
            score: number;
            chance: number;
            code: string | null;
            teacherName: string | null;
            lectureMaterials: Array<{ name: string; url: string }>;
          }>
        };
        semesterMap.set(semesterNumber, created);
        return created;
      })();

    if (!targetSemester.name && semesterName) {
      targetSemester.name = semesterName;
    }

    targetSemester.subjects.push({
      name: subjectName,
      credits,
      score,
      chance,
      code,
      teacherName,
      lectureMaterials
    });
  });

  if (issues.length > 0) {
    return NextResponse.json(
      {
        error: "Excel validation failed",
        issues
      },
      { status: 400 }
    );
  }

  if (semesterMap.size === 0) {
    return NextResponse.json(
      {
        error: "No valid mark rows were found in the Excel file"
      },
      { status: 400 }
    );
  }

  const importSemesters = [...semesterMap.values()].sort((a, b) => a.index - b.index);

  await prisma.$transaction(
    importSemesters.map((semester) =>
      prisma.semester.upsert({
        where: {
          userId_index: {
            userId: session.user.id,
            index: semester.index
          }
        },
        create: {
          userId: session.user.id,
          index: semester.index,
          name: semester.name,
          status: semester.status,
          subjects: {
            create: semester.subjects.map((subject) => ({
              name: subject.name,
              credits: subject.credits,
              score: subject.score,
              chance: subject.chance,
              code: subject.code,
              teacherName: subject.teacherName,
              lectureMaterialsJson: JSON.stringify(subject.lectureMaterials)
            }))
          }
        },
        update: {
          name: semester.name,
          status: semester.status,
          subjects: {
            deleteMany: {},
            create: semester.subjects.map((subject) => ({
              name: subject.name,
              credits: subject.credits,
              score: subject.score,
              chance: subject.chance,
              code: subject.code,
              teacherName: subject.teacherName,
              lectureMaterialsJson: JSON.stringify(subject.lectureMaterials)
            }))
          }
        }
      })
    )
  );

  return NextResponse.json({
    message: `Imported ${importSemesters.length} semester(s) successfully`
  });
}
