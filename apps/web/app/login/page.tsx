"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login page — minimal, centered sign-in screen. Submits to /api/auth/login
 * and redirects to / on success. Styling mirrors the onboarding identity-step
 * using the same CSS variable palette (light + dark theme aware).
 */
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    height: 40,
    width: "100%",
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-surface, var(--color-background))",
    color: "var(--color-text)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--color-accent)";
    e.currentTarget.style.boxShadow =
      "0 0 0 3px color-mix(in oklab, var(--color-accent) 18%, transparent)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--color-border)";
    e.currentTarget.style.boxShadow = "none";
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!trimmedPassword) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      if (res.status === 401) {
        setError("Invalid email or password.");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Login failed. Please try again.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl p-8 shadow-sm"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          {/* Header */}
          <div className="space-y-1.5 text-center">
            <h1
              className="text-[28px] font-semibold leading-tight tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              Sign in to DenchClaw
            </h1>
            <p
              className="text-[13px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Enter your email and password to continue.
            </p>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3.5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={submitting}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p
              className="rounded-lg px-3 py-2.5 text-[13px]"
              style={{
                background: "color-mix(in oklab, var(--color-error) 10%, transparent)",
                color: "var(--color-error)",
                border: "1px solid color-mix(in oklab, var(--color-error) 25%, transparent)",
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center rounded-lg text-[14px] font-medium transition-all"
            style={{
              background: submitting
                ? "var(--color-accent-hover, #004F80)"
                : "var(--color-accent)",
              color: "#ffffff",
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
