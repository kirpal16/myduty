"use client";

import { useActionState, useState, useEffect } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";
import {
  sendPasswordResetOtp,
  verifyOtpOnly,
  updatePasswordOnly,
  type OtpFormState,
} from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Mail,
  KeyRound,
  Lock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { FieldError } from "@/components/ui/field-error";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "verify" | "password">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 1: Request OTP state
  const [requestState, requestAction, requestPending] = useActionState<
    OtpFormState,
    FormData
  >(sendPasswordResetOtp, undefined);

  // Step 2: Verify OTP state (validates real code with Supabase before advancing!)
  const [verifyState, verifyAction, verifyPending] = useActionState<
    OtpFormState,
    FormData
  >(verifyOtpOnly, undefined);

  // Step 3: Set New Password state
  const [passwordState, passwordAction, passwordPending] = useActionState<
    OtpFormState,
    FormData
  >(updatePasswordOnly, undefined);

  // Step transitions
  useEffect(() => {
    if (requestState?.success && requestState.email) {
      setEmail(requestState.email);
      setStep("verify");
      setResendCooldown(60);
    }
  }, [requestState]);

  useEffect(() => {
    if (verifyState?.success && verifyState.resetToken) {
      setResetToken(verifyState.resetToken);
      setStep("password");
    }
  }, [verifyState]);

  // If password step returns an expired session error, bounce back to verify
  useEffect(() => {
    if (passwordState?.step === "verify") {
      setStep("verify");
    }
  }, [passwordState]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    const fd = new FormData();
    fd.set("email", email);
    const res = await sendPasswordResetOtp(undefined, fd);
    if (res?.success) {
      setResendCooldown(60);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      {/* Ambient background lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-purple-600/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Brand header */}
          <div className="flex flex-col items-center text-center mb-6">
            <Link
              href="/"
              className="relative flex size-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-slate-950 p-1.5 shadow-lg shadow-amber-500/20 mb-4 hover:scale-105 transition-transform"
            >
              <Image
                src="/Gujarat-police.png"
                alt="Gujarat Police Logo"
                width={56}
                height={56}
                className="size-full object-contain"
                priority
              />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {step === "request" && "Reset Password"}
              {step === "verify" && "Verify Code"}
              {step === "password" && "Set New Password"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {step === "request" && "Enter your officer email to receive a 6-digit code"}
              {step === "verify" && `Enter the 6-digit code sent to ${email}`}
              {step === "password" && "Create a secure new password for your account"}
            </p>
          </div>

          {/* 3-Step visual progress tracker */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === "request" || step === "verify" || step === "password"
                  ? "bg-indigo-500"
                  : "bg-slate-800"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === "verify" || step === "password"
                  ? "bg-indigo-500"
                  : "bg-slate-800"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === "password" ? "bg-indigo-500" : "bg-slate-800"
              }`}
            />
          </div>

          {/* Feedback Banners */}
          {step === "request" && requestState?.message && (
            <div className="mb-6">
              <AutoDismissBanner
                message={requestState.message}
                tone={requestState.success ? "success" : "error"}
                autoHideMs={requestState.success ? 4000 : 8000}
              />
            </div>
          )}

          {step === "verify" && verifyState?.message && (
            <div className="mb-6">
              <AutoDismissBanner
                message={verifyState.message}
                tone={verifyState.success ? "success" : "error"}
                autoHideMs={8000}
              />
            </div>
          )}

          {step === "password" && passwordState?.message && (
            <div className="mb-6">
              <AutoDismissBanner
                message={passwordState.message}
                tone="error"
                autoHideMs={8000}
              />
            </div>
          )}

          {/* STEP 1: Request OTP */}
          {step === "request" && (
            <form action={requestAction} className="flex flex-col gap-4.5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Email address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 size-4.5 text-slate-500 pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="officer@agency.gov"
                    required
                    defaultValue={email || (requestState?.email ?? "")}
                    className={`w-full rounded-xl border bg-slate-950/60 pl-10.5 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                      requestState?.errors?.email
                        ? "border-rose-500"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  />
                </div>
                {requestState?.errors?.email && (
                  <FieldError message={requestState.errors.email[0]} />
                )}
              </div>

              <button
                type="submit"
                disabled={requestPending}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {requestPending ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Sending code…</span>
                  </>
                ) : (
                  <>
                    <span>Send 6-Digit Code</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit Code & Verify with Supabase */}
          {step === "verify" && (
            <form action={verifyAction} className="flex flex-col gap-4.5">
              <input type="hidden" name="email" value={email} />

              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200">
                <p className="font-semibold text-white">Check your email inbox</p>
                <p className="mt-1 text-slate-300 text-[11px]">
                  We sent a 6-digit code to <span className="font-medium text-white">{email}</span>. Enter it below to verify.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="otp"
                    className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                  >
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep("request")}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
                  >
                    Change email
                  </button>
                </div>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3.5 size-4.5 text-slate-500 pointer-events-none" />
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="123456"
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.trim())}
                    className={`w-full rounded-xl border bg-slate-950/60 pl-10.5 pr-4 py-2.5 text-center text-xl font-mono tracking-[0.3em] text-white placeholder:text-slate-600 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                      verifyState?.errors?.otp
                        ? "border-rose-500"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  />
                </div>
                {verifyState?.errors?.otp && (
                  <FieldError message={verifyState.errors.otp[0]} />
                )}
              </div>

              {/* Resend OTP button with cooldown */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <RotateCcw className="size-3" />
                  <span>
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </span>
                </button>
              </div>

              <button
                type="submit"
                disabled={verifyPending}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {verifyPending ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Verifying code with server…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4.5" />
                    <span>Verify Code & Continue</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Enter New Password */}
          {step === "password" && (
            <form action={passwordAction} className="flex flex-col gap-4.5">
              <input type="hidden" name="resetToken" value={resetToken || verifyState?.resetToken || ""} />
              <input type="hidden" name="email" value={email} />

              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Code verified for <strong className="text-white">{email}</strong>. Now choose a new password.</span>
              </div>

              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  New Password
                </label>
                <div className="relative">
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={Boolean(passwordState?.errors?.password)}
                    className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
                  />
                </div>
                {passwordState?.errors?.password && (
                  <FieldError message={passwordState.errors.password[0]} />
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={Boolean(passwordState?.errors?.confirmPassword)}
                    className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
                  />
                </div>
                {passwordState?.errors?.confirmPassword && (
                  <FieldError message={passwordState.errors.confirmPassword[0]} />
                )}
              </div>

              <button
                type="submit"
                disabled={passwordPending}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {passwordPending ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Saving new password…</span>
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    <span>Save Password & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer back to Sign in */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
