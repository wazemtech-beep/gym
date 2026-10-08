"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Phone,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  Sparkles,
  Archive,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import AddMemberModal from "./AddMemberModal";

interface MemberItem {
  id: string;
  memberId: string;
  fullName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  joiningDate: string;
  status: "CURRENT" | "ARCHIVED";
  archivedAt?: string | null;
  archiveReason?: string | null;
  fitnessGoal?: string | null;
  assignedTrainer: string | null;
  currentMembership: {
    planName: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
  appAccessStatus: "NOT_ACTIVATED" | "ACTIVE" | "SUSPENDED";
  totalDues: number;
  isOverdue: boolean;
}

export default function MembersDirectoryClient() {
  const readCacheVersion = useReadCacheVersion();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"CURRENT" | "ARCHIVED" | "ALL">("CURRENT");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: "15",
      });
      if (search.trim()) {
        params.append("search", search.trim());
      }

      const res = await apiFetch(`/api/v1/members?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Members load nahi ho sake. Dobara try karein.");

      if (data.success) {
        setMembers(data.members);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Members load nahi ho sake. Dobara try karein.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchMembers, readCacheVersion]);

  useEffect(() => {
    const refresh = () => { void fetchMembers(); };
    window.addEventListener("gym:members-changed", refresh);
    return () => window.removeEventListener("gym:members-changed", refresh);
  }, [fetchMembers, readCacheVersion]);

  // Initial stats calculation
  const totalDuesSum = members.reduce((sum, m) => sum + m.totalDues, 0);
  const overdueMembersCount = members.filter((m) => m.isOverdue && m.totalDues > 0).length;

  return (
    <div>
      {/* Top Header & Quick Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                border: "1px solid var(--border-accent)",
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-main)", margin: 0, letterSpacing: "-0.5px" }}>
                Members
              </h1>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => fetchMembers()}
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px" }}
            title="Refresh list"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            id="btn-add-member"
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              fontWeight: 700,
              fontSize: "0.925rem",
            }}
          >
            <UserPlus size={18} />
            Add Member
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {loadError && <div className="alert-error" role="alert"><AlertCircle size={18} />{loadError}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              Total Records
            </span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-main)" }}>
            {totalCount}
          </div>
          
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              
              Current members
            </span>
            <CheckCircle size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent-primary)" }}>
            {members.filter((m) => m.status === "CURRENT").length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            
            On this page
          </div>
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              Members With Dues
            </span>
            <DollarSign size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--amber-primary)" }}>
            {members.filter((m) => m.totalDues > 0).length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Kul Baqi Dues: Rs. {totalDuesSum.toLocaleString()}
          </div>
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              Overdue Accounts
            </span>
            <AlertCircle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--danger)" }}>
            {overdueMembersCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Due date guzar chuki hai
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="glass-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "min(100%, 280px)" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
            }}
          />
          <input
            id="input-member-search"
            type="text"
            placeholder="Search name, phone or member ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field"
            style={{
              width: "100%",
              paddingLeft: "42px",
              background: "var(--bg-secondary)",
              fontSize: "0.9rem",
            }}
          />
        </div>

        {/* Status Filter Tabs (Point 9 & 1) */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-secondary)",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={() => {
              setStatusFilter("CURRENT");
              setPage(1);
            }}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "CURRENT" ? "var(--accent-primary)" : "transparent",
              color: statusFilter === "CURRENT" ? "var(--text-inverse)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Current Active
          </button>
          <button
            onClick={() => {
              setStatusFilter("ARCHIVED");
              setPage(1);
            }}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "ARCHIVED" ? "var(--amber-soft)" : "transparent",
              color: statusFilter === "ARCHIVED" ? "var(--amber-primary)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Archived Members
          </button>
          <button
            onClick={() => {
              setStatusFilter("ALL");
              setPage(1);
            }}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "ALL" ? "var(--bg-secondary)" : "transparent",
              color: statusFilter === "ALL" ? "var(--text-main)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            All Records
          </button>
        </div>
      </div>

      {/* Members Table (Point 1: Columns strictly followed) */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                  fontSize: "0.785rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                <th style={{ padding: "14px 18px" }}>Member ID</th>
                <th style={{ padding: "14px 18px" }}>Name + Photo</th>
                <th style={{ padding: "14px 18px" }}>Phone</th>
                <th style={{ padding: "14px 18px" }}>Membership</th>
                <th style={{ padding: "14px 18px" }}>Outstanding Dues</th>
                <th style={{ padding: "14px 18px" }}>Assigned Trainer</th>
                <th style={{ padding: "14px 18px" }}>App Access</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                      <RefreshCw size={20} className="spin-slow" />
                      Loading members database...
                    </div>
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "54px 20px", textAlign: "center" }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        background: "var(--bg-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 14px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Users size={28} />
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px" }}>
                      Koi Member Nahi Mila
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0 0 16px" }}>
                      {search ? "Diye gaye search criteria ke mutabiq koi record nahi mila." : "Gym roster mein abhi koi member mojood nahi hai."}
                    </p>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 18px" }}
                    >
                      <UserPlus size={16} />
                      Naya Member Add Karein
                    </button>
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const initials = member.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Column 1: Member ID */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.825rem",
                            fontWeight: 700,
                            color: "var(--accent-primary)",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "var(--accent-soft)",
                            border: "1px solid var(--border-accent)",
                            display: "inline-block",
                          }}
                        >
                          {member.memberId}
                        </span>
                        {member.status === "ARCHIVED" && (
                          <span
                            style={{
                              marginLeft: "6px",
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "var(--danger-soft)",
                              color: "var(--danger)",
                              fontWeight: 600,
                            }}
                          >
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Column 2: Name + Photo */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.fullName}
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "10px",
                                objectFit: "cover",
                                border: "1px solid var(--border-subtle)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "10px",
                                background: "var(--accent-soft)",
                                border: "1px solid var(--border-accent)",
                                color: "var(--accent-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              {initials}
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/admin/members/${member.id}`}
                              style={{
                                fontWeight: 700,
                                color: "var(--text-main)",
                                textDecoration: "none",
                                fontSize: "0.925rem",
                                display: "block",
                              }}
                            >
                              {member.fullName}
                            </Link>
                            {member.email && (
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                {member.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Phone */}
                      <td style={{ padding: "16px 18px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                          {member.phone}
                        </span>
                      </td>

                      {/* Column 4: Membership (Current Plan & Status) */}
                      <td style={{ padding: "16px 18px" }}>
                        {member.currentMembership ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-main)" }}>
                              {member.currentMembership.planName}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: 700,
                                  background:
                                    member.currentMembership.status === "ACTIVE"
                                      ? "var(--accent-soft)"
                                      : member.currentMembership.status === "FROZEN"
                                      ? "var(--blue-soft)"
                                      : "var(--danger-soft)",
                                  color:
                                    member.currentMembership.status === "ACTIVE"
                                      ? "var(--accent-primary)"
                                      : member.currentMembership.status === "FROZEN"
                                      ? "var(--blue-primary)"
                                      : "var(--danger)",
                                }}
                              >
                                {member.currentMembership.status}
                              </span>
                              <span style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                                Till {new Date(member.currentMembership.endDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.775rem",
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                            }}
                          >
                            No plan assigned
                          </span>
                        )}
                      </td>

                      {/* Column 5: Outstanding Dues */}
                      <td style={{ padding: "16px 18px" }}>
                        {member.totalDues > 0 ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: member.isOverdue ? "var(--danger-soft)" : "var(--amber-soft)",
                              border: member.isOverdue
                                ? "1px solid var(--danger-border)"
                                : "1px solid var(--amber-border)",
                              color: member.isOverdue ? "var(--danger)" : "var(--amber-primary)",
                              fontWeight: 700,
                              fontSize: "0.825rem",
                            }}
                          >
                            <DollarSign size={13} />
                            Rs. {member.totalDues.toLocaleString()}
                          </div>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: "var(--accent-soft)",
                              color: "var(--accent-primary)",
                              fontSize: "0.775rem",
                              fontWeight: 600,
                            }}
                          >
                            <CheckCircle size={12} /> Clear
                          </span>
                        )}
                      </td>

                      {/* Column 6: Assigned Trainer */}
                      <td style={{ padding: "16px 18px" }}>
                        {member.assignedTrainer ? (
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                            {member.assignedTrainer}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.775rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Column 7: App Access */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontWeight: 700,
                            background:
                              member.appAccessStatus === "ACTIVE"
                                ? "var(--accent-soft)"
                                : member.appAccessStatus === "SUSPENDED"
                                ? "var(--danger-soft)"
                                : "var(--bg-secondary)",
                            color:
                              member.appAccessStatus === "ACTIVE"
                                ? "var(--accent-primary)"
                                : member.appAccessStatus === "SUSPENDED"
                                ? "var(--danger)"
                                : "var(--text-secondary)",
                          }}
                        >
                          {member.appAccessStatus === "ACTIVE"
                            ? "Active"
                            : member.appAccessStatus === "SUSPENDED"
                            ? "Suspended"
                            : "Not Activated"}
                        </span>
                      </td>

                      {/* Column 8: Action */}
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="btn-secondary"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            textDecoration: "none",
                          }}
                        >
                          <Eye size={14} />
                          Profile
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
          }}
        >
          <div>
            Showing <strong>{members.length}</strong> of <strong>{totalCount}</strong> members
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn-secondary"
              style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span style={{ padding: "0 8px", fontWeight: 600, color: "var(--text-main)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchMembers();
        }}
      />
    </div>
  );
}
