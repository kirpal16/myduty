import { describe, it, expect } from "vitest";
import {
  loginSchema,
  requestOtpSchema,
  verifyOtpResetSchema,
} from "./auth";

describe("auth validations", () => {
  describe("loginSchema", () => {
    it("validates valid credentials", () => {
      const result = loginSchema.safeParse({
        email: "officer@gujarat.gov",
        password: "secretpassword123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "secretpassword123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("requestOtpSchema", () => {
    it("accepts valid email", () => {
      const result = requestOtpSchema.safeParse({ email: "dsp@gujarat.gov" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = requestOtpSchema.safeParse({ email: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("verifyOtpResetSchema", () => {
    it("accepts valid 6-digit OTP and matching secure password", () => {
      const result = verifyOtpResetSchema.safeParse({
        email: "officer@gujarat.gov",
        otp: "123456",
        password: "Password123",
        confirmPassword: "Password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-6-digit OTP", () => {
      const result = verifyOtpResetSchema.safeParse({
        email: "officer@gujarat.gov",
        otp: "12345", // only 5 digits
        password: "Password123",
        confirmPassword: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric OTP", () => {
      const result = verifyOtpResetSchema.safeParse({
        email: "officer@gujarat.gov",
        otp: "12345A",
        password: "Password123",
        confirmPassword: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects mismatched passwords", () => {
      const result = verifyOtpResetSchema.safeParse({
        email: "officer@gujarat.gov",
        otp: "123456",
        password: "Password123",
        confirmPassword: "DifferentPassword123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects weak passwords (missing numbers)", () => {
      const result = verifyOtpResetSchema.safeParse({
        email: "officer@gujarat.gov",
        otp: "123456",
        password: "PasswordOnly",
        confirmPassword: "PasswordOnly",
      });
      expect(result.success).toBe(false);
    });
  });
});
