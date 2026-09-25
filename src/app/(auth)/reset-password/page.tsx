"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { updatePasswordOnly, type OtpFormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError } from "@/components/ui/field-error";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";
import { Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState<OtpFormState, FormData>(
    updatePasswordOnly,
    undefined,
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-purple-600/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
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
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Lock className="size-6 text-indigo-400" />
              <span>Set New Password</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Your recovery link was verified. Choose a secure new password for your account.
            </p>
          </div>

          {/* Feedback banner */}
          {state?.message && (
            <div className="mb-6">
              <AutoDismissBanner
                message={state.message}
                tone={state.success ? "success" : "error"}
                autoHideMs={5000}
              />
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4.5">
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
                  error={Boolean(state?.errors?.password)}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
                />
              </div>
              {state?.errors?.password && (
                <FieldError message={state.errors.password[0]} />
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
                  error={Boolean(state?.errors?.confirmPassword)}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
                />
              </div>
              {state?.errors?.confirmPassword && (
                <FieldError message={state.errors.confirmPassword[0]} />
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4.5 text-emerald-300" />
                  <span>Update Password & Log In</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer link */}
          <div className="mt-8 text-center border-t border-slate-800/80 pt-6">
            <Link
              href="/login"
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Remembered your credentials? Sign In
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
