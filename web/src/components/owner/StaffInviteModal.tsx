"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Copy, Check, AlertCircle } from "lucide-react";

export default function StaffInviteModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("RECEPTIONIST");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, role }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Staff invite karne mein masla aaya.");
        setLoading(false);
        return;
      }

      setActivationLink(data.activationLink);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Server se rabta nahi ho saka.");
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (activationLink) {
      navigator.clipboard.writeText(activationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setName("");
    setEmail("");
    setPhone("");
    setRole("RECEPTIONIST");
    setActivationLink(null);
    setError(null);
    router.refresh();
  };

  return (
    <>
      <button
        id="open-invite-staff-modal"
        onClick={() => setIsOpen(true)}
        className="btn-primary"
        style={{ fontSize: "0.85rem", padding: "10px 18px" }}
      >
        <UserPlus size={16} />
        <span>Invite staff</span>
      </button>

      {isOpen && (
        <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            backdropFilter: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "32px",
              position: "relative",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: "1.3rem", marginBottom: "6px" }}>
              Invite staff
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
              
              The activation link is single-use.
            </p>

            {error && (
              <div className="alert-error">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {activationLink ? (
              <div>
                <div className="alert-success" style={{ marginBottom: "16px" }}>
                  <span>Staff account pending activation hai!</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                  
                  Share this link with the staff member:
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    background: "var(--bg-secondary)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "20px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={activationLink}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-main)",
                      fontSize: "0.82rem",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleCopy}
                    className="btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "0.78rem", flexShrink: 0 }}
                  >
                    {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <button
                  onClick={handleClose}
                  className="btn-primary"
                  style={{ width: "100%", padding: "12px" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="staff-name">
                    Staff Ka Naam
                  </label>
                  <input
                    id="staff-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ali Raza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-email">
                    Staff Email
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    className="form-input"
                    placeholder="ali@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-phone">
                    Phone (Optional)
                  </label>
                  <input
                    id="staff-phone"
                    type="text"
                    className="form-input"
                    placeholder="03001234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="staff-role">
                    Role Muntakhab Karein
                  </label>
                  <select
                    id="staff-role"
                    className="form-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ cursor: "pointer" }}
                  >
                    <option value="RECEPTIONIST">Receptionist (Members & Payments)</option>
                    <option value="TRAINER">Trainer (Workouts & Diets)</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-secondary"
                    style={{ flex: 1, padding: "12px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="submit-staff-invite"
                    className="btn-primary"
                    style={{ flex: 1, padding: "12px" }}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : "Invite Link Generate"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
