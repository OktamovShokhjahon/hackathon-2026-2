"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthHydrated, useAuthStore, type Role } from "@/lib/auth-store";

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
}: {
  children: React.ReactNode;
  role: Role;
  navItems: NavItem[];
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

  const crumbs = pathname.split("/").filter(Boolean);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded px-3 py-2 text-sm transition ${
              active ? "bg-ink/[0.035] text-ink" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-signal"
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
      <aside
        className="hidden w-60 flex-col border-r bg-paper-deep/60 p-4 sm:flex"
        style={{ borderColor: "var(--line)" }}
      >
        <Link href="/" className="mb-1 flex items-center gap-2 px-2">
          <Mark />
          <span className="display text-lg text-ink">TwinRx</span>
        </Link>
        <div className="mb-6 px-2">
          <span className="readout">{ROLE_LABEL[role]}</span>
        </div>
        {nav}
        <div className="rail my-4" />
        <button
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
          className="rounded px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition hover:bg-ink/[0.05] hover:text-ink"
        >
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-label="Toggle navigation"
              className="rounded border px-2 py-1 font-mono text-[11px] text-ink-muted sm:hidden"
              style={{ borderColor: "var(--line)" }}
            >
              Menu
            </button>
            <ol className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb}-${index}`} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden>/</span>}
                  <span className={index === crumbs.length - 1 ? "text-ink-muted" : undefined}>
                    {crumb.replace(/-/g, " ")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint sm:inline">
              {ROLE_LABEL[role]}
            </span>
            <span className="text-sm text-ink">{user.fullName}</span>
          </div>
        </header>

        {navOpen && (
          <div className="border-b p-3 sm:hidden" style={{ borderColor: "var(--line)" }}>
            {nav}
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Mark: a body axis crossed by a pulse — the twin, reduced to two strokes. */
export function Mark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--line-strong)" strokeWidth="1" />
      <path d="M12 3v7.5M12 13.5V21" stroke="var(--electric)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 12h3l1.8-3.2L11 15l2-4.4 1.4 1.4H20"
        stroke="var(--signal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
