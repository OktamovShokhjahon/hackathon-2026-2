import { z } from "zod";

export const registerClinicSchema = z.object({
  clinicName: z.string().min(2).max(200),
  contactEmail: z.string().email(),
  adminFullName: z.string().min(2).max(200),
  adminEmail: z.string().email(),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});
