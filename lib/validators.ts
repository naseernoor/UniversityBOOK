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
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).default("PREFER_NOT_TO_SAY"),
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

export const semesterStatusSchema = z.enum(["ONGOING", "FINISHED"]);

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
  index: z.coerce.number().int().min(1).max(50),
  name: cleanedOptionalString,
  status: semesterStatusSchema.default("FINISHED"),
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

export const messageSendSchema = z.object({
  content: z.string().trim().min(1).max(5000)
});

export const notificationReadSchema = z.object({
  notificationId: z.string().trim().min(1).optional(),
  markAll: z.boolean().optional().default(false)
});

export const postVisibilitySchema = z.enum(["FRIENDS", "PUBLIC"]);
export const profileVisibilitySchema = z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]);
export const twoFactorMethodSchema = z.enum(["EMAIL", "PHONE"]);
export const reactionTypeSchema = z.enum(["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]);
export const userRoleSchema = z.enum(["USER", "ADMIN", "SUPER_ADMIN"]);
export const verificationRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const identityDocumentTypeSchema = z.enum(["ID_CARD", "PASSPORT", "OTHER"]);
export const semesterVerificationStatusSchema = z.enum([
  "NOT_REQUESTED",
  "PENDING",
  "APPROVED",
  "REJECTED"
]);

const postMediaInputSchema = z.object({
  url: z.string().trim().min(1).max(500),
  fileName: cleanedOptionalString,
  mimeType: cleanedOptionalString,
  sizeBytes: z.coerce.number().int().positive().max(200 * 1024 * 1024).optional()
});

export const createPostSchema = z.object({
  content: z.string().trim().max(2000).default(""),
  visibility: postVisibilitySchema.optional(),
  includeOverallPercentage: z.boolean().optional().default(false),
  sharedSemesterIds: z.array(z.string().min(1)).max(20).default([]),
  media: z.array(postMediaInputSchema).max(12).default([])
}).superRefine((value, context) => {
  if (
    value.content.trim().length === 0 &&
    !value.includeOverallPercentage &&
    value.sharedSemesterIds.length === 0 &&
    value.media.length === 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add text or share semesters/overall percentage before posting",
      path: ["content"]
    });
  }
});

export const updatePostSchema = createPostSchema;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  parentCommentId: cleanedOptionalString
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000)
});

export const postReactionSchema = z.object({
  reaction: z.union([reactionTypeSchema, z.literal("NONE")]).default("LIKE")
});

export const commentReactionSchema = postReactionSchema;

export const securitySettingsSchema = z.object({
  profileVisibility: profileVisibilitySchema,
  allowFriendRequests: z.boolean(),
  defaultPostVisibility: postVisibilitySchema,
  twoFactorEnabled: z.boolean(),
  twoFactorMethod: twoFactorMethodSchema,
  twoFactorPhone: cleanedOptionalString
}).superRefine((value, context) => {
  if (value.twoFactorEnabled && value.twoFactorMethod === "PHONE" && !value.twoFactorPhone) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["twoFactorPhone"],
      message: "Phone number is required for phone 2FA"
    });
  }
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
}).superRefine((value, context) => {
  if (value.currentPassword === value.newPassword) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["newPassword"],
      message: "New password must be different from current password"
    });
  }
});

export const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().email()
});

export const profileVerificationRequestSchema = z.object({
  documentType: identityDocumentTypeSchema,
  documentUrl: z.string().trim().min(1).max(500),
  documentName: cleanedOptionalString
});

export const semesterVerificationRequestSchema = z.object({
  semesterId: z.string().min(1),
  documentUrl: z.string().trim().min(1).max(500),
  documentName: cleanedOptionalString
});

export const adminReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: cleanedOptionalString
});

export const adminUserUpdateSchema = z.object({
  role: userRoleSchema.optional(),
  isBlueVerified: z.boolean().optional()
}).refine((value) => value.role !== undefined || value.isBlueVerified !== undefined, {
  message: "At least one field must be provided"
});
