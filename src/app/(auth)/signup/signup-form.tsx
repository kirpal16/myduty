"use client";

import { useActionState } from "react";
import { NavLink as Link } from "@/components/ui/nav-link";
import { signup, type AuthFormState } from "@/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { FormSelect } from "@/components/ui/form-select";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { FieldError } from "@/components/ui/field-error";
import { useFormFeedback } from "@/lib/hooks/useFormFeedback";
import { AutoDismissBanner } from "@/components/ui/auto-dismiss-banner";

type Profile = { id: string; name: string; code: string };

export function SignupForm({ profiles }: { profiles: Profile[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined
  );

  const { formRef, fieldProps, errorProps } = useFormFeedback({ state });

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4.5">
      {/* Global error message */}
      {state?.message && (
        <AutoDismissBanner
          message={state.message}
          tone="error"
          autoHideMs={4000}
        />
      )}

      {/* Row 1: Profile & Full Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="profileId"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Role Profile <span className="text-rose-400">*</span>
          </label>
          <FormSelect
            id="profileId"
            {...fieldProps("profileId")}
            required
            placeholder="Select officer profile"
            iconName="shield"
            error={!!errorProps("profileId").message}
            options={profiles.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.code})`,
            }))}
          />
          <FieldError {...errorProps("profileId")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="fullName"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Full Name <span className="text-rose-400">*</span>
          </label>
          <input
            id="fullName"
            {...fieldProps("fullName")}
            type="text"
            placeholder="e.g. Inspector John Doe"
            required
            className={`w-full rounded-xl border bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
              state?.errors?.fullName
                ? "border-rose-500"
                : "border-slate-800 hover:border-slate-700"
            }`}
          />
          <FieldError {...errorProps("fullName")} />
        </div>
      </div>

      {/* Row 2: Employee Code & Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="employeeCode"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Employee Code <span className="text-slate-500 text-[10px]">(Optional)</span>
          </label>
          <input
            id="employeeCode"
            name="employeeCode"
            type="text"
            placeholder="EMP-1042"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs hover:border-slate-700 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Phone Number <span className="text-slate-500 text-[10px]">(Optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs hover:border-slate-700 transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Row 3: Email & Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Email Address <span className="text-rose-400">*</span>
          </label>
          <input
            id="email"
            {...fieldProps("email")}
            type="email"
            autoComplete="email"
            placeholder="officer@agency.gov"
            required
            className={`w-full rounded-xl border bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
              state?.errors?.email
                ? "border-rose-500"
                : "border-slate-800 hover:border-slate-700"
            }`}
          />
          <FieldError {...errorProps("email")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Password <span className="text-rose-400">*</span>
          </label>
          <PasswordInput
            id="password"
            {...fieldProps("password")}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            required
            error={Boolean(state?.errors?.password)}
            className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 hover:border-slate-700"
          />
          <FieldError {...errorProps("password")} />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
      >
        {pending ? (
          <>
            <Loader2 className="size-4.5 animate-spin" />
            <span>Creating account…</span>
          </>
        ) : (
          <>
            <span>Complete Registration</span>
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      {/* Footer link */}
      <div className="mt-4 pt-4 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
          >
            Log in here
          </Link>
        </p>
      </div>
    </form>
  );
}
