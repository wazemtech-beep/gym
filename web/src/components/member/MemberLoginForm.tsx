"use client";
import { apiFetch } from "@/lib/apiFetch";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";
import { LOGIN_IDENTIFIER_MAX_LENGTH, LOGIN_PASSWORD_MAX_LENGTH, validateLoginInput } from "@/lib/authValidation";

export default function MemberLoginForm({ notice }: { notice?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = validateLoginInput({ identifier, password, portal: "member" });
    if (!validation.success) { setError(validation.error); return; }
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data), credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "Sign in nahi ho saka. Dobara koshish karein.");
      if (data.user?.role !== "MEMBER" || !["/dashboard", "/auth/change-password"].includes(data.redirectUrl)) throw new Error("Member login complete nahi ho saka.");
      // Load a fresh document so a previous account's client state is not reused.
      window.location.assign(data.redirectUrl);
    } catch (cause) {
      setError(cause instanceof TypeError ? "Server se rabta nahi ho saka. Dobara koshish karein." : cause instanceof Error ? cause.message : "Sign in nahi ho saka.");
      submitting.current = false;
      setLoading(false);
    }
  }

  return <AuthShell><div className="auth-card">
    <div className="auth-intro"><h1>Member sign in</h1></div>
    {notice && !error && <p role="status" style={{ marginBottom: 16 }}>{notice}</p>}
    {error && <div className="alert-error" id="member-login-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    <form onSubmit={handleSubmit} aria-busy={loading}>
      <div className="form-group">
        <label className="form-label" htmlFor="member-login-identifier">Email or Member ID</label>
        <input id="member-login-identifier" className="form-input" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={LOGIN_IDENTIFIER_MAX_LENGTH} value={identifier} onChange={event => { setIdentifier(event.target.value); setError(""); }} placeholder="Email or OXG-000125" disabled={loading} aria-describedby={error ? "member-login-error" : undefined} required />
      </div>
      <div className="form-group">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <label className="form-label" htmlFor="member-login-password" style={{ marginBottom: 0 }}>Password</label>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <div style={{ position: "relative" }}>
          <input id="member-login-password" className="form-input" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={LOGIN_PASSWORD_MAX_LENGTH} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" style={{ paddingRight: 46 }} disabled={loading} aria-describedby={error ? "member-login-error" : undefined} required />
          <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
        </div>
      </div>
      <button className="btn-primary auth-submit" type="submit" disabled={loading}>{loading ? "Signing in…" : <><span>Sign in</span><ArrowRight size={17} /></>}</button>
    </form>
    <p style={{ marginTop: 18, fontSize: ".82rem", color: "var(--text-secondary)" }}>New to the gym? <Link href="/create-account">Create account</Link></p>
    <Link href="/admin/login" style={{ fontSize: ".82rem" }}>Staff sign in</Link>
  </div></AuthShell>;
}
