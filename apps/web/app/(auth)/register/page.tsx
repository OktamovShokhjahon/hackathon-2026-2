"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";

export default function RegisterClinicPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clinicName: "",
    adminFullName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/register-clinic", form);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
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
        className="panel flex flex-col gap-4 p-8"
      >
        <h1 className="display text-[26px] leading-tight text-ink">Start your 7-day clinic demo</h1>
        {[
          { key: "clinicName", label: "Clinic name" },
          { key: "adminFullName", label: "Your full name" },
          { key: "adminEmail", label: "Your email", type: "email" },
          { key: "password", label: "Password", type: "password" },
        ].map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="readout">{field.label}</span>
            <input
              type={field.type ?? "text"}
              required
              minLength={field.key === "password" ? 10 : undefined}
              value={form[field.key as keyof typeof form]}
              onChange={(e) => update(field.key as keyof typeof form, e.target.value)}
              className="w-full rounded border bg-ink/[0.035] px-3 py-2 text-[15px] text-ink outline-none transition focus:border-signal" style={{ borderColor: "var(--line)" }}
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded border border-state-green/40 bg-state-green/10 px-3 py-2 text-sm text-state-green">
            Clinic created. Your 7-day demo is active. Redirecting to sign in.
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded bg-electric px-4 py-2.5 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
        >
          {loading ? "Creating clinic..." : "Create clinic"}
        </button>
      </motion.form>
    </main>
  );
}
