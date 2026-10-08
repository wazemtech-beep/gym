"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useRef, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/layout/AuthShell";
import { validateRegistration } from "@/lib/registrationValidation";
import styles from "./RegistrationForm.module.css";

export default function MemberRegistrationForm() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState("");
  const submitting = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const validation = validateRegistration(Object.fromEntries(fields));
    if (!validation.success) { setError(validation.error); return; }
    const photo = fields.get("photo");
    if (photo instanceof File && photo.size && (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) { setError("Choose a JPG, PNG or WebP photo up to 2 MB."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/member-registration", { method: "POST", body: fields });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not submit your request.");
      form.reset(); setPreview(""); setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit your request."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <AuthShell wide={!submitted}><div className="auth-card">
    <h1>{submitted ? "Request submitted" : "Create account"}</h1>
    {submitted ? <div className={styles.success} role="status"><p>Your request is waiting for admin approval. Once approved, sign in with your email and the password you chose.</p><Link className="btn-primary" href="/login">Back to sign in</Link></div> : <>
      <p className={styles.notice}>Admin approval is required before you can sign in.</p>
      {error && <p className="alert-error" role="alert">{error}</p>}
      <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className={styles.section}><legend>Member details</legend>
          <div className={styles.photoRow}>
            {preview && <img src={preview} alt="Selected profile photo" className={styles.photo} />}
            <label className={styles.field} htmlFor="register-photo">Profile photo (optional)<input ref={photoInput} id="register-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
              const file = event.target.files?.[0]; setPreview("");
              if (!file) return;
              if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { event.target.value = ""; setError("Choose a JPG, PNG or WebP photo up to 2 MB."); return; }
              setError(""); const reader = new FileReader(); reader.onload = () => { if (photoInput.current?.files?.[0] === file) setPreview(String(reader.result)); }; reader.readAsDataURL(file);
            }} /></label>
            {preview && <button type="button" className="btn-secondary" onClick={() => { if (photoInput.current) photoInput.current.value = ""; setPreview(""); }}>Remove</button>}
          </div>
          <div className={styles.grid}>
            <label className={styles.field} htmlFor="register-name">Full name<input id="register-name" name="fullName" className="form-input" autoComplete="name" required minLength={2} maxLength={100} /></label>
            <label className={styles.field} htmlFor="register-phone">Mobile number<input id="register-phone" name="phone" className="form-input" type="tel" autoComplete="tel" placeholder="03001234567" required maxLength={25} /></label>
            <label className={styles.field} htmlFor="register-joining">Joining date<input id="register-joining" name="joiningDate" className="form-input" type="date" defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })} /></label>
            <label className={styles.field} htmlFor="register-dob">Date of birth (optional)<input id="register-dob" name="dateOfBirth" className="form-input" type="date" autoComplete="bday" max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })} /></label>
            <label className={`${styles.field} ${styles.full}`} htmlFor="register-address">Address<textarea id="register-address" name="address" className="form-input" autoComplete="street-address" rows={2} maxLength={500} /></label>
          </div>
        </fieldset>
        <fieldset disabled={busy} className={styles.section}><legend>Emergency &amp; fitness</legend><div className={styles.grid}>
          <label className={styles.field} htmlFor="register-emergency-name">Emergency contact name<input id="register-emergency-name" name="emergencyContactName" className="form-input" maxLength={100} /></label>
          <label className={styles.field} htmlFor="register-emergency-phone">Emergency contact mobile<input id="register-emergency-phone" name="emergencyContactPhone" className="form-input" type="tel" maxLength={25} /></label>
          <label className={styles.field} htmlFor="register-goal">Fitness goal<textarea id="register-goal" name="fitnessGoal" className="form-input" rows={2} defaultValue="General Fitness" maxLength={500} /></label>
          <label className={styles.field} htmlFor="register-limitations">Injuries or limitations<textarea id="register-limitations" name="limitations" className="form-input" rows={2} maxLength={1000} /></label>
        </div></fieldset>
        <fieldset disabled={busy} className={styles.section}><legend>Login details</legend><div className={styles.grid}>
          <label className={`${styles.field} ${styles.full}`} htmlFor="register-email">Email<input id="register-email" name="email" className="form-input" type="email" autoComplete="email" required maxLength={254} /></label>
          <label className={styles.field} htmlFor="register-password">Password<input id="register-password" name="password" className="form-input" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
          <label className={styles.field} htmlFor="register-confirm">Confirm password<input id="register-confirm" name="confirmPassword" className="form-input" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
        </div></fieldset>
        <button type="submit" disabled={busy} className="btn-primary auth-submit">{busy ? "Submitting…" : "Submit request"}</button>
      </form>
      <p className={styles.footer}>Already a member? <Link href="/login">Sign in</Link></p>
    </>}
  </div></AuthShell>;
}
