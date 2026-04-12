export const DEGREE_LEVELS = ["BACHELOR", "MASTER", "PHD"] as const;

export type DegreeLevel = (typeof DEGREE_LEVELS)[number];

export const DEGREE_LABELS: Record<DegreeLevel, string> = {
  BACHELOR: "Bachelor",
  MASTER: "Master",
  PHD: "PhD"
};

export const DEGREE_DEFAULT_SEMESTERS: Record<DegreeLevel, number> = {
  BACHELOR: 8,
  MASTER: 4,
  PHD: 6
};

export type SemesterTemplateOption = {
  key: string;
  index: number;
  label: string;
  name: string;
};

export const buildSemesterTemplates = (params: {
  totalSemesters: number;
  yearOfEnrollment: number;
}) => {
  const templates: SemesterTemplateOption[] = [];
  const { totalSemesters, yearOfEnrollment } = params;

  for (let index = 1; index <= totalSemesters; index += 1) {
    const yearNumber = Math.ceil(index / 2);
    const termNumber = index % 2 === 1 ? 1 : 2;
    const academicYear = yearOfEnrollment + yearNumber - 1;

    const name = `Year ${yearNumber} - Semester ${termNumber}`;
    const label = `${name} (${academicYear})`;

    templates.push({
      key: `TEMPLATE_${index}`,
      index,
      name,
      label
    });
  }

  return templates;
};
