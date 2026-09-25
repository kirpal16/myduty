"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  signupSchema,
  requestOtpSchema,
  verifyOtpOnlySchema,
  verifyOtpResetSchema,
} from "@/lib/validations/auth";

export type AuthFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  /**
   * Echoed back so the form can re-fill it. React resets an uncontrolled form
   * after a Server Action completes, so a wrong password used to wipe the
   * email the officer had just typed along with it.
   */
  email?: string;
} | undefined;

export type OtpFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
  step?: "request" | "verify" | "password";
  email?: string;
  resetToken?: string;
} | undefined;

/**
 * Supabase returns "Invalid login credentials" for a wrong password, an
 * unknown address and an unconfirmed account alike. Repeating that verbatim
 * is both unhelpful and slightly leaky, so it becomes one plain sentence.
 */
function loginErrorMessage(raw: string): string {
  if (/invalid login credentials/i.test(raw)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "Confirm your email address before signing in.";
  }
  return raw;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // Kept out of the validation result so it survives a validation failure too.
  const submittedEmail = (formData.get("email") as string | null) ?? "";

  const validated = loginSchema.safeParse({
    email: submittedEmail,
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: z2fieldErrors(validated.error), email: submittedEmail };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword(validated.data);

  if (error || !authData.user) {
    return { message: loginErrorMessage(error?.message ?? "Login failed"), email: submittedEmail };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", authData.user.id)
    .single();

  if (userRow?.status === "PENDING" || userRow?.status === "REJECTED") {
    redirect("/pending-approval");
  }

  if (userRow?.role === "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    profileId: formData.get("profileId"),
    employeeCode: formData.get("employeeCode") || undefined,
    phone: formData.get("phone") || undefined,
  });

  if (!validated.success) {
    return { errors: z2fieldErrors(validated.error) };
  }

  const { email, password, fullName, profileId, employeeCode, phone } =
    validated.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        profile_id: profileId,
        full_name: fullName,
        employee_code: employeeCode ?? null,
        phone: phone ?? null,
      },
    },
  });

  if (error) {
    return { message: error.message };
  }

  // If email confirmation is enabled on the project, signUp() returns a
  // user but no session — the handle_new_auth_user trigger has still fired
  // (it runs on the auth.users insert, independent of email confirmation),
  // so the PENDING public.users row already exists.
  if (!data.session) {
    return {
      message:
        "Account created. Check your email to confirm your address, then log in — your account will need approval before you can access the app.",
    };
  }

  redirect("/pending-approval");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function sendPasswordResetOtp(
  _prevState: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const submittedEmail = ((formData.get("email") as string | null) ?? "").trim();
  const validated = requestOtpSchema.safeParse({ email: submittedEmail });

  if (!validated.success) {
    return {
      errors: z2fieldErrors(validated.error),
      step: "request",
      email: submittedEmail,
    };
  }

  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const userExists = (userList?.users ?? []).some(
    (u) => u.email?.toLowerCase() === validated.data.email.toLowerCase()
  );

  if (!userExists) {
    return {
      message: "No officer account found with this email address. Please check your email.",
      step: "request",
      email: submittedEmail,
    };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "https";
  const origin =
    headerList.get("origin") ||
    (host ? `${proto}://${host}` : "") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    (process.env.NODE_ENV === "production"
      ? "https://myduty-eight.vercel.app"
      : "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(validated.data.email, {
    redirectTo: `${origin}/auth/callback?type=recovery&next=/reset-password`,
  });

  if (error) {
    return {
      message: error.message,
      step: "request",
      email: submittedEmail,
    };
  }

  return {
    success: true,
    step: "verify",
    email: validated.data.email,
    message: `Password reset instructions have been sent to ${validated.data.email}. Check your inbox for the 6-digit code or reset link.`,
  };
}

export async function verifyOtpOnly(
  _prevState: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const submittedEmail = ((formData.get("email") as string | null) ?? "").trim();
  const submittedOtp = ((formData.get("otp") as string | null) ?? "").trim();

  const validated = verifyOtpOnlySchema.safeParse({
    email: submittedEmail,
    otp: submittedOtp,
  });

  if (!validated.success) {
    return {
      errors: z2fieldErrors(validated.error),
      step: "verify",
      email: submittedEmail,
    };
  }

  const supabase = await createClient();
  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    email: validated.data.email,
    token: validated.data.otp,
    type: "recovery",
  });

  if (otpError || !otpData?.user?.id) {
    const isExpired = /expired|invalid/i.test(otpError?.message || "");
    return {
      message: isExpired
        ? "Invalid or expired 6-digit code. Please check your email and enter the latest code."
        : (otpError?.message || "Invalid verification code."),
      step: "verify",
      email: submittedEmail,
    };
  }

  // Cryptographically sign the user ID so the password update step cannot be forged
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "auth-recovery-secret";
  const hmac = crypto.createHmac("sha256", secret).update(otpData.user.id).digest("hex");
  const resetToken = `${otpData.user.id}.${hmac}`;

  return {
    success: true,
    step: "password",
    email: validated.data.email,
    resetToken,
    message: "Code verified successfully! Please enter your new password below.",
  };
}

export async function verifyOtpAndResetPassword(
  _prevState: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const submittedEmail = ((formData.get("email") as string | null) ?? "").trim();
  const submittedOtp = ((formData.get("otp") as string | null) ?? "").trim();

  const validated = verifyOtpResetSchema.safeParse({
    email: submittedEmail,
    otp: submittedOtp,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return {
      errors: z2fieldErrors(validated.error),
      step: "verify",
      email: submittedEmail,
    };
  }

  const supabase = await createClient();

  // 1. Verify OTP with Supabase
  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    email: validated.data.email,
    token: validated.data.otp,
    type: "recovery",
  });

  if (otpError) {
    const isExpired = /expired|invalid/i.test(otpError.message);
    return {
      message: isExpired
        ? "Invalid or expired 6-digit code. Please request a new code if needed."
        : otpError.message,
      step: "verify",
      email: submittedEmail,
    };
  }

  const userId = otpData?.user?.id;
  if (!userId) {
    return {
      message: "Could not identify user from verification code. Please request a new code.",
      step: "verify",
      email: submittedEmail,
    };
  }

  // 2. Update password directly via Admin client (guaranteed to succeed without cookies)
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: validated.data.password,
  });

  if (updateError) {
    return {
      message: updateError.message,
      step: "password",
      email: submittedEmail,
    };
  }

  // 3. Clear session and redirect to login
  try {
    await supabase.auth.signOut();
  } catch {}

  redirect("/login?reset=success");
}

export async function updatePasswordOnly(
  _prevState: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const resetToken = ((formData.get("resetToken") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const otp = ((formData.get("otp") as string | null) ?? "").trim();
  const password = ((formData.get("password") as string | null) ?? "").trim();
  const confirmPassword = ((formData.get("confirmPassword") as string | null) ?? "").trim();

  // If email and otp are present, delegate to atomic verifyOtpAndResetPassword
  if (email && otp) {
    return verifyOtpAndResetPassword(_prevState, formData);
  }

  if (!password || password.length < 8) {
    return {
      message: "Password must be at least 8 characters long.",
      errors: { password: ["Password must be at least 8 characters long."] },
      step: "password",
      resetToken,
      email,
    };
  }

  if (password !== confirmPassword) {
    return {
      message: "Passwords do not match.",
      errors: { confirmPassword: ["Passwords do not match."] },
      step: "password",
      resetToken,
      email,
    };
  }

  let targetUserId: string | null = null;
  if (resetToken) {
    const [id, hmac] = resetToken.split(".");
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "auth-recovery-secret";
    const expected = id ? crypto.createHmac("sha256", secret).update(id).digest("hex") : "";
    if (id && hmac && hmac === expected) {
      targetUserId = id;
    } else {
      return {
        message: "Invalid or expired session. Please verify your code again.",
        step: "verify",
        email,
      };
    }
  }

  const supabase = await createClient();
  if (!targetUserId) {
    const { data: sessionData } = await supabase.auth.getSession();
    targetUserId = sessionData?.session?.user?.id ?? null;
  }

  if (targetUserId) {
    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password,
    });
    if (updateError) {
      return { message: updateError.message, step: "password", resetToken, email };
    }
  } else {
    return {
      message: "No active recovery session. Please verify your code again.",
      step: "verify",
      email,
    };
  }

  try {
    await supabase.auth.signOut();
  } catch {}

  redirect("/login?reset=success");
}

function z2fieldErrors(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
