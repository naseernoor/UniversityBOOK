import { Prisma } from "@prisma/client";

export const legacyProfileSelect = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  fatherName: true,
  university: true,
  faculty: true,
  department: true,
  degreeLevel: true,
  yearOfEnrollment: true,
  dateOfBirth: true,
  totalSemesters: true,
  minimumPassingMarks: true,
  idealPercentage: true,
  profileVisibility: true,
  allowFriendRequests: true,
  defaultPostVisibility: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProfileSelect;

const isKnownRequestError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export const isMissingSchemaError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError =>
  isKnownRequestError(error) && (error.code === "P2021" || error.code === "P2022");

export const isMissingProfileGenderError = (error: unknown) => {
  if (!isMissingSchemaError(error)) {
    return false;
  }

  return JSON.stringify(error.meta ?? {}).includes("Profile.gender");
};

export const stripGenderField = <T extends Record<string, unknown>>(value: T) => {
  const { gender: _gender, ...rest } = value;
  return rest;
};
