"use client";
import { apiFetch } from "@/lib/apiFetch";

import AuthShell from "@/components/layout/AuthShell";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    let alive = true;
    apiFetch("/api/auth/me").then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load your account.");
      if (alive) setMustChangePassword(Boolean(data.user.mustChangePassword));
    }).catch(cause => { if (alive) setError(cause.message); });
    return () => { alive = false; };
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current || success || mustChangePassword === null) return;
    if (!mustChangePassword && !currentPassword) { setError("Maujooda password enter karein."); return; }
    if (!newPassword || !confirmPassword) {
      setError("Dono fields enter karna lazmi hain.");
      return;
    }

    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setError("Password kam az kam 8 characters ka hona chahiye.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Naya password aur confirm password aapas mein match nahi karte.");
      return;
    }

    setLoading(true);
    submitting.current = true;
    setError(null);

    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, currentPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Password tabdeel karne mein masla aaya.");
        setLoading(false); submitting.current = false;
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(data.redirectUrl || "/login");
      }, 2000);
    } catch {
      setError("Server se rabta nahi ho saka.");
      setLoading(false);
    } finally { submitting.current = false; setLoading(false); }
  };

  return (
    <AuthShell>
      <div
        className="glass-panel auth-card"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "40px",
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--amber-soft)",
              border: "1px solid var(--amber-border)",
              color: "var(--amber-primary)",
              marginBottom: "16px",
            }}
          >
            <KeyRound size={28} />
          </div>

          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
            
            {mustChangePassword ? "Set password" : "Change password"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
            
            {mustChangePassword ? "Set a password to continue." : "Enter your current password and choose a new one."}
          </p>
        </div>

        {error && (
          <div className="alert-error" id="change-password-error">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-success" id="change-password-success">
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>Password tabdeel ho gaya! Login par bhej rahe hain...</span>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            {mustChangePassword !== true && <div className="form-group"><label className="form-label" htmlFor="current-password">Current password</label><input id="current-password" className="form-input" type="password" autoComplete="current-password" required disabled={loading || mustChangePassword === null} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div>}
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                Naya Password (min 8 chars)
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                  }}
                />
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: "42px" }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-new-password">
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                  }}
                />
                <input
                  id="confirm-new-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: "42px" }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              id="change-password-submit"
              className="btn-primary"
              style={{ width: "100%", marginTop: "10px", padding: "14px" }}
              disabled={loading || mustChangePassword === null}
            >
              {loading ? "Update ho raha hai..." : "Password Update Karein"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
