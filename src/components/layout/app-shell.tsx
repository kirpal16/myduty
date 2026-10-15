"use client";

import { NavLink as Link } from "@/components/ui/nav-link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useModalBackClose } from "@/lib/hooks/useModalBackClose";
import { useEffect, useRef, useState } from "react";
import { QueryScrollPreserver } from "@/components/ui/query-scroll-preserver";
import {
  LayoutDashboard,
  Briefcase,
  CalendarOff,
  PieChart,
  Calendar,

  Sun,
  FolderArchive,
  Settings,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  BadgeCheck,
  Building2,
  Layers,
  FileText,
  LogOut,
  Menu,
  X,
  User as UserIcon,
} from "lucide-react";
import { LanguageToggle } from "./language-toggle";
import { LogoutModal } from "./logout-modal";
import { useLanguage } from "@/lib/i18n/language-context";

export type NavItem = { href: string; label: string; icon?: string };
export type NavSection = { title?: string; items: NavItem[] };

const iconMap: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/duty": Briefcase,
  "/leave": CalendarOff,
  "/leave/balance": PieChart,
  "/calendar": Calendar,
  "/holidays": Sun,
  "/storage": FolderArchive,
  "/reports": FileSpreadsheet,
  "/profile": UserIcon,
  "/settings": Settings,
  "/admin/dashboard": LayoutDashboard,
  "/admin/users": Users,
  "/admin/permissions": ShieldCheck,
  "/admin/profiles": BadgeCheck,
  "/admin/departments": Building2,
  "/admin/duty-types": Layers,
  "/admin/leave-types": FileText,
};

export function AppShell({
  sections,
  userName,
  userRole,
  userAvatar,
  children,
}: {
  sections: NavSection[];
  userName: string;
  userRole?: string;
  userAvatar?: string | null;
  children: React.ReactNode;
}) {
  const { dictionary, isChangingLanguage } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const getTranslatedLabel = (href: string, fallback: string) => {
    switch (href) {
      case "/dashboard":
        return dictionary.nav.dashboard;
      case "/duty":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.dutyRoster : dictionary.nav.dutyLog;
      case "/leave":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.leaveRecords : dictionary.nav.leaveLog;
      case "/leave/balance":
        return dictionary.nav.leaveBalance;
      case "/calendar":
        return dictionary.nav.calendar;
      case "/holidays":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.officialHolidays : dictionary.nav.holidays;
      case "/storage":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.documentVault : dictionary.nav.files;
      case "/reports":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.reportsAnalytics : dictionary.nav.reports;
      case "/profile":
        return dictionary.nav.profile;
      case "/settings":
        return userRole === "SUPER_ADMIN" ? dictionary.nav.systemSettings : dictionary.nav.settings;
      case "/admin/dashboard":
        return dictionary.nav.adminOverview;
      case "/admin/users":
        return dictionary.nav.officerDirectory;
      case "/admin/permissions":
        return dictionary.nav.storagePermissions;
      case "/admin/profiles":
        return dictionary.nav.officerProfile;
      case "/admin/departments":
        return dictionary.nav.departments;
      case "/admin/duty-types":
        return dictionary.nav.dutyTypes;
      case "/admin/leave-types":
        return dictionary.nav.leaveTypes;
      default:
        return fallback;
    }
  };

  const getTranslatedSectionTitle = (title?: string) => {
    if (!title) return undefined;
    if (title === "Main Menu") return dictionary.nav.mainMenu;
    if (title === "Operations & Oversight") return dictionary.nav.operationsOversight;
    if (title === "System Administration") return dictionary.nav.systemAdmin;
    return title;
  };

  // The drawer is a modal surface, so the page behind it must not scroll.
  // Without this a drag anywhere over the drawer or its backdrop scrolled the
  // content underneath instead of the menu.
  useBodyScrollLock(open);

  // Closes on back button/gesture or Escape key.
  useModalBackClose(open, () => setOpen(false));

  // Move focus into the drawer, and hand it back to the button that opened it.
  // Otherwise a keyboard or screen-reader user is left at the top of the
  // document with no idea the menu opened, and nowhere sensible on close.
  useEffect(() => {
    if (open) {
      drawerRef.current?.focus();
      return;
    }
    // Only reclaim focus if it is still inside the drawer being unmounted —
    // tapping a nav link closes the drawer too, and stealing focus back to the
    // menu button then would fight the navigation.
    if (drawerRef.current?.contains(document.activeElement)) {
      menuButtonRef.current?.focus();
    }
  }, [open]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
  };

  /** "/settings?tab=holidays" -> ["/settings", "tab=holidays"] */
  const splitHref = (href: string): [string, string | null] => {
    const i = href.indexOf("?");
    return i === -1 ? [href, null] : [href.slice(0, i), href.slice(i + 1)];
  };

  const allHrefs = sections.flatMap((s) => s.items.map((i) => splitHref(i.href)[0]));

  const isItemActive = (href: string) => {
    const [path, query] = splitHref(href);

    // Two entries can now share a path and differ only by tab — Settings and
    // Holidays are both /settings — so a query in the href has to be matched,
    // or both would light up at once and neither would mean anything.
    if (query) {
      const [key, value] = query.split("=");
      return pathname === path && searchParams?.get(key) === value;
    }
    // …and the plain entry must not claim a path that a tabbed sibling owns.
    const tabbedSibling = sections
      .flatMap((s) => s.items.map((i) => i.href))
      .find((h) => {
        const [p2, q2] = splitHref(h);
        if (p2 !== path || !q2) return false;
        const [k, v] = q2.split("=");
        return searchParams?.get(k) === v;
      });
    if (tabbedSibling) return false;

    if (pathname === path) return true;
    if (path === "/dashboard" || path === "/admin/dashboard") return false;
    if (pathname.startsWith(`${path}/`)) {
      // Check if there is another more specific item in the menu matching this pathname
      const hasMoreSpecific = allHrefs.some(
        (other) =>
          other !== path &&
          other.startsWith(path) &&
          (pathname === other || pathname.startsWith(`${other}/`))
      );
      return !hasMoreSpecific;
    }
    return false;
  };

  const nav = (
    /* Three bands: brand, scrolling nav, footer. `justify-between` used to
       space them, which meant the whole column grew past the screen and the
       logout scrolled away with everything else. Giving the middle band
       flex-1 pins the brand and the footer instead, and only the menu itself
       scrolls — and only when it actually needs to. */
    <div className="flex h-full flex-col p-4 bg-slate-900 text-slate-100 border-r border-slate-800/80">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {/* Brand Header */}
        <div className="flex shrink-0 items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-slate-950 p-1 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Image
                src="/Gujarat-police.png"
                alt="Gujarat Police Logo"
                width={32}
                height={32}
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                {dictionary.common.appName}
              </span>
              <span className="text-[10px] font-semibold text-amber-400/85 tracking-wide">
                {dictionary.common.subTitle}
              </span>
            </div>
          </Link>
          {open && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pr-1">
          {sections.map((section, i) => (
            <div key={section.title ?? i} className="flex flex-col gap-1.5">
              {section.title && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {getTranslatedSectionTitle(section.title)}
                </p>
              )}
              {section.items.map((item) => {
                const IconComponent = iconMap[item.href] || UserIcon;
                const active = isItemActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-200 ${active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                  >
                    <IconComponent
                      className={`size-4.5 shrink-0 ${active ? "text-white" : "text-slate-400"
                        }`}
                    />
                    <span className="truncate">{getTranslatedLabel(item.href, item.label)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* User Footer Profile & Language Toggle */}
      <div className="shrink-0 pt-3 mt-3 border-t border-slate-800 flex flex-col gap-2.5">
        <LanguageToggle variant="sidebar" />

        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800/70 transition-all border border-slate-700/40">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2.5 min-w-0 flex-1"
          >
            {userAvatar ? (
              <div className="relative size-8 shrink-0 rounded-lg overflow-hidden border border-indigo-500/40 bg-slate-900 group-hover:scale-105 transition-transform">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={userAvatar}
                  alt={userName}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30 group-hover:scale-105 transition-transform">
                {getInitials(userName)}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                {userName}
              </span>
              {userRole && (
                <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400 truncate">
                  {userRole.replace("_", " ")}
                </span>
              )}
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsLogoutOpen(true)}
            title={dictionary.nav.logout}
            aria-label={dictionary.nav.logout}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-400 transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <QueryScrollPreserver />

      {/* Visual top indicator for instant language revalidation feedback */}
      {isChangingLanguage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-60 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-400 animate-pulse shadow-sm shadow-indigo-500/50"
        />
      )}

      {/* Mobile top bar — safe-area padding accounts for notch / status bar */}
      <header className="mobile-header-safe fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-border/80 bg-card/90 backdrop-blur-md px-3 sm:px-4 md:hidden print:hidden gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted shadow-xs transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 truncate">
            <div className="relative flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-slate-950 p-0.5 shadow-xs">
              <Image
                src="/Gujarat-police.png"
                alt="Gujarat Police Logo"
                width={24}
                height={24}
                className="size-full object-contain"
              />
            </div>
            <span className="text-sm font-bold text-foreground truncate">
              {dictionary.common.appName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle variant="header" />
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {userAvatar ? (
              <div className="relative size-7 shrink-0 rounded-full overflow-hidden border border-indigo-500/40 bg-slate-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={userAvatar}
                  alt={userName}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px] border border-indigo-500/30">
                {getInitials(userName)}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block sticky top-0 h-screen z-30 shadow-xs print:hidden">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 overscroll-contain bg-black/60 backdrop-blur-xs transition-opacity"
          />
          {/* overscroll-contain stops a drag that reaches the end of the menu
              from continuing into the page behind it. The height cap on the
              nav is md-only so this panel is the single scroll container here;
              nesting two of them made the menu scroll in a short inner window
              within an outer one. */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 overflow-hidden bg-slate-900 shadow-2xl outline-none animate-in slide-in-from-left duration-200"
          >
            {nav}
          </div>
        </div>
      )}

      {/* Main content body with responsive padding and mobile safe-area */}
      <div className="mobile-main-safe flex-1 min-w-0 flex flex-col pt-16 md:pt-0 overflow-x-hidden print:pt-0 print:overflow-visible">
        {children}
      </div>

      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />
    </div>
  );
}
