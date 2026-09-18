"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthHydrated, useAuthStore, type Role } from "@/lib/auth-store";
import { initials } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Clinic admin",
  DOCTOR: "Doctor",
  PATIENT: "Patient",
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
            {item.label}
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
          <span className="display text-lg text-white">TwinRx</span>
        </Link>
        <div className="mb-6 px-2">
          <span className="readout text-white/45">{ROLE_LABEL[role]}</span>
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
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--surface)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-label="Toggle navigation"
              className="rounded border border-[color:var(--line)] px-2 py-1 font-mono text-[11px] text-ink-muted sm:hidden"
            >
              Menu
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
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint sm:inline">
              {ROLE_LABEL[role]}
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

/** Mark: a body axis crossed by a pulse — the twin, reduced to two strokes. */
export function Mark({ className = "h-5 w-5", onNavy = false }: { className?: string; onNavy?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={onNavy ? "rgba(255,255,255,0.25)" : "var(--line-strong)"}
        strokeWidth="1"
      />
      <path
        d="M12 3v7.5M12 13.5V21"
        stroke={onNavy ? "var(--cyan)" : "var(--electric)"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 12h3l1.8-3.2L11 15l2-4.4 1.4 1.4H20"
        stroke={onNavy ? "#ffffff" : "var(--signal)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
