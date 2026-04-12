import { z } from "zod";

import { DEGREE_LEVELS } from "@/lib/academic";

const cleanedOptionalString = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const usernameRegex = /^[\p{L}\p{N}_.-]+$/u;

const lectureMaterialSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1).max(500)
});

export const profileDetailsSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  fatherName: z.string().trim().min(2, "Father name is required"),
  university: z.string().trim().min(2, "University is required"),
  faculty: z.string().trim().min(2, "Faculty is required"),
  department: z.string().trim().min(2, "Department is required"),
  degreeLevel: z.enum(DEGREE_LEVELS),
  yearOfEnrollment: z.coerce.number().int().min(1900).max(2100),
  dateOfBirth: z.coerce.date(),
  totalSemesters: z.coerce.number().int().min(1).max(20).default(8),
  minimumPassingMarks: z.coerce.number().min(0).max(100).default(50),
  idealPercentage: z
    .union([z.coerce.number().min(0).max(100), z.nan(), z.null()])
    .optional()
    .transform((value) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return undefined;
      }
      return value;
    })
});

export const registerSchema = profileDetailsSchema.extend({
  email: z.string().trim().email(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(usernameRegex, "Username can only include letters, numbers, ., _, -"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const profileUpsertSchema = profileDetailsSchema;

export const onboardingSchema = profileDetailsSchema.extend({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(usernameRegex, "Username can only include letters, numbers, ., _, -")
});

export const profileTargetSchema = z.object({
  idealPercentage: z.union([z.coerce.number().min(0).max(100), z.null()]),
  totalSemesters: z.coerce.number().int().min(1).max(20)
});

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1),
  credits: z.coerce.number().positive().max(100),
  code: cleanedOptionalString,
  teacherName: cleanedOptionalString,
  lectureMaterials: z.array(lectureMaterialSchema).default([]),
  chance: z.coerce.number().int().min(1).max(4),
  score: z.coerce.number().min(0).max(100)
});

export const createSemesterSchema = z.object({
  index: z.coerce.number().int().min(1).max(24),
  name: cleanedOptionalString,
  subjects: z.array(subjectInputSchema).min(1).max(30)
});

export const updateSemesterSchema = createSemesterSchema.extend({
  id: z.string().min(1)
});

export const semesterVisibilitySchema = z.object({
  visibleFriendIds: z.array(z.string()).default([])
});

export const friendRequestSchema = z.object({
  targetUserId: z.string().min(1)
});

export const friendRequestActionSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"])
});
