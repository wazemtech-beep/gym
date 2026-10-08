"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  Sparkles,
  RefreshCw,
  Users,
  Shield,
  Layers,
  Power,
  Info,
} from "lucide-react";
import AddEditFeePlanModal from "./AddEditFeePlanModal";
import { Role } from "@prisma/client";

interface FeePlanItem {
  id: string;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: "DAYS" | "CALENDAR_MONTHS" | "YEARS";
  membershipFee: number;
  admissionFee: number;
  includedServices: string | null;
  eligibility: string | null;
  paymentTerms: "FULL_PAYMENT_ONLY" | "INSTALLMENTS_ALLOWED";
  isActive: boolean;
  version: number;
  membershipsCount: number;
  createdAt: string;
}

interface FeePlansListClientProps {
  currentUserRole: Role;
}

export default function FeePlansListClient({ currentUserRole }: FeePlansListClientProps) {
  const readCacheVersion = useReadCacheVersion();
  const isOwner = currentUserRole === Role.OWNER;
  const [plans, setPlans] = useState<FeePlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeePlanItem | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const showHistory = async (id: string) => {
    setHistoryError("");
    try {
      const res = await apiFetch(`/api/v1/fee-plans/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load history.");
      setHistory(data.plan.history || []);
    } catch (err) { setHistoryError(err instanceof Error ? err.message : "Could not load history."); }
  };

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/fee-plans");
      const data = await res.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error("Failed to load fee plans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, readCacheVersion]);

  const handleToggleActive = async (plan: FeePlanItem) => {
    if (!isOwner) return;
    try {
      const res = await apiFetch(`/api/v1/fee-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
      } else {
        alert(data.error || "Failed to update status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlan = async (plan: FeePlanItem) => {
    if (!isOwner) return;
    const confirmMsg =
      plan.membershipsCount > 0
        ? `Is plan par ${plan.membershipsCount} members enroll ho chuke hain. Is ko permanently delete nahi kiya ja sakta, balkay Deactivate kiya jayega taake purani agreements mehfooz rahein. Kya aap deactivate karna chahte hain?`
        : `Kya aap plan '${plan.name}' ko delete karna chahte hain?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await apiFetch(`/api/v1/fee-plans/${plan.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
      } else {
        alert(data.error || "Failed to remove plan.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter plans
  const filteredPlans = plans.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.includedServices && p.includedServices.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ? true : statusFilter === "ACTIVE" ? p.isActive : !p.isActive;

    return matchesSearch && matchesStatus;
  });

  const activePlansCount = plans.filter((p) => p.isActive).length;
  const totalEnrolled = plans.reduce((sum, p) => sum + p.membershipsCount, 0);

  return (
    <div>
      {/* Top Header */}
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
              <CreditCard size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-main)", margin: 0, letterSpacing: "-0.5px" }}>
                Fee plans
              </h1>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => fetchPlans()}
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px" }}
            title="Refresh list"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {isOwner && (
            <button
              id="btn-add-fee-plan"
              onClick={() => {
                setEditingPlan(null);
                setIsModalOpen(true);
              }}
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
              <Plus size={18} />
              Add Fee Plan
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
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
              
              Total plans
            </span>
            <Layers size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-main)" }}>
            {plans.length}
          </div>
          
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              
              Active plans
            </span>
            <CheckCircle size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent-primary)" }}>
            {activePlansCount}
          </div>
          
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              
              Inactive plans
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--amber-primary)" }}>
            {plans.length - activePlansCount}
          </div>
          
        </div>

        <div className="glass-card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
              
              Memberships
            </span>
            <Users size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--blue-primary)" }}>
            {totalEnrolled}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            
            Includes past memberships
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
            id="input-fee-plan-search"
            type="text"
            placeholder="Search fee plans"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{
              width: "100%",
              paddingLeft: "42px",
              background: "var(--bg-secondary)",
              fontSize: "0.9rem",
            }}
          />
        </div>

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
            onClick={() => setStatusFilter("ALL")}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "ALL" ? "var(--accent-primary)" : "transparent",
              color: statusFilter === "ALL" ? "var(--text-inverse)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
            }}
          >
            All Plans
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "ACTIVE" ? "var(--accent-soft)" : "transparent",
              color: statusFilter === "ACTIVE" ? "var(--accent-primary)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
            }}
          >
            Active Only
          </button>
          <button
            onClick={() => setStatusFilter("INACTIVE")}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              background: statusFilter === "INACTIVE" ? "var(--amber-soft)" : "transparent",
              color: statusFilter === "INACTIVE" ? "var(--amber-primary)" : "var(--text-secondary)",
              fontWeight: 700,
              fontSize: "0.825rem",
              cursor: "pointer",
            }}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Plans Table (Point 1 of prompt) */}
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
                <th style={{ padding: "14px 18px" }}>Plan Name</th>
                <th style={{ padding: "14px 18px" }}>Duration</th>
                <th style={{ padding: "14px 18px" }}>Membership Fee</th>
                <th style={{ padding: "14px 18px" }}>Admission Fee</th>
                <th style={{ padding: "14px 18px" }}>Included Services</th>
                <th style={{ padding: "14px 18px" }}>Payment Terms</th>
                <th style={{ padding: "14px 18px" }}>Status</th>
                {isOwner && <th style={{ padding: "14px 18px", textAlign: "right" }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                      <RefreshCw size={20} className="spin-slow" />
                      Loading fee plans...
                    </div>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "54px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px" }}>
                      Koi Fee Plan Nahi Mila
                    </div>
                    
                    {isOwner && (
                      <button
                        onClick={() => {
                          setEditingPlan(null);
                          setIsModalOpen(true);
                        }}
                        className="btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 18px" }}
                      >
                        <Plus size={16} />
                        Naya Plan Banayein
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const durationDisplay =
                    plan.durationUnit === "CALENDAR_MONTHS"
                      ? `${plan.durationValue} calendar month${plan.durationValue > 1 ? "s" : ""}`
                      : plan.durationUnit === "YEARS"
                      ? `${plan.durationValue} calendar year${plan.durationValue > 1 ? "s" : ""}`
                      : `${plan.durationValue} days`;

                  return (
                    <tr
                      key={plan.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Column 1: Plan Name */}
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.95rem" }}>
                            {plan.name}
                            <button className="btn-secondary" onClick={() => showHistory(plan.id)}>Version history</button>
                          </span>
                          {plan.version > 1 && (
                            <span
                              style={{
                                fontSize: "0.685rem",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "var(--bg-secondary)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              v{plan.version}
                            </span>
                          )}
                        </div>
                        {plan.description && (
                          <div style={{ fontSize: "0.785rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            {plan.description}
                          </div>
                        )}
                      </td>

                      {/* Column 2: Duration */}
                      <td style={{ padding: "16px 18px" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                          {durationDisplay}
                        </span>
                      </td>

                      {/* Column 3: Membership Fee */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "var(--accent-primary)",
                            fontSize: "0.95rem",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          Rs. {plan.membershipFee.toLocaleString()}
                        </span>
                      </td>

                      {/* Column 4: Admission Fee */}
                      <td style={{ padding: "16px 18px" }}>
                        {plan.admissionFee > 0 ? (
                          <span style={{ fontSize: "0.85rem", color: "var(--amber-primary)", fontWeight: 600 }}>
                            Rs. {plan.admissionFee.toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.785rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                            Free / Rs. 0
                          </span>
                        )}
                      </td>

                      {/* Column 5: Included Services */}
                      <td style={{ padding: "16px 18px", maxWidth: "240px" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {plan.includedServices || "Standard Access"}
                        </span>
                        {plan.eligibility && plan.eligibility !== "Everyone" && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "var(--blue-soft)",
                              color: "var(--blue-primary)",
                              marginTop: "4px",
                              display: "inline-block",
                            }}
                          >
                            {plan.eligibility}
                          </span>
                        )}
                      </td>

                      {/* Column 6: Payment Terms */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: 600,
                            background:
                              plan.paymentTerms === "INSTALLMENTS_ALLOWED"
                                ? "var(--purple-soft)"
                                : "var(--bg-secondary)",
                            color:
                              plan.paymentTerms === "INSTALLMENTS_ALLOWED" ? "var(--purple-primary)" : "var(--text-secondary)",
                          }}
                        >
                          {plan.paymentTerms === "INSTALLMENTS_ALLOWED" ? "Installments OK" : "Full Payment"}
                        </span>
                      </td>

                      {/* Column 7: Status */}
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontWeight: 700,
                            background: plan.isActive ? "var(--accent-soft)" : "var(--bg-secondary)",
                            color: plan.isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                          }}
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Column 8: Action (Owner Only) */}
                      {isOwner && (
                        <td style={{ padding: "16px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              onClick={() => {
                                setEditingPlan(plan);
                                setIsModalOpen(true);
                              }}
                              className="btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                              title="Edit plan"
                            >
                              <Edit size={14} />
                            </button>

                            <button
                              onClick={() => handleToggleActive(plan)}
                              className="btn-secondary"
                              style={{
                                padding: "6px 10px",
                                fontSize: "0.75rem",
                                color: plan.isActive ? "var(--amber-primary)" : "var(--accent-primary)",
                              }}
                              title={plan.isActive ? "Deactivate plan" : "Activate plan"}
                            >
                              <Power size={14} />
                            </button>

                            <button
                              onClick={() => handleDeletePlan(plan)}
                              className="btn-secondary"
                              style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--danger)" }}
                              title={plan.membershipsCount > 0 ? "Deactivate (Plan has history)" : "Delete draft plan"}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {historyError && <p role="alert">{historyError}</p>}
      {history !== null && <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Fee plan version history"><section className="glass-panel" style={{ padding: 24, maxWidth: 640, maxHeight: "80vh", overflowY: "auto" }}><h2>Version history</h2><button className="btn-secondary" onClick={() => setHistory(null)}>Close</button>{history.length === 0 && <p>No earlier versions.</p>}{history.map(version => <article key={version.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--border-subtle)" }}><h3>{version.name} · v{version.version}</h3><p>{version.durationValue} {version.durationUnit.replaceAll("_", " ")} · Fee Rs. {version.membershipFee.toLocaleString()} · Admission Rs. {version.admissionFee.toLocaleString()}</p><p>{version.includedServices}</p><p>{version.paymentTerms.replaceAll("_", " ")} · {version.eligibility}</p><p>{version.description}</p><small>{version.changeReason} · {new Date(version.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</small></article>)}</section></ModalOverlay>}
      <AddEditFeePlanModal
        isOpen={isModalOpen}
        planToEdit={editingPlan}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPlan(null);
        }}
        onSuccess={() => fetchPlans()}
      />
    </div>
  );
}
