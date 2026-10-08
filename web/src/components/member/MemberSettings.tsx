"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, Mail, LogOut, MonitorSmartphone } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import AccountEmailChange from "@/components/common/AccountEmailChange";
import styles from "./MemberSettings.module.css";

export default function MemberSettings({ email }: { email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"current" | "all" | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function logout(allDevices: boolean) {
    if (submitting.current) return;
    submitting.current = true; setBusy(allDevices ? "all" : "current"); setError("");
    try {
      const response = await apiFetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allDevices }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not sign out. Please try again.");
      router.replace("/login"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign out."); }
    finally { submitting.current = false; setBusy(null); }
  }
  return <div className={styles.sections}>
    <section className={styles.panel}><h2>Account security</h2>
      <div className={styles.row}><span className={styles.icon}><Mail size={20} /></span><div className={styles.description}><h3>Login email</h3><p>{email || "No login email set"}</p></div><AccountEmailChange /></div>
      <div className={styles.row}><span className={styles.icon}><LockKeyhole size={20} /></span><div className={styles.description}><h3>Password</h3><p>Update the password you use to sign in.</p></div><Link className="btn-secondary" href="/auth/change-password">Change password</Link></div>
    </section>
    <section className={styles.panel}><h2>Sessions</h2>{error && <p className="alert-error" role="alert">{error}</p>}
      <div className={styles.row}><span className={styles.icon}><LogOut size={20} /></span><div className={styles.description}><h3>Sign out</h3><p>Sign out from this browser.</p></div><button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void logout(false)}>{busy === "current" ? "Signing out…" : "Logout"}</button></div>
      <div className={styles.row}><span className={styles.icon}><MonitorSmartphone size={20} /></span><div className={styles.description}><h3>Sign out everywhere</h3><p>End your sessions on all devices, including this one.</p></div><button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void logout(true)}>{busy === "all" ? "Signing out…" : "Logout all devices"}</button></div>
    </section>
  </div>;
}
