import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";
import { ArrowRight, Calendar, ClipboardCheck, Clock, Users } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa/install-button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="flex flex-wrap items-center justify-between gap-y-3 px-4 sm:px-6 py-4 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 group">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-2xl border border-amber-400/40 bg-slate-950 p-1 shadow-md shadow-amber-500/20 transition-transform group-hover:scale-105 sm:size-11">
            <Image
              src="/Gujarat-police.png"
              alt="Gujarat Police Logo"
              width={40}
              height={40}
              className="size-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-white transition-colors group-hover:text-amber-300 sm:text-lg">
              My Duty
            </span>
            <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-amber-400/90 sm:text-[10px]">
              Gujarat Police Portal
            </span>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Download App PWA Button in Navbar */}
          {/* <PwaInstallButton variant="header" /> */}
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-xs"
          >
            <span>Sign In</span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/30"
          >
            <span>Get Started</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300 mb-6 backdrop-blur-md">
          <span className="flex size-2 rounded-full bg-amber-400 animate-pulse" />
          Gujarat Police Officer Duty & Roster Management
        </div>
        <h1 className="mb-6 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">My Duty</span> Portal
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed">
          Official platform for Gujarat Police officers to log daily duties, compute travel allowances (TA), manage leave entitlements, check roster schedules, and access administrative records anytime, anywhere.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          {/* Matches the two links beside it, which already had this pair — without
              it the three stacked CTAs were different widths on mobile. */}
          <PwaInstallButton variant="hero" className="w-full justify-center sm:w-auto" />
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/40 hover:scale-[1.02]"
          >
            <span>Access Portal</span>
            <ArrowRight className="size-4.5" />
          </Link>
          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3.5 text-base font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-all backdrop-blur-md"
          >
            <span>Officer Registration</span>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-slate-700 transition-all">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20">
              <ClipboardCheck className="size-5.5" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-white">Duty Logging & TA</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Track duty shifts, travel routes, distance in km, and automatic travel allowance computations.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-slate-700 transition-all">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-4 border border-purple-500/20">
              <Clock className="size-5.5" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-white">Leave Balances</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Real-time balance calculations, half-day sessions, and year-round entitlement audits.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-slate-700 transition-all">
            <div className="flex size-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 mb-4 border border-sky-500/20">
              <Calendar className="size-5.5" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-white">Roster Calendar</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Integrated visual calendar for duty rosters, leaves, global holidays, and personal schedules.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-slate-700 transition-all">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
              <Users className="size-5.5" />
            </div>
            <h3 className="text-base font-semibold mb-2 text-white">RBAC Administration</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Granular permissions, officer profile assignments, and department structures.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-4 py-6 text-center text-xs text-slate-500 sm:px-6">
        <p>&copy; {new Date().getFullYear()} My Duty — Gujarat Police Duty & Officer Management Portal. All rights reserved.</p>
      </footer>
    </main>
  );
}
