export type SubjectForCalculation = {
  credits: number;
  score: number;
};

export type SemesterForCalculation = {
  subjects: SubjectForCalculation[];
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const calculateSemesterPercentage = (subjects: SubjectForCalculation[]): number => {
  if (subjects.length === 0) {
    return 0;
  }

  const totals = subjects.reduce(
    (acc, subject) => {
      acc.creditSum += subject.credits;
      acc.weightedSum += subject.credits * subject.score;
      return acc;
    },
    { creditSum: 0, weightedSum: 0 }
  );

  if (totals.creditSum === 0) {
    return 0;
  }

  return round2(totals.weightedSum / totals.creditSum);
};

export const calculateOverallPercentage = (semesters: SemesterForCalculation[]): number => {
  const subjects = semesters.flatMap((semester) => semester.subjects);
  return calculateSemesterPercentage(subjects);
};

export const calculateRequiredAverage = (params: {
  idealPercentage: number | null;
  totalSemesters: number;
  completedSemesterPercentages: number[];
}) => {
  const { idealPercentage, totalSemesters, completedSemesterPercentages } = params;

  if (idealPercentage === null || Number.isNaN(idealPercentage)) {
    return null;
  }

  const completedCount = completedSemesterPercentages.length;
  const remainingSemesters = Math.max(totalSemesters - completedCount, 0);

  if (remainingSemesters === 0) {
    return {
      requiredAverage: 0,
      remainingSemesters,
      canAchieve: calculateAverage(completedSemesterPercentages) >= idealPercentage
    };
  }

  const requiredAverage =
    (idealPercentage * totalSemesters - sum(completedSemesterPercentages)) /
    remainingSemesters;

  return {
    requiredAverage: round2(Math.max(0, requiredAverage)),
    remainingSemesters,
    canAchieve: requiredAverage <= 100
  };
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const calculateAverage = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
};
