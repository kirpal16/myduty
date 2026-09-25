import * as z from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export const signupSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." }),
  fullName: z.string().trim().min(2, { error: "Enter your full name." }),
  profileId: z.uuid({ error: "Select a profile." }),
  employeeCode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export const requestOtpSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
});

export const verifyOtpOnlySchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  otp: z
    .string()
    .trim()
    .length(6, { error: "Enter the 6-digit verification code." })
    .regex(/^\d{6}$/, { error: "Verification code must be exactly 6 digits." }),
});

export const verifyOtpResetSchema = z
  .object({
    email: z.email({ error: "Enter a valid email." }),
    otp: z
      .string()
      .trim()
      .length(6, { error: "Enter the 6-digit verification code." })
      .regex(/^\d{6}$/, { error: "Verification code must be exactly 6 digits." }),
    password: z
      .string()
      .min(8, { error: "Be at least 8 characters long." })
      .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
      .regex(/[0-9]/, { error: "Contain at least one number." }),
    confirmPassword: z.string().min(1, { error: "Confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpResetInput = z.infer<typeof verifyOtpResetSchema>;
