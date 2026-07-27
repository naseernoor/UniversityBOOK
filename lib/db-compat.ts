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

const getErrorMetaText = (error: unknown) =>
  isKnownRequestError(error) ? JSON.stringify(error.meta ?? {}) : "";

export const isMissingUserFieldError = (
  error: unknown,
  fields?: string | string[]
) => {
  if (!isMissingSchemaError(error)) {
    return false;
  }

  const metaText = getErrorMetaText(error);
  const fieldList = Array.isArray(fields) ? fields : fields ? [fields] : [];

  if (fieldList.length === 0) {
    return metaText.includes("User.");
  }

  return fieldList.some((field) => metaText.includes(`User.${field}`));
};

export const isMissingAnyLegacyUserFieldError = (error: unknown) =>
  isMissingUserFieldError(error, [
    "username",
    "pendingEmail",
    "role",
    "isBlueVerified",
    "blueVerifiedAt",
    "blueVerifiedById",
    "twoFactorEnabled",
    "twoFactorMethod",
    "twoFactorPhone"
  ]);

export const isMissingLegacyUserOrProfileFieldError = (error: unknown) =>
  isMissingAnyLegacyUserFieldError(error) || isMissingProfileGenderError(error);

export const stripGenderField = <T extends Record<string, unknown>>(value: T) => {
  const { gender: _gender, ...rest } = value;
  return rest;
};
