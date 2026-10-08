"use client";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import AuthShell from "@/components/layout/AuthShell";

export default function LoginForm({ portal }: { portal: "member" | "admin" }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Email ya Member ID aur password enter karein.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, portal }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login details incorrect hain.");
        setLoading(false);
        return;
      }

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        router.push(portal === "admin" ? "/admin" : "/dashboard");
      }
    } catch {
      setError("Server se rabta nahi ho saka. Dobara koshish karein.");
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="auth-intro"><h1>{portal === "admin" ? "Staff sign in" : "Member sign in"}</h1></div>
        {error && <div className="alert-error" id="login-error-alert" role="alert"><AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{error}</span></div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label" htmlFor="login-identifier">Email or Member ID</label><input id="login-identifier" type="text" className="form-input" placeholder="Email or Member ID" value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={loading} autoComplete="username" required /></div>
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
              <Link href="/forgot-password" style={{ fontSize: "0.82rem", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: "relative" }}><input id="login-password" type={showPassword ? "text" : "password"} className="form-input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 46 }} disabled={loading} autoComplete="current-password" required /><button type="button" id="login-toggle-password" onClick={() => setShowPassword(!showPassword)} className="password-toggle" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          </div>
          <button type="submit" id="login-submit-button" className="btn-primary auth-submit" disabled={loading}>{loading ? <span>Tasdeeq ho rahi hai...</span> : <><span>Sign in</span><ArrowRight size={17} /></>}</button>
        </form>
      </div>
    </AuthShell>
  );
}
