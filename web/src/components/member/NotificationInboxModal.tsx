"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  Bell,
  CheckCheck,
  CreditCard,
  UserCheck,
  Dumbbell,
  Megaphone,
  Info,
  Sliders,
  ExternalLink,
} from "lucide-react";
import NotificationPreferencesModal from "./NotificationPreferencesModal";

interface NotificationInboxModalProps {
  inline?: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

function InboxFrame({ inline, children }: { inline: boolean; children: React.ReactNode }) {
  return inline ? <>{children}</> : <ModalOverlay className="modal-overlay">{children}</ModalOverlay>;
}

export default function NotificationInboxModal({
  onClose,
  onNavigateTab,
  inline = false,
}: NotificationInboxModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeCategory, readCacheVersion]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const url =
        activeCategory === "ALL"
          ? "/api/v1/member/notifications"
          : `/api/v1/member/notifications?category=${activeCategory}`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, actionUrl?: string) => {
    try {
      await apiFetch(`/api/v1/member/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (actionUrl) {
        if (actionUrl.includes("diet") && onNavigateTab) {
          onNavigateTab("diet");
          onClose();
        } else if (actionUrl.includes("progress") && onNavigateTab) {
          onNavigateTab("progress");
          onClose();
        } else if (actionUrl.includes("workout") && onNavigateTab) {
          onNavigateTab("overview");
          onClose();
        } else {
          const destination = new URL(actionUrl, window.location.origin);
          if (destination.origin === window.location.origin && ["/dashboard", "/membership", "/payments", "/workout", "/diet", "/progress", "/profile", "/notifications", "/attendance"].some(path => destination.pathname === path || destination.pathname.startsWith(path + "/"))) window.location.assign(destination.pathname + destination.search + destination.hash);
        }
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await apiFetch("/api/v1/member/notifications/read-all", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "PAYMENT":
        return {
          icon: <CreditCard size={14} />,
          color: "#10b981",
          bg: "rgba(16, 185, 129, 0.12)",
          label: "Payment",
        };
      case "MEMBERSHIP":
        return {
          icon: <UserCheck size={14} />,
          color: "#a855f7",
          bg: "rgba(168, 85, 247, 0.12)",
          label: "Membership",
        };
      case "TRAINING":
        return {
          icon: <Dumbbell size={14} />,
          color: "#06b6d4",
          bg: "rgba(6, 182, 212, 0.12)",
          label: "Training",
        };
      case "ANNOUNCEMENT":
        return {
          icon: <Megaphone size={14} />,
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.12)",
          label: "Announcement",
        };
      default:
        return {
          icon: <Info size={14} />,
          color: "#94a3b8",
          bg: "rgba(148, 163, 184, 0.12)",
          label: "General",
        };
    }
  };

  if (showPreferences) {
    return <NotificationPreferencesModal onClose={() => setShowPreferences(false)} />;
  }

  return (
    <InboxFrame inline={inline}>
      <div
        className={inline ? "glass-panel" : "modal-content glass-panel"}
        style={{
          maxWidth: inline ? "100%" : "680px",
          width: "100%",
          maxHeight: inline ? "none" : "85vh",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                position: "relative",
                background: "rgba(249, 115, 22, 0.15)",
                padding: "8px",
                borderRadius: "8px",
                color: "var(--accent-primary)",
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Notification Inbox</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
                {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {unreadCount > 0 && (
              <button
                className="btn btn-secondary"
                onClick={markAllRead}
                style={{ fontSize: "0.8rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: "5px" }}
              >
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setShowPreferences(true)}
              style={{ padding: "7px" }}
              title="Channel Preferences"
            >
              <Sliders size={16} />
            </button>
            {!inline && <button className="btn btn-secondary" onClick={onClose} aria-label="Close updates" style={{ padding: "7px" }}>
              <X size={18} />
            </button>}
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "14px 0",
            overflowX: "auto",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {[
            { id: "ALL", label: "All" },
            { id: "PAYMENT", label: "Payments" },
            { id: "MEMBERSHIP", label: "Membership" },
            { id: "TRAINING", label: "Training" },
            { id: "ANNOUNCEMENT", label: "Announcements" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              style={{
                padding: "6px 14px",
                fontSize: "0.8rem",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                background:
                  activeCategory === tab.id ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.05)",
                color: activeCategory === tab.id ? "#ffffff" : "var(--text-dim)",
                transition: "all 0.2s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
              Loading updates...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)" }}>
              <Bell size={32} style={{ opacity: 0.3, marginBottom: "8px" }} />
              <p style={{ margin: 0, fontSize: "0.9rem" }}>Koi nayi notification nahi hai.</p>
            </div>
          ) : (
            notifications.map((item) => {
              const badge = getCategoryBadge(item.category);
              const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id, item.actionUrl)}
                  style={{
                    background: item.isRead
                      ? "rgba(255, 255, 255, 0.02)"
                      : "rgba(249, 115, 22, 0.05)",
                    border: item.isRead
                      ? "1px solid var(--border-subtle)"
                      : "1px solid rgba(249, 115, 22, 0.3)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-dim)" }}>{dateStr}</span>
                    </div>

                    {!item.isRead && (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--accent-primary)",
                          display: "inline-block",
                        }}
                      />
                    )}
                  </div>

                  <h4
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      margin: "0 0 4px 0",
                    }}
                  >
                    {item.title}
                  </h4>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-dim)",
                      margin: 0,
                      lineHeight: "1.4",
                    }}
                  >
                    {item.message}
                  </p>

                  {item.actionUrl && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "0.78rem",
                        color: "var(--accent-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                    >
                      <span>Tafseelat dekhein</span>
                      <ExternalLink size={12} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </InboxFrame>
  );
}
