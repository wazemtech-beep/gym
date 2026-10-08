"use client";
import { apiFetch } from "@/lib/apiFetch";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Reset token darj karein ya email mein diye gaye link par dobara click karein.");
      return;
    }

    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setError("Password kam az kam 8 characters ka hona chahiye.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Dono passwords match nahi kar rahe.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Password reset nahi ho saka. Barah-e-karam dobara koshish karein.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError("Server se rabta nahi ho saka. Dobara koshish karein.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: "460px" }}>
      <div className="auth-intro">
        <h1>Set New Password</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "4px" }}>
          Apne account ke liye aik naya aur mazboot password muntakhab karein.
        </p>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: "18px" }}>
          <AlertCircle size={17} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div
          style={{
            padding: "20px",
            borderRadius: "10px",
            background: "var(--accent-soft)",
            border: "1px solid var(--border-accent)",
            color: "var(--accent-primary)",
            textAlign: "center",
          }}
        >
          <CheckCircle2 size={36} style={{ margin: "0 auto 12px", color: "var(--accent-primary)" }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>Password Updated!</h3>
          <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-main)" }}>
            Aapka password kamiyabi se update ho gaya hai. Sign-in page par redirect kiya ja raha hai...
          </p>
          <div style={{ marginTop: "16px" }}>
            <Link
              href="/login"
              className="btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.82rem",
                padding: "8px 16px",
                textDecoration: "none",
              }}
            >
              <span>Go to Sign in</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {!tokenFromUrl && (
            <div className="form-group">
              <label className="form-label" htmlFor="reset-token-input">
                Reset Token
              </label>
              <input
                id="reset-token-input"
                type="text"
                className="form-input"
                placeholder="Token paste karein"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              Naya Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Kam az kam 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: 46 }}
                disabled={loading}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">
              Password Ki Tasdeeq Karein
            </label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              placeholder="Dobara password enter karein"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            id="reset-password-submit"
            className="btn-primary auth-submit"
            disabled={loading}
            style={{ width: "100%", marginTop: "16px" }}
          >
            {loading ? <span>Password save ho raha hai...</span> : <><span>Update Password</span><ArrowRight size={17} /></>}
          </button>
        </form>
      )}

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
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="auth-card" style={{ textAlign: "center", padding: "40px" }}>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
