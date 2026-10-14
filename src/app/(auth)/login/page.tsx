"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";
import { login, type AuthFormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { Mail, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa/install-button";
import { FieldError } from "@/components/ui/field-error";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useLanguage } from "@/lib/i18n/language-context";

function ResetSuccessNotice() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  if (!resetSuccess) return null;
  return (
    <div className="mb-6">
      <AutoDismissBanner
        message="Your password has been successfully reset. Please sign in with your new password."
        tone="success"
        autoHideMs={6000}
      />
    </div>
  );
}

export default function LoginPage() {
  const { dictionary } = useLanguage();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    login,
    undefined
  );

  const { formRef, fieldProps, errorProps } = useFormFeedback({ state });

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-purple-600/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Floating Top Language Switcher */}
        <div className="flex justify-end mb-3">
          <LanguageToggle variant="auth" />
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Brand header */}
          <div className="flex flex-col items-center text-center mb-8">
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
              {dictionary.common.appName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {dictionary.auth.signInSubtitle}
            </p>
          </div>

          <Suspense fallback={null}>
            <ResetSuccessNotice />
          </Suspense>

          {/* Global error message */}
          {state?.message && (
            <div className="mb-6">
              <AutoDismissBanner
                message={state.message}
                tone="error"
                autoHideMs={4000}
              />
            </div>
          )}

          <form ref={formRef} action={action} className="flex flex-col gap-4.5">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                {dictionary.auth.email}
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 size-4.5 text-slate-500 pointer-events-none" />
                <input
                  id="email"
                  {...fieldProps("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="officer@agency.gov"
                  required
                  key={state?.email ?? ""}
                  defaultValue={state?.email ?? ""}
                  className={`w-full rounded-xl border bg-slate-950/60 pl-10.5 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                    state?.errors?.email
                      ? "border-rose-500"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                />
              </div>
              <FieldError {...errorProps("email")} />
            </div>

            {/* Password field with Eye Toggle and Forgot Password Link */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  {dictionary.auth.password}
                </label>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {dictionary.auth.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <PasswordInput
                  id="password"
                  {...fieldProps("password")}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  error={Boolean(state?.errors?.password)}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
                />
              </div>
              <FieldError {...errorProps("password")} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>{dictionary.auth.loggingIn}</span>
                </>
              ) : (
                <>
                  <span>{dictionary.auth.signIn}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Install lives with the sign-in action */}
          <div className="mt-4">
            <PwaInstallButton variant="plain" />
          </div>

          {/* Footer link */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              {dictionary.auth.dontHaveAccount}{" "}
              <Link
                href="/signup"
                className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                {dictionary.auth.signUp}
              </Link>
            </p>
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                <ArrowLeft className="size-3.5" />
                <span>{dictionary.common.back}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
