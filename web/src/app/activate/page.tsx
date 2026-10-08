"use client";
import { apiFetch } from "@/lib/apiFetch";

import AuthShell from "@/components/layout/AuthShell";
import Link from "next/link";
import styles from "./ActivateForm.module.css";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, ArrowRight, Lock, KeyRound, Check } from "lucide-react";

function ActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [activationCode, setActivationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getPasswordStrength();
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token && !activationCode) {
      setError("Activation link ka token ya reception code darj karein.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password kam az kam 8 characters ka hona chahiye.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Dono passwords aapas mein match nahi karte.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || undefined,
          activationCode: activationCode || undefined,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Activation ghalat ya expire ho chuka hai.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (data.redirectUrl) {
          router.push(data.redirectUrl);
        } else {
          router.push("/login");
        }
      }, 1500);
    } catch {
      setError("Server se rabta nahi ho saka.");
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className={`auth-card ${styles.card}`}>
        <div className={styles.intro}><h1>Activate account</h1></div>
        {error && <div className={`alert-error ${styles.alert}`} id="activate-error-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
        {success && <div className={`alert-success ${styles.alert}`} id="activate-success-alert" role="status"><CheckCircle size={18} /><span>Account active ho gaya! Portal par redirect kiya ja raha hai...</span></div>}
        {!success && <form className={styles.form} onSubmit={handleSubmit} aria-busy={loading}>
          {!token && <div className={styles.field}>
            <label className={styles.label} htmlFor="activate-code"><KeyRound size={15} aria-hidden="true" />Activation code</label>
            <input id="activate-code" type="text" className={`form-input ${styles.input} ${styles.code}`} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={activationCode} onChange={event => setActivationCode(event.target.value.trim())} disabled={loading} required aria-describedby={error ? "activate-error-alert" : undefined} />
          </div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="activate-password"><Lock size={15} aria-hidden="true" />New password</label>
            <input id="activate-password" type="password" className={`form-input ${styles.input}`} placeholder="Enter new password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={loading} required aria-describedby={`activate-password-hint${error ? " activate-error-alert" : ""}`} />
            <p id="activate-password-hint" className={styles.hint}>At least 8 characters.</p>
            {password && <div className={styles.strength}>
              <div className={styles.bars} aria-hidden="true">{[1,2,3,4].map(level => <span key={level} className={styles.bar} style={{ background: strength >= level ? strengthColors[strength - 1] : undefined }} />)}</div>
              <span className={styles.strengthLabel}>Password strength: {strength > 0 ? strengthLabels[strength - 1] : "Too short"}</span>
            </div>}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="activate-confirm-password"><Check size={15} aria-hidden="true" />Confirm password</label>
            <input id="activate-confirm-password" type="password" className={`form-input ${styles.input}`} placeholder="Re-enter password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={loading} required aria-describedby={error ? "activate-error-alert" : undefined} />
          </div>
          <button type="submit" id="activate-submit-button" className={`btn-primary ${styles.submit}`} disabled={loading}>{loading ? "Activating…" : <><span>Activate account</span><ArrowRight size={18} aria-hidden="true" /></>}</button>
        </form>}
        <div className={styles.footer}><Link href="/login">Back to sign in</Link></div>
      </div>
    </AuthShell>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "50px", color: "var(--text-dim)" }}>Loading...</div>}>
      <ActivateContent />
    </Suspense>
  );
}

