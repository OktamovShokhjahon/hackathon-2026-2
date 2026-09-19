"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthHydrated, useAuthStore, type Role } from "@/lib/auth-store";
import { initials } from "@/lib/format";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/locales/uz";

export interface NavItem {
  href: string;
  /** Translated at render. Nav labels are chrome, and chrome is translated. */
  key: MessageKey;
}

/**
 * The navigation each role sees. Defined once here rather than restated in
 * every page: fifteen copies of the same array is fifteen places a new section
 * has to be remembered, and fifteen places a translation can drift.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", key: "nav.dashboard" },
  { href: "/admin/doctors", key: "nav.doctors" },
  { href: "/admin/patients", key: "nav.patients" },
  { href: "/admin/audit", key: "nav.audit" },
  { href: "/admin/subscription", key: "nav.subscription" },
];

export const DOCTOR_NAV: NavItem[] = [
  { href: "/doctor/dashboard", key: "nav.dashboard" },
  { href: "/doctor/patients", key: "nav.patients" },
  { href: "/doctor/alerts", key: "nav.alerts" },
];

export const PATIENT_NAV: NavItem[] = [
  { href: "/patient/dashboard", key: "nav.dashboard" },
  { href: "/patient/history", key: "nav.history" },
  { href: "/patient/diagnoses", key: "nav.diagnoses" },
  { href: "/patient/medications", key: "nav.medications" },
  { href: "/patient/digital-twin", key: "nav.digitalTwin" },
  { href: "/patient/chat", key: "nav.chat" },
];

const ROLE_KEY: Record<Role, MessageKey> = {
  ADMIN: "role.admin",
  DOCTOR: "role.doctor",
  PATIENT: "role.patient",
};

export function AppShell({
  children,
  role,
  navItems,
  /**
   * Replaces the last breadcrumb. Route segments are object ids on detail
   * pages, and `6AAD93E1…` tells the person reading it nothing.
   */
  crumbOverride,
}: {
  children: React.ReactNode;
  role: Role;
  navItems: NavItem[];
  crumbOverride?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const hydrated = useAuthHydrated();
  const [navOpen, setNavOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!hydrated) return;
    if (!user || user.role !== role) {
      router.replace("/login");
    }
  }, [hydrated, user, role, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="readout animate-pulse">Loading workspace</span>
      </div>
    );
  }

  if (!user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="readout">Redirecting to sign in</span>
      </div>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) =>
    index === segments.length - 1 && crumbOverride ? crumbOverride : segment.replace(/-/g, " "),
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-white/[0.09] text-white"
                : "text-white/60 hover:bg-white/[0.06] hover:text-white/90"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                style={{ background: "var(--cyan)" }}
              />
            )}
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Navy rail. The chrome carries the product's identity so the clinical
          surfaces can stay white and high-contrast where the data lives. */}
      <aside className="navy-rail hidden w-60 flex-col p-4 sm:flex">
        <Link href="/" className="mb-1 flex items-center gap-2 px-2">
          <Mark className="h-5 w-5" onNavy />
          <span className="display text-lg text-white">MAYOQ AI</span>
        </Link>
        <div className="mb-6 px-2">
          <span className="readout text-white/45">{t(ROLE_KEY[role])}</span>
        </div>
        {nav}
        <div className="my-4 h-px bg-white/10" />
        <button
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
          className="rounded-md px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.06] hover:text-white/80"
        >
          {t("action.signOut")}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--surface)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-label={t("nav.toggle")}
              className="rounded border border-[color:var(--line)] px-2 py-1 font-mono text-[11px] text-ink-muted sm:hidden"
            >
              {t("nav.menu")}
            </button>
            <ol className="flex min-w-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                  {index > 0 && <span aria-hidden>/</span>}
                  <span className={index === crumbs.length - 1 ? "truncate text-ink-muted" : "hidden sm:inline"}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint sm:inline">
              {t(ROLE_KEY[role])}
            </span>
            <span className="hidden text-sm text-ink md:inline">{user.fullName}</span>
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-medium text-white"
              style={{ background: "linear-gradient(140deg, var(--electric), var(--signal))" }}
            >
              {initials(user.fullName)}
            </span>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {navOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="navy-rail overflow-hidden p-3 sm:hidden"
            >
              {nav}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative min-w-0 flex-1 p-4 sm:p-6">
          {/* Soft blurred ground, purely decorative. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[color:var(--electric)]/[0.07] blur-3xl" />
            <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[color:var(--signal)]/[0.06] blur-3xl" />
          </div>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/**
 * Mark: a lamp throwing two beams across a measured horizon. "Mayoq" is a
 * lighthouse — the product's whole job is to light the hazard before the ship
 * reaches it. The lamp is the only lit element; the structure around it stays
 * hairline, so the mark reads as an instrument rather than a badge.
 */
export function Mark({ className = "h-5 w-5", onNavy = false }: { className?: string; onNavy?: boolean }) {
  const structure = onNavy ? "rgba(255,255,255,0.4)" : "var(--line-strong)";
  const horizon = onNavy ? "rgba(255,255,255,0.75)" : "var(--ink-muted)";
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      {/* The beams, widening as they leave the lens. */}
      <path
        d="M10.1 7.2 3 4.4M10.1 10.4 3 11.6M13.9 7.2 21 4.4M13.9 10.4 21 11.6"
        stroke="var(--lamp)"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* The lamp itself. */}
      <circle cx="12" cy="8.8" r="2.5" fill="var(--lamp)" />
      {/* Tower: two rakes down to a measured base. */}
      <path
        d="M10.2 11.6 9 19.4M13.8 11.6 15 19.4"
        stroke={structure}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M7.6 19.4h8.8" stroke={horizon} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
