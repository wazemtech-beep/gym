"use client";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"email" | "reception">("email");

  // Email Flow
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Reception Code Flow
  const [identifier, setIdentifier] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setEmailError("Email address darj karein.");
      return;
    }

    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setEmailError(data.error || "Password reset request fail ho gayi.");
        setEmailLoading(false);
        return;
      }

      setEmailSuccess(data.message || "Check your email for password reset instructions.");
      setEmailLoading(false);
    } catch {
      setEmailError("Server se rabta nahi ho saka. Dobara koshish karein.");
      setEmailLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !resetCode || !newPassword) {
      setCodeError("Tamam zaroori maloomat darj karein.");
      return;
    }

    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setCodeError("Password kam az kam 8 characters ka hona chahiye (maximum 72 bytes).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setCodeError("Passwords match nahi kar rahe.");
      return;
    }

    setCodeLoading(true);
    setCodeError(null);
    setCodeSuccess(null);

    try {
      const res = await apiFetch("/api/auth/reset-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          resetCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCodeError(data.error || "Reset code tasdeeq nahi ho saka.");
        setCodeLoading(false);
        return;
      }

      setCodeSuccess("Password kamiyabi se tabdeel ho gaya! Login par muntaqil kiya ja raha hai...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setCodeError("Server se rabta nahi ho saka. Dobara koshish karein.");
      setCodeLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-card" style={{ maxWidth: "460px" }}>
        <div className="auth-intro">
          <h1>Reset Password</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "4px" }}>
            Apna password dobara set karne ka tariqa muntakhab karein.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "var(--bg-secondary)",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "20px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("email");
              setEmailError(null);
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "email" ? "var(--bg-surface)" : "transparent",
              color: activeTab === "email" ? "var(--text-main)" : "var(--text-muted)",
              fontWeight: activeTab === "email" ? 600 : 500,
              fontSize: "0.82rem",
              cursor: "pointer",
              boxShadow: activeTab === "email" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Mail size={15} />
            <span>Email Link</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("reception");
              setCodeError(null);
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "reception" ? "var(--bg-surface)" : "transparent",
              color: activeTab === "reception" ? "var(--text-main)" : "var(--text-muted)",
              fontWeight: activeTab === "reception" ? 600 : 500,
              fontSize: "0.82rem",
              cursor: "pointer",
              boxShadow: activeTab === "reception" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <KeyRound size={15} />
            <span>Reception Code</span>
          </button>
        </div>

        {/* Tab 1: Email Reset Link */}
        {activeTab === "email" && (
          <div>
            {emailError && (
              <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>{emailError}</span>
              </div>
            )}

            {emailSuccess && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-accent)",
                  color: "var(--accent-primary)",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, marginBottom: "6px" }}>
                  <CheckCircle2 size={18} />
                  <span>Request Successful</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem" }}>{emailSuccess}</p>
                
              </div>
            )}

            {!emailSuccess && (
              <form onSubmit={handleEmailSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">
                    Registered Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    className="form-input"
                    placeholder="e.g. member@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLoading}
                    autoComplete="email"
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Hum aapke email address par aik mehfooz password reset link bhejenge.
                  </span>
                </div>

                <button
                  type="submit"
                  id="forgot-email-submit"
                  className="btn-primary auth-submit"
                  disabled={emailLoading}
                  style={{ width: "100%", marginTop: "16px" }}
                >
                  {emailLoading ? <span>Link bhej rahe hain...</span> : <><span>Send Reset Link</span><ArrowRight size={17} /></>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: 6-Digit Reception Code */}
        {activeTab === "reception" && (
          <div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "16px",
                fontSize: "0.8rem",
                color: "var(--text-muted)",
              }}
            >
              Agar aapka email registered nahi hai, toh reception counter se 6-digit verification code haasil karein aur neeche darj karein.
            </div>

            {codeError && (
              <div className="alert-error" role="alert" style={{ marginBottom: "16px" }}>
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <span>{codeError}</span>
              </div>
            )}

            {codeSuccess && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-accent)",
                  color: "var(--accent-primary)",
                  marginBottom: "16px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle2 size={18} />
                <span>{codeSuccess}</span>
              </div>
            )}

            {!codeSuccess && (
              <form onSubmit={handleCodeSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reception-identifier">
                    Phone Number ya Member ID
                  </label>
                  <input
                    id="reception-identifier"
                    type="text"
                    className="form-input"
                    placeholder="03001234567 ya MEM-2026-0001"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={codeLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reception-code">
                    Reception 6-Digit Code
                  </label>
                  <input
                    id="reception-code"
                    type="text"
                    maxLength={6}
                    className="form-input"
                    placeholder="e.g. 748291"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                    disabled={codeLoading}
                    style={{ fontFamily: "monospace", letterSpacing: "4px", fontSize: "1.1rem", textAlign: "center" }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reception-new-password">
                    Naya Password
                  </label>
                  <input
                    id="reception-new-password"
                    type="password"
                    className="form-input"
                    placeholder="Kam az kam 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={codeLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reception-confirm-password">
                    Password Ki Tasdeeq Karein
                  </label>
                  <input
                    id="reception-confirm-password"
                    type="password"
                    className="form-input"
                    placeholder="Dobara password enter karein"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={codeLoading}
                    required
                  />
                </div>

                <button
                  type="submit"
                  id="reception-code-submit"
                  className="btn-primary auth-submit"
                  disabled={codeLoading}
                  style={{ width: "100%", marginTop: "16px" }}
                >
                  {codeLoading ? <span>Password update ho raha hai...</span> : <><span>Reset Password</span><ArrowRight size={17} /></>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Back to Login */}
        <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Sign in</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
