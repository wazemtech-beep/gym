"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Calendar,
  DollarSign,
  AlertTriangle,
  Snowflake,
  Sparkles,
  Info,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { DurationUnit } from "@prisma/client";
import { calculateMembershipEndDate, calculatePricingBreakdown } from "@/lib/pricing";

interface AssignMembershipModalProps {
  isOpen: boolean;
  member: any;
  mode?: "ASSIGN" | "FREEZE" | "UNFREEZE";
  activeMembershipId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignMembershipModal({
  isOpen,
  member,
  mode = "ASSIGN",
  activeMembershipId,
  onClose,
  onSuccess,
}: AssignMembershipModalProps) {
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [fetchingPlans, setFetchingPlans] = useState(false);

  // Determine if member is a first-time joiner or renewing (Point 5)
  const isFirstTimeJoiner = !member.admissionFeePreviouslyPaid && (!member.memberships || member.memberships.length === 0);

  const [formData, setFormData] = useState({
    planName: "Regular Monthly",
    durationValue: 1,
    durationUnit: "CALENDAR_MONTHS" as DurationUnit,
    startDate: new Date().toISOString().split("T")[0],
    membershipFee: "3000",
    applyAdmissionFee: isFirstTimeJoiner,
    admissionFee: "1000",
    admissionDiscountValue: "0",
    discountType: "NONE" as "NONE" | "FIXED" | "PERCENTAGE",
    discountValue: "0",
    discountReason: "",
    services: "Gym Floor Access, Cardio Area, Standard Lockers",
    paymentTerms: "FULL" as "FULL" | "INSTALLMENTS",
    installments: [] as { amount: string; dueDate: string }[],
    createInvoice: true,
    rejoiningFeeApproved: false,
    rejoiningFeeReason: "",
    freezeReason: "",
    freezeStartDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }),
    freezeDays: "7",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
    const last = (member.memberships || []).filter((item: any) => ["ACTIVE", "UPCOMING", "FROZEN"].includes(item.status)).reduce((end: number, item: any) => Math.max(end, new Date(item.endDate).getTime() || 0), 0);
    const start = last >= Date.now() ? new Date(last + 1).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }) : today;
    setFormData(previous => ({ ...previous, startDate: start, applyAdmissionFee: isFirstTimeJoiner, rejoiningFeeApproved: false, rejoiningFeeReason: "", installments: [], discountType: "NONE", discountValue: "0", discountReason: "", admissionDiscountValue: "0" }));
    setError(null);
  }, [isOpen, member.id, isFirstTimeJoiner]);

  // Fetch active fee plans on modal open
  useEffect(() => {
    if (!isOpen) return;
    const fetchActivePlans = async () => {
      try {
        setFetchingPlans(true);
        const res = await apiFetch("/api/v1/fee-plans?activeOnly=true");
        const data = await res.json();
        if (data.success && data.plans.length > 0) {
          setFeePlans(data.plans);
          const first = data.plans[0];
          setSelectedPlanId(first.id);
          setFormData((prev) => ({
            ...prev,
            planName: first.name,
            durationValue: first.durationValue,
            durationUnit: first.durationUnit,
            membershipFee: first.membershipFee.toString(),
            admissionFee: first.admissionFee.toString(),
            services: first.includedServices || "",
            paymentTerms: first.paymentTerms === "INSTALLMENTS_ALLOWED" ? "FULL" : "FULL",
          }));
        }
      } catch (err) {
        console.error("Failed to load fee plans:", err);
      } finally {
        setFetchingPlans(false);
      }
    };
    fetchActivePlans();
  }, [isOpen]);

  if (!isOpen) return null;

  // Live Validity Calculation (Point 3)
  const calculatedEndDate = calculateMembershipEndDate(
    formData.startDate,
    formData.durationValue,
    formData.durationUnit
  );

  // Live Pricing Breakdown (Point 4, 6, 7)
  const breakdown = calculatePricingBreakdown({
    membershipFee: parseFloat(formData.membershipFee) || 0,
    admissionFee: parseFloat(formData.admissionFee) || 0,
    applyAdmissionFee: formData.applyAdmissionFee,
    discountType: formData.discountType,
    discountValue: parseFloat(formData.discountValue) || 0,
    admissionDiscountValue: parseFloat(formData.admissionDiscountValue) || 0,
  });

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = feePlans.find((p) => p.id === planId);
    if (!plan) return;

    setFormData((prev) => ({
      ...prev,
      planName: plan.name,
      durationValue: plan.durationValue,
      durationUnit: plan.durationUnit,
      membershipFee: plan.membershipFee.toString(),
      admissionFee: plan.admissionFee.toString(),
      services: plan.includedServices || "",
      installments: [],
    }));
  };

  const handleAddInstallment = () => {
    const defaultAmount = Math.round(breakdown.totalPayable / 2).toString();
    const nextDate = new Date(formData.startDate);
    nextDate.setDate(nextDate.getDate() + 30);

    setFormData((prev) => ({
      ...prev,
      installments: [
        ...prev.installments,
        { amount: defaultAmount, dueDate: nextDate.toISOString().split("T")[0] },
      ],
    }));
  };

  const handleRemoveInstallment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "FREEZE") {
        const res = await apiFetch(`/api/v1/members/${member.id}/membership`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionType: "FREEZE",
            membershipId: activeMembershipId,
            freezeReason: formData.freezeReason,
            freezeStartDate: formData.freezeStartDate,
            freezeDays: Number(formData.freezeDays),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Freeze action fail ho gaya.");
      } else {
        const payload = {
          actionType: "ASSIGN",
          feePlanId: selectedPlanId || undefined,
          planName: formData.planName,
          durationValue: formData.durationValue,
          durationUnit: formData.durationUnit,
          startDate: formData.startDate,
          membershipFee: parseFloat(formData.membershipFee),
          applyAdmissionFee: formData.applyAdmissionFee,
          rejoiningFeeApproved: formData.rejoiningFeeApproved,
          rejoiningFeeReason: formData.rejoiningFeeReason,
          admissionFee: parseFloat(formData.admissionFee) || 0,
          admissionDiscountValue: parseFloat(formData.admissionDiscountValue) || 0,
          discountType: formData.discountType,
          discountValue: parseFloat(formData.discountValue) || 0,
          discountReason: formData.discountReason,
          services: formData.services,
          paymentTerms: formData.paymentTerms,
          installments: formData.installments,
          createInvoice: formData.createInvoice,
        };

        const res = await apiFetch(`/api/v1/members/${member.id}/membership`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Membership assign karne mein khata aayi.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--overlay)",
        backdropFilter: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "20px",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: mode === "FREEZE" ? "var(--blue-soft)" : "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: mode === "FREEZE" ? "var(--blue-primary)" : "var(--accent-primary)",
              }}
            >
              {mode === "FREEZE" ? <Snowflake size={18} /> : <CreditCard size={18} />}
            </div>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                {mode === "FREEZE" ? "Freeze Active Membership" : "Assign / Renew Membership"}
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                Member: {member.fullName} ({member.memberId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px" }}>
          {error && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
                fontSize: "0.85rem",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {mode === "FREEZE" ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                Freezing pauses validity. Frozen days extend the expiry on unfreeze.
              </p>
              <label className="form-label">Freeze starts<input className="input-field" type="date" required value={formData.freezeStartDate} onChange={e => setFormData({ ...formData, freezeStartDate: e.target.value })} /></label>
              <label className="form-label">Days<input className="input-field" type="number" min="1" required value={formData.freezeDays} onChange={e => setFormData({ ...formData, freezeDays: e.target.value })} /></label>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Freeze reason <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Member medical injury, out of city for 1 month"
                value={formData.freezeReason}
                onChange={(e) => setFormData({ ...formData, freezeReason: e.target.value })}
                className="input-field"
                style={{ width: "100%" }}
              />
            </div>
          ) : (
            <div>
              {!isFirstTimeJoiner && <div><label className="form-label"><input type="checkbox" checked={formData.rejoiningFeeApproved} onChange={e => setFormData({ ...formData, rejoiningFeeApproved: e.target.checked, applyAdmissionFee: e.target.checked })} /> Owner-approved rejoining fee</label>{formData.rejoiningFeeApproved && <label className="form-label">Rejoining fee reason<input className="input-field" required value={formData.rejoiningFeeReason} onChange={e => setFormData({ ...formData, rejoiningFeeReason: e.target.value })} /></label>}</div>}
              {/* Fee Plan Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  
                  Fee plan <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                {fetchingPlans ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading plans...</div>
                ) : (
                  <select
                    value={selectedPlanId}
                    onChange={(e) => handlePlanSelect(e.target.value)}
                    className="input-field"
                    style={{ width: "100%" }}
                  >
                    {feePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — Rs. {plan.membershipFee.toLocaleString()} (
                        {plan.durationValue}{" "}
                        {plan.durationUnit === "CALENDAR_MONTHS"
                          ? "Calendar Month(s)"
                          : plan.durationUnit === "YEARS"
                          ? "Year(s)"
                          : "Days"}
                        )
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Start Date & Validity Calculation Preview (Point 3) */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Subscription Start Date <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="input-field"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      
                      Last valid day
                    </label>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        fontWeight: 700,
                        color: "var(--accent-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.95rem",
                      }}
                    >
                      {calculatedEndDate.toLocaleDateString("en-PK", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.785rem", color: "var(--text-secondary)" }}>
                  Duration: <strong>{formData.durationValue} {formData.durationUnit.toLowerCase()}</strong>  Dates use Pakistan time.
                </div>
              </div>

              {/* Admission Fee Handling (Point 5) */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={formData.applyAdmissionFee}
                    onChange={(e) => setFormData({ ...formData, applyAdmissionFee: e.target.checked })}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  One-time Admission Fee Apply Karein (Rs. {formData.admissionFee})
                </label>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "4px 0 0 24px" }}>
                  {isFirstTimeJoiner
                    ? "Admission fee applies on first joining."
                    : "Admission fee does not repeat on renewal."}
                </p>
              </div>

              {/* Discount Flow (Point 7) */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                  <DollarSign size={15} color="var(--accent-primary)" />
                  Authorized Discount (Owner Approved)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px", marginBottom: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      Discount Type
                    </label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                      className="input-field"
                      style={{ width: "100%" }}
                    >
                      <option value="NONE">No Discount</option>
                      <option value="FIXED">Fixed Amount (PKR Off)</option>
                      <option value="PERCENTAGE">Percentage (%) Off Fee</option>
                    </select>
                  </div>

                  {formData.discountType !== "NONE" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                        Discount Value ({formData.discountType === "PERCENTAGE" ? "%" : "PKR"})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.discountValue}
                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                        className="input-field"
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                </div>

                {formData.discountType !== "NONE" && (
                  <div style={{ marginTop: "8px" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      
                      Discount reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Special student concession approved by Owner"
                      value={formData.discountReason}
                      onChange={(e) => setFormData({ ...formData, discountReason: e.target.value })}
                      className="input-field"
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
              </div>

              {/* Installment Schedule Builder (Point 6) */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Payment Terms
                  </div>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setFormData((prev) => ({
                        ...prev,
                        paymentTerms: val,
                        installments:
                          val === "INSTALLMENTS"
                            ? [
                                {
                                  amount: Math.round(breakdown.totalPayable / 2).toString(),
                                  dueDate: prev.startDate,
                                },
                                {
                                  amount: Math.round(breakdown.totalPayable / 2).toString(),
                                  dueDate: new Date(new Date(prev.startDate).getTime() + 30 * 86400000)
                                    .toISOString()
                                    .split("T")[0],
                                },
                              ]
                            : [],
                      }));
                    }}
                    className="input-field"
                    style={{ width: "auto", padding: "4px 8px", fontSize: "0.8rem" }}
                  >
                    <option value="FULL">Full Payment (Single Due Date)</option>
                    <option value="INSTALLMENTS">Installments Schedule</option>
                  </select>
                </div>

                {formData.paymentTerms === "INSTALLMENTS" && (
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "0 0 10px" }}>
                      Installments ka sum exact total payable (Rs. {breakdown.totalPayable.toLocaleString()}) hona chahiye.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {formData.installments.map((inst, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", width: "80px" }}>
                            Part {idx + 1}:
                          </span>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={inst.amount}
                            onChange={(e) => {
                              const newInsts = [...formData.installments];
                              newInsts[idx].amount = e.target.value;
                              setFormData({ ...formData, installments: newInsts });
                            }}
                            className="input-field"
                            style={{ width: "120px" }}
                          />
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const newInsts = [...formData.installments];
                              newInsts[idx].dueDate = e.target.value;
                              setFormData({ ...formData, installments: newInsts });
                            }}
                            className="input-field"
                            style={{ flex: 1 }}
                          />
                          {formData.installments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInstallment(idx)}
                              style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized Breakdown Box (Point 4) */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-accent)",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "10px" }}>
                  
                  Charges
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px", color: "var(--text-secondary)" }}>
                  <span>Package Membership Fee:</span>
                  <span style={{ color: "var(--text-main)", fontWeight: 600 }}>Rs. {breakdown.membershipFee.toLocaleString()}</span>
                </div>

                {breakdown.rawAdmissionFee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px", color: "var(--text-secondary)" }}>
                    <span>One-time Admission Fee:</span>
                    <span style={{ color: "var(--amber-primary)", fontWeight: 600 }}>+Rs. {breakdown.rawAdmissionFee.toLocaleString()}</span>
                  </div>
                )}

                {breakdown.computedDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px", color: "var(--text-secondary)" }}>
                    <span>Approved Membership Discount:</span>
                    <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>−Rs. {breakdown.computedDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: "10px",
                    marginTop: "6px",
                  }}
                >
                  <span>Total Payable:</span>
                  <span style={{ color: "var(--accent-primary)" }}>Rs. {breakdown.totalPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "12px",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "18px",
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "8px 22px" }}>
              {loading
                ? "Processing..."
                : mode === "FREEZE"
                ? "Freeze Membership"
                : "Confirm & Assign Plan"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
