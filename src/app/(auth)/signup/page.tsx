import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa/install-button";
import { SignupForm } from "./signup-form";
import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-purple-600/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Create Officer Account
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Register for My Duty — Gujarat Police Officer Portal
            </p>
          </div>

          <SignupForm profiles={profiles ?? []} />

          <div className="mt-4">
            <PwaInstallButton variant="plain" />
          </div>

          {/* An explicit way back. The logo above already linked home, but a
              logo is not an obvious affordance for "leave this page" — several
              people will never discover it. */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
