"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Mark } from "@/components/ui/app-shell";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: "ADMIN" | "DOCTOR" | "PATIENT"; fullName: string; email: string; tenantId: string };
}

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  DOCTOR: "/doctor/dashboard",
  PATIENT: "/patient/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<LoginResponse>("/auth/login", { email, password });
      setSession(result);
      router.push(ROLE_HOME[result.user.role] ?? "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="panel flex flex-col gap-5 p-8"
      >
        <div>
          <div className="flex items-center gap-2">
            <Mark className="h-4 w-4" />
            <span className="readout">TwinRx</span>
          </div>
          <h1 className="display mt-3 text-[26px] leading-tight text-ink">Sign in</h1>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="readout">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border bg-ink/[0.035] px-3 py-2 text-[15px] text-ink outline-none transition focus:border-signal"
            style={{ borderColor: "var(--line)" }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="readout">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border bg-ink/[0.035] px-3 py-2 text-[15px] text-ink outline-none transition focus:border-signal"
            style={{ borderColor: "var(--line)" }}
          />
        </label>
        {error && (
          <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded bg-electric px-4 py-2.5 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </motion.form>
    </main>
  );
}
