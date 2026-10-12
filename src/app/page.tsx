import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  ClipboardCheck,
  Clock,
  Shield,
  FileText,
  Printer,
  Sparkles,
  MapPin,
  Car,
  Award,
  ChevronRight,
  Lock,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { PwaInstallButton } from "@/components/pwa/install-button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-between bg-slate-950 text-white selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 left-10 size-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-60 right-10 size-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-y-3 px-4 sm:px-6 py-3.5 max-w-7xl mx-auto w-full">
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
                Duty & Leave Portal
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-xs cursor-pointer"
            >
              <span>Sign In</span>
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="size-3.5 hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto flex max-w-5xl flex-col items-center justify-center px-4 pt-12 pb-8 text-center sm:px-6 sm:pt-16">
        {/* Police Duty Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 mb-6 backdrop-blur-md shadow-xs">
          <span className="flex size-2 rounded-full bg-amber-400 animate-pulse" />
          <span>પોલીસ સ્ટાફ માટે ડ્યુટી પોર્ટલ ( Duty & Leave Portal)</span>
        </div>

        {/* Main Headline */}
        <h1 className="mb-5 text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-white max-w-4xl">
          Welcome to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-sm">
            My Duty
          </span>{" "}
          Portal
        </h1>

        {/* Subtitle in English and Gujarati */}
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mb-8 leading-relaxed font-normal">
          પોલીસ અધિકારીઓ અને કર્મચારીઓ માટે દૈનિક ફરજ (Duty Log), મુસાફરી ભથ્થું (TA),
          રજા બેલેન્સ (Leave Balances), રોસ્ટર કેલેન્ડર અને રજા અરજી પત્ર તૈયાર કરવાનું પ્રાઇવેટ ડિજિટલ પ્લેટફોર્મ.
        </p>

        {/* Call To Action Buttons - Sleek, Professional & Balanced */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-xl">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>પોર્ટલમાં પ્રવેશ કરો (Access Portal)</span>
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 hover:text-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition-all backdrop-blur-sm cursor-pointer"
          >
            <span>નવી નોંધણી (Registration)</span>
          </Link>

          <PwaInstallButton variant="hero" />
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP PORTAL SHOWCASE / SKELETON APP MOCKUP                            */}
        {/* ========================================================================= */}
        <div className="w-full max-w-5xl mt-12 sm:mt-16 rounded-3xl border border-slate-700/80 bg-slate-900/90 shadow-2xl shadow-indigo-950/70 ring-1 ring-white/10 overflow-hidden backdrop-blur-xl text-left">
          {/* Mockup Desktop Window Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-[11px] font-mono text-slate-400 hidden sm:inline">
                https://myduty-eight.vercel.app/
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Live Officer Dashboard</span>
            </div>
          </div>

          {/* Mockup Desktop Portal Header Inside */}
          <div className="p-4 sm:p-6 bg-gradient-to-b from-slate-900/90 to-slate-950/95 space-y-5">
            {/* Officer Profile Badge Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                  <Image
                    src="/Gujarat-police.png"
                    alt="Emblem"
                    width={28}
                    height={28}
                    className="size-7 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>Kirpalsinh Solanki</span>
                  </h3>
                  <p className="text-xs text-slate-400">QRT અરવલ્લી • ગુજરાત પોલીસ</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                  <Shield className="size-3.5 text-indigo-400" />
                  <span>On Active Duty (ચાલુ ફરજ)</span>
                </span>
              </div>
            </div>

            {/* 4 KPI Dashboard Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Stat 1: Duty Log */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <ClipboardCheck className="size-3.5 text-indigo-400" />
                  <span>દૈનિક ફરજ (Duty)</span>
                </span>
                <p className="text-lg sm:text-xl font-extrabold text-white">૧૮ દિવસ પૂર્ણ</p>
                <p className="text-[10px] text-emerald-400 font-medium">આ મહિનાની ફરજ હાજરી</p>
              </div>

              {/* Stat 2: TA Earned */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Car className="size-3.5 text-amber-400" />
                  <span>TA મુસાફરી ભથ્થું</span>
                </span>
                <p className="text-lg sm:text-xl font-extrabold text-amber-300">₹ ૪,૮૫૦</p>
                <p className="text-[10px] text-slate-400 font-medium">ઓટો-કેલ્ક્યુલેટેડ ભથ્થું</p>
              </div>

              {/* Stat 3: Leave Balances */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-purple-400" />
                  <span>રજા બેલેન્સ (Leaves)</span>
                </span>
                <p className="text-lg sm:text-xl font-extrabold text-purple-300">૧૨ CL · ૨ HL</p>
                <p className="text-[10px] text-slate-400 font-medium">સંપૂર્ણ હિસાબ ઉપલબ્ધ</p>
              </div>

              {/* Stat 4: Official Report */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-sky-400" />
                  <span>રજા અરજી રિપોર્ટ</span>
                </span>
                <p className="text-lg sm:text-xl font-extrabold text-sky-300">સંયુક્ત રજા અરજી</p>
                <p className="text-[10px] text-sky-400 font-medium">પ્રિન્ટ / PDF ડાઉનલોડ</p>
              </div>
            </div>

            {/* Split Interactive Showcase Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 pt-1">
              {/* Left Side: Recent Active Duty snippet */}
              <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <MapPin className="size-3.5 text-indigo-400" />
                    <span>આજની સક્રિય કામગીરી (Today&apos;s Active Duty)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Day Bandobast
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">પોસ્ટિંગ / પોઈન્ટ:</span>
                    <span className="font-semibold text-white">QRT અરવલ્લી → કલેક્ટર કચેરી</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">મુસાફરી કિમી (Distance):</span>
                    <span className="font-bold text-amber-300">૩૪ કિમી (સરકારી વાહન)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">સમયગાળો (Shift Hours):</span>
                    <span className="font-semibold text-white">08:00 AM થી 08:00 PM (૧૨ કલાક)</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Official Gujarati Letter Snippet */}
              <div className="lg:col-span-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/30 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Printer className="size-3.5 text-indigo-400" />
                    <span>પોલીસ રજા અરજી પત્ર વ્યવહાર (Application Letter Format)</span>
                  </span>
                  <span className="text-[10px] bg-indigo-600/20 text-indigo-300 font-bold px-2 py-0.5 rounded-md">
                    A4 પ્રિન્ટ
                  </span>
                </div>

                <div className="space-y-1 text-[11px] leading-relaxed text-slate-300 font-serif">
                  <p className="font-bold text-slate-200">પ્રતિ, પોલીસ સબ ઇન્સપેક્ટરશ્રી, QRT અરવલ્લી</p>
                  <p className="font-extrabold text-amber-200">વિષય: ૬ દિવસ રજા મંજૂર કરવા બાબત.</p>
                  <p className="text-slate-400 line-clamp-2">
                    જય ભારત સાથે સવિનય જણાવવાનું કે, અંગત કામ અર્થે તારીખ ૧૩/૧૦/૨૦૨૬ થી ૧૫/૧૦/૨૦૨૬ સુધી કે.લીવ તથા ૧૬/૧૦/૨૦૨૬ ના રોજ મ.રજા...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            પોલીસ કામગીરી માટે આધુનિક ડિજિટલ સુવિધાઓ
          </h2>
          <p className="text-sm text-slate-400">
            પોલીસ કર્મચારીઓની દૈનિક જરૂરિયાતો, રજા નિયમો અને સ્ટાન્ડર્ડ ફોર્મેટ અનુસાર સરળતાથી ઉપયોગ માટે તૈયાર કરેલ.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-indigo-500/50 hover:bg-slate-900/90 transition-all duration-200 group">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <ClipboardCheck className="size-5.5" />
            </div>
            <h3 className="text-base font-bold mb-2 text-white group-hover:text-indigo-300 transition-colors">
              Duty Logging & TA
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              રોજબરોજની ફરજ, પેટ્રોલિંગ, પોઇન્ટ બંદોબસ્ત અને સરકારી નિયમાનુસાર ટ્રાવેલિંગ એલાઉન્સ (TA) ની ઓટો ગણતરી.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-purple-500/50 hover:bg-slate-900/90 transition-all duration-200 group">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-4 border border-purple-500/20 group-hover:scale-110 transition-transform">
              <Clock className="size-5.5" />
            </div>
            <h3 className="text-base font-bold mb-2 text-white group-hover:text-purple-300 transition-colors">
              Leave & Quota Balance
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              કેઝ્યુઅલ લીવ (CL), મરજિયાત રજા (OH), લાભ રજા (HL) અને હક રજા (EL) ના રિયલ-ટાઇમ બેલેન્સ અને કેરી-ફોરવર્ડ.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-amber-500/50 hover:bg-slate-900/90 transition-all duration-200 group">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <FileText className="size-5.5" />
            </div>
            <h3 className="text-base font-bold mb-2 text-white group-hover:text-amber-300 transition-colors">
              રજા અરજી પત્ર / રિપોર્ટ બિલ્ડર
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              સંયુક્ત રજા અરજી, હેડક્વાર્ટર પરવાનગી, સરકારી લેટરહેડ અને ગુજરાતી અંકો સાથે એક જ ક્લિકમાં A4 પ્રિન્ટ અને PDF.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all duration-200 group">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <Smartphone className="size-5.5" />
            </div>
            <h3 className="text-base font-bold mb-2 text-white group-hover:text-emerald-300 transition-colors">
              PWA & Offline Support
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              મોબાઈલ અથવા ડેસ્કટોપમાં એપ તરીકે ઇન્સ્ટોલ કરી શકો છો. નેટવર્ક વગર પણ ઓફલાઇન મોડમાં સરળતાથી કામ કરે છે.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Official Impact Banner */}
      <section className="border-y border-slate-800/80 bg-slate-900/40 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400">૩૩ જિલ્લા</p>
            <p className="text-xs text-slate-400 font-medium">સંપૂર્ણ ગુજરાત કવરેજ</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400">૧૦૦%</p>
            <p className="text-xs text-slate-400 font-medium">પેપરલેસ રજા વ્યવસ્થા</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">ઇન્સ્ટન્ટ TA</p>
            <p className="text-xs text-slate-400 font-medium">ઓટોમેટિક મુસાફરી ભથ્થું</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-extrabold text-purple-400">૨૪ × ૭</p>
            <p className="text-xs text-slate-400 font-medium">ઓફલાઇન PWA સપોર્ટ</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-4 py-8 text-center text-xs text-slate-500 sm:px-6 space-y-2">
        <p className="font-semibold text-slate-400">
          My Duty • પોલીસ કર્મચારીઓ માટે પ્રાઇવેટ ડ્યુટી અને રજા મેનેજમેન્ટ પોર્ટલ
        </p>
        <p suppressHydrationWarning>
          &copy; {new Date().getFullYear()} My Duty — Private Duty & Leave Management System. All rights reserved.
        </p>
        <p className="text-[11px] text-slate-500">
          Note: This is an independent private application built for police personnel, not an official government portal.
        </p>
      </footer>
    </main>
  );
}
