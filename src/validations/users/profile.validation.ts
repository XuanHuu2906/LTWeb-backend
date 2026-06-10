import { z } from "zod";

export const updateCandidateProfileSchema = z.object({
  fullName: z
    .string({ message: "fullName là bắt buộc" })
    .trim()
    .min(1, "fullName không được bỏ trống")
    .max(100, "fullName không được vượt quá 100 ký tự"),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  dateOfBirth: z.string().trim().optional().nullable(),
  bio: z
    .string()
    .trim()
    .max(2000, "bio không được vượt quá 2000 ký tự")
    .optional()
    .nullable(),
});
