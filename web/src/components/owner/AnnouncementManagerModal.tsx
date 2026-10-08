"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./AnnouncementManager.module.css";
import {
  X,
  Megaphone,
  Calendar,
  Send,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Smartphone,
  Trash2,
  Edit2,
  Check,
  Eye,
} from "lucide-react";

interface AnnouncementManagerModalProps {
  onClose: () => void;
}

export default function AnnouncementManagerModal({
  onClose,
}: AnnouncementManagerModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [activeTab, setActiveTab] = useState<"create" | "list" | "reminders">("create");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Create Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [audience, setAudience] = useState("ALL_MEMBERS");
  const [priority, setPriority] = useState("NORMAL");
  const [channels, setChannels] = useState<string[]>(["IN_APP", "EMAIL"]);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Reminders config state
  const [reminderConfig, setReminderConfig] = useState({
    membershipExpiryDays: [7, 1],
    overdueGraceDays: 3,
    timezone: "Asia/Karachi",
  });
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [schedulerOutput, setSchedulerOutput] = useState<any>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    document.getElementById("announcement-dialog")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = Array.from(document.querySelectorAll<HTMLElement>("#announcement-dialog input:not(:disabled), #announcement-dialog textarea:not(:disabled), #announcement-dialog select:not(:disabled), #announcement-dialog button:not(:disabled), #announcement-dialog a[href]")).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === "announcement-dialog")) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown",keyboard);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown",keyboard); previousFocus?.focus(); };
    // The popup's lifecycle owns focus and scroll locking.
  }, []);

  useEffect(() => {
    if (activeTab === "list") {
      fetchAnnouncements();
    } else if (activeTab === "reminders") {
      fetchReminderSettings();
    }
  }, [activeTab, activeTab === "list" ? readCacheVersion : 0]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/announcements");
      const json = await res.json();
      if (json.success) {
        setAnnouncements(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReminderSettings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/owner/settings/reminders");
      const json = await res.json();
      if (json.success && json.data) {
        setReminderConfig({
          membershipExpiryDays: json.data.membershipExpiryDays || [7, 1],
          overdueGraceDays: json.data.overdueGraceDays || 3,
          timezone: json.data.timezone || "Asia/Karachi",
        });
      }
    } catch (err) {
      console.error("Failed to load reminder settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (asDraft: boolean = false) => {
    if (!title.trim() || !content.trim()) {
      setMessage({ text: "Title aur message lazmi hain.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const payload = {
        title,
        content,
        category,
        audience,
        priority,
        channels,
        publishAt: publishMode === "schedule" && scheduledDate ? scheduledDate : new Date().toISOString(),
        expiresAt: expiryDate ? expiryDate : null,
        attachmentUrl: attachmentUrl.trim() || null,
        pinned,
        isDraft: asDraft,
      };

      const res = await apiFetch("/api/v1/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setMessage({
          text: asDraft ? "Announcement draft save ho gayi." : "Announcement broadcast ho gayi!",
          type: "success",
        });
        setTitle("");
        setContent("");
        setAttachmentUrl("");
        setTimeout(() => setActiveTab("list"), 1500);
      } else {
        setMessage({ text: json.error || "Broadcast mein masla aya.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Server se rabta nahi ho saka.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Kya aap waqai is announcement ko delete karna chahte hain?")) return;
    try {
      const res = await apiFetch(`/api/v1/owner/announcements/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleRunScheduler = async () => {
    try {
      setRunningScheduler(true);
      setSchedulerOutput(null);
      const res = await apiFetch("/api/v1/scheduler/reminders", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSchedulerOutput(json.data);
      }
    } catch (err) {
      console.error("Scheduler run error:", err);
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/owner/settings/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminderConfig),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: "Reminder rules update ho gayi hain.", type: "success" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={styles.overlay}>
      <div
        className={`${styles.dialog} glass-panel`}
        id="announcement-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-title" tabIndex={-1}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(249, 115, 22, 0.15)",
                padding: "8px",
                borderRadius: "8px",
                color: "var(--accent-primary)",
              }}
            >
              <Megaphone size={22} />
            </div>
            <div>
              <h3 id="announcement-title" style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Announcements</h3>
            </div>
          </div>
          <button type="button" aria-label="Close announcements" className="btn btn-secondary" onClick={onClose} style={{ padding: "6px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab("create")}
            className={activeTab === "create" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
          >
            Create Notice
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={activeTab === "list" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={activeTab === "reminders" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
          >
            Reminders
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {message && (
            <div
              style={{
                background:
                  message.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: message.type === "success" ? "#34d399" : "#f87171",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {message.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          {/* TAB 1: CREATE ANNOUNCEMENT */}
          {activeTab === "create" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.82rem" }}>
                  Title / Subject *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Friday Gym Timings, Eid Holiday Notice, Maintenance..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.82rem" }}>
                  Announcement Message *
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Tamam members ko aagah kiya jata hai..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Category
                  </label>
                  <select
                    className="input-field"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="GENERAL">General Notice</option>
                    <option value="HOLIDAY">Holiday / Timings</option>
                    <option value="PROMO">Promotion / Special Offer</option>
                    <option value="MAINTENANCE">Equipment / Facility</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Target Audience *
                  </label>
                  <select
                    className="input-field"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    <option value="ALL_MEMBERS">All Members</option>
                    <option value="ACTIVE_MEMBERS">Active Members Only</option>
                    <option value="STAFF">Gym Staff (Trainers & Reception)</option>
                  </select>
                </div>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Priority
                  </label>
                  <select
                    className="input-field"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="IMPORTANT">Important (High Priority Badge)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Channels
                  </label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.82rem" }}>
                      <input
                        type="checkbox"
                        checked={channels.includes("IN_APP")}
                        onChange={(e) => {
                          if (e.target.checked) setChannels([...channels, "IN_APP"]);
                          else setChannels(channels.filter((c) => c !== "IN_APP"));
                        }}
                      />
                      In-App
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.82rem" }}>
                      <input
                        type="checkbox"
                        checked={channels.includes("EMAIL")}
                        onChange={(e) => {
                          if (e.target.checked) setChannels([...channels, "EMAIL"]);
                          else setChannels(channels.filter((c) => c !== "EMAIL"));
                        }}
                      />
                      Email
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.82rem" }}>
                      <input
                        type="checkbox"
                        checked={channels.includes("PUSH")}
                        onChange={(e) => {
                          if (e.target.checked) setChannels([...channels, "PUSH"]);
                          else setChannels(channels.filter((c) => c !== "PUSH"));
                        }}
                      />
                      Mobile Push
                    </label>
                  </div>
                </div>
              </div>

              {/* Pin & Expiry */}
              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: "0.82rem" }}>
                    Attachment / Poster URL
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://... poster image link"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <label htmlFor="pinNotice" style={{ fontSize: "0.82rem", cursor: "pointer" }}>
                  Pin this notice to top of dashboard
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => handleCreateAnnouncement(true)}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={() => handleCreateAnnouncement(false)}
                >
                  <Send size={15} /> {submitting ? "Broadcasting..." : "Publish & Broadcast Now"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: NOTICE HISTORY & ANALYTICS */}
          {activeTab === "list" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
                  Loading notices...
                </div>
              ) : announcements.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
                  Koi notice nahi mila.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {announcements.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span
                              style={{
                                background: item.priority === "IMPORTANT" ? "rgba(239, 68, 68, 0.15)" : "rgba(249, 115, 22, 0.15)",
                                color: item.priority === "IMPORTANT" ? "#f87171" : "var(--accent-primary)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                              }}
                            >
                              {item.category}
                            </span>
                            {item.pinned && (
                              <span style={{ fontSize: "0.72rem", color: "var(--amber-primary)", fontWeight: 600 }}>
                                📌 Pinned
                              </span>
                            )}
                            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                              Audience: {item.audience}
                            </span>
                          </div>
                          <h4 style={{ margin: "4px 0", fontSize: "1rem" }}>{item.title}</h4>
                          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-dim)" }}>{item.content}</p>
                        </div>

                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDelete(item.id)}
                          style={{ padding: "6px", color: "#f87171" }}
                          title="Delete Notice"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Delivery Analytics row */}
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "10px",
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          gap: "16px",
                          fontSize: "0.78rem",
                          color: "var(--text-dim)",
                        }}
                      >
                        <div>
                          <strong>Recipients:</strong> {item.recipientCount || 0}
                        </div>
                        <div>
                          <strong>Email Sent:</strong> {item.emailSentCount || 0}
                        </div>
                        <div>
                          <strong>Push Sent:</strong> {item.pushSentCount || 0}
                        </div>
                        <div>
                          <strong>Published:</strong> {new Date(item.publishAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FEE & EXPIRY REMINDER CONFIG */}
          {activeTab === "reminders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>Automated Reminder Rules</h4>
                <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.82rem" }}>
                      Membership Expiry Alerts
                    </label>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginTop: "4px" }}>
                      7 din aur 1 din pehle automatic notice
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: "0.82rem" }}>
                      Overdue Grace Days
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={reminderConfig.overdueGraceDays}
                      onChange={(e) =>
                        setReminderConfig({ ...reminderConfig, overdueGraceDays: parseInt(e.target.value, 10) || 3 })
                      }
                    />
                  </div>
                </div>

                <div style={{ marginTop: "14px" }}>
                  <button className="btn btn-secondary" onClick={handleSaveReminderSettings}>
                    Save Reminder Rules
                  </button>
                </div>
              </div>

              {/* Manual Scheduler Scan Trigger */}
              <div
                style={{
                  background: "rgba(249, 115, 22, 0.05)",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", color: "var(--text-main)" }}>
                      Run Reminder Scan Now
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      Asia/Karachi dates ke mutabiq expiring memberships aur pending installments check karein.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleRunScheduler}
                    disabled={runningScheduler}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <RefreshCw className={runningScheduler ? "animate-spin" : ""} size={16} />
                    {runningScheduler ? "Scanning..." : "Execute Scan"}
                  </button>
                </div>

                {schedulerOutput && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      background: "rgba(0, 0, 0, 0.3)",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    <div>✅ Expiring Memberships Processed: {schedulerOutput.expiringProcessed}</div>
                    <div>✅ Installment Reminders Processed: {schedulerOutput.installmentsProcessed}</div>
                    <div>
                      🛡️ Paid / Obsolete Reminders Skipped: {schedulerOutput.skippedPaidOrObsolete}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>, document.body
  );
}
