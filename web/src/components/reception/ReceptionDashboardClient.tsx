"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  CreditCard,
  UserCheck,
  DollarSign,
  Building,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Search,
  ArrowRight,
  RefreshCw,
  Eye,
  X,
  Check,
} from "lucide-react";
import Link from "next/link";
import ReceiptModal from "@/components/receipts/ReceiptModal";
import OpenCashSession from "@/components/dashboard/OpenCashSession";
import CloseCashSessionModal from "@/components/dashboard/CloseCashSessionModal";

interface Props {
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export default function ReceptionDashboardClient({ user }: Props) {
  const readCacheVersion = useReadCacheVersion();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick check-in state
  const [checkInQuery, setCheckInQuery] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  // Transfer verification action state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectionModalSub, setRejectionModalSub] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Receipt modal state
  const [activeReceiptPaymentId, setActiveReceiptPaymentId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/reception/dashboard");
      const d = await res.json();
      if (d.success) {
        setData(d);
      }
    } catch (err) {
      console.error("Failed to load reception dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, readCacheVersion]);

  // Quick Check-in Handler
  const handleQuickCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInQuery.trim()) return;

    setCheckInLoading(true);
    setCheckInMessage(null);

    try {
      const res = await apiFetch("/api/v1/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: checkInQuery.trim() }),
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setCheckInMessage({
          type: "success",
          text: `${resData.member?.fullName || "Member"} (${resData.member?.memberId || checkInQuery}) kamyabi se check-in ho gaye!`,
        });
        setCheckInQuery("");
        fetchDashboardData();
      } else {
        setCheckInMessage({
          type: resData.error?.includes("expire") ? "warning" : "error",
          text: resData.error || "Check-in record nahi ho saka.",
        });
      }
    } catch (err: any) {
      setCheckInMessage({
        type: "error",
        text: err.message || "Network error. Dobara koshish karein.",
      });
    } finally {
      setCheckInLoading(false);
    }
  };

  // Transfer Verify / Reject Handler
  const handleTransferAction = async (submissionId: string, action: "APPROVE" | "REJECT", reason?: string) => {
    setVerifyingId(submissionId);
    try {
      const res = await apiFetch("/api/v1/transfers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action,
          rejectionReason: reason,
        }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setRejectionModalSub(null);
        setRejectionReason("");
        fetchDashboardData();
        if (action === "APPROVE" && resData.payment?.id) {
          setActiveReceiptPaymentId(resData.payment.id);
        }
      } else {
        alert(resData.error || "Action mukammal nahi ho saka.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReviewFreeze = async (id: string, action: "APPROVE" | "REJECT") => {
    let reviewNotes = "";
    if (action === "REJECT") {
      const input = prompt("Freeze request reject karne ki wajah (reason) likhein:");
      if (input === null) return;
      reviewNotes = input.trim();
    }
    try {
      const res = await apiFetch(`/api/v1/membership/freeze-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNotes }),
      });
      const resData = await res.json();
      if (resData.success) {
        fetchDashboardData();
        alert(resData.message);
      } else {
        alert(resData.error || "Action mukammal nahi ho saka.");
      }
    } catch {
      alert("Network error.");
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="badge badge-receptionist">Reception Front Desk</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 700, margin: 0 }}>
            Assalam-o-Alaikum, {user.name}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "4px 0 0" }}>
            Aaj ki cash collection, live member check-ins aur bank transfer verifications
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetchDashboardData();
          }}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Refresh Live Desk</span>
        </button>
        {data?.activeCashSession ? <CloseCashSessionModal session={data.activeCashSession} onSuccess={fetchDashboardData} /> : <OpenCashSession onSuccess={fetchDashboardData} />}
      </div>

      {/* 4 Summary Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>MY CASH COLLECTED TODAY</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
              <Building size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#10b981" }}>
            Rs. {(data?.stats?.todayMyCash || 0).toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>In your active cash drawer session</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>MY TOTAL RECEIPTS ISSUED</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              <Receipt size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#3b82f6" }}>
            {data?.stats?.todayMyReceiptsCount || 0}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            Totaling Rs. {(data?.stats?.todayMyTotal || 0).toLocaleString()}
          </small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>TODAY'S VISITS / CHECK-INS</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              <UserCheck size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f59e0b" }}>
            {data?.stats?.todayTotalCheckIns || 0}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Members checked in today</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>PENDING TRANSFERS</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
              <CreditCard size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: (data?.stats?.pendingTransfersCount || 0) > 0 ? "#ef4444" : "inherit" }}>
            {data?.stats?.pendingTransfersCount || 0}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Bank proofs awaiting approval</small>
        </div>
      </div>

      {/* Quick Check-In Bar Widget */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
          <UserCheck size={20} style={{ color: "var(--accent-primary)" }} />
          Quick Member Check-in
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
          Scan barcode / Member ID (e.g. OXG-000001) ya phone number darj karke foran check-in karein:
        </p>

        <form onSubmit={handleQuickCheckIn} style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 320px" }}>
            <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="input"
              placeholder="Enter Member ID (OXG-000001) ya phone number..."
              value={checkInQuery}
              onChange={(e) => setCheckInQuery(e.target.value)}
              style={{ paddingLeft: "42px", width: "100%", fontSize: "1rem" }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={checkInLoading || !checkInQuery.trim()}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 24px" }}
          >
            {checkInLoading ? <RefreshCw size={16} className="animate-spin" /> : <UserCheck size={16} />}
            <span>Check In Member</span>
          </button>
        </form>

        {checkInMessage && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 16px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "0.95rem",
              background:
                checkInMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : checkInMessage.type === "warning"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                checkInMessage.type === "success"
                  ? "#10b981"
                  : checkInMessage.type === "warning"
                  ? "#f59e0b"
                  : "#ef4444",
            }}
          >
            {checkInMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{checkInMessage.text}</span>
          </div>
        )}
      </div>

      {/* Two Column Grid: Pending Transfers & My Today's Payments */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: "24px", marginBottom: "32px" }}>
        {/* Pending Bank Transfers Widget */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCard size={18} style={{ color: "#3b82f6" }} />
              Pending Bank Transfers ({data?.pendingTransfers?.length || 0})
            </h3>
            <span className="badge badge-warning">Verification Queue</span>
          </div>

          {!data?.pendingTransfers || data.pendingTransfers.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
              <CheckCircle2 size={32} style={{ color: "#10b981", margin: "0 auto 8px" }} />
              <p style={{ margin: 0 }}>Tamam bank transfers verified hain. Koi pending proof nahi hai.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.pendingTransfers.map((sub: any) => (
                <div
                  key={sub.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{sub.gymMember.fullName}</div>
                    <small style={{ color: "var(--text-muted)" }}>
                      {sub.gymMember.memberId} · {sub.receivingAccount.displayName}
                    </small>
                    {sub.transactionReference && (
                      <small style={{ display: "block", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        Trx: {sub.transactionReference}
                      </small>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "#10b981", fontSize: "1.1rem" }}>
                      Rs. {sub.amount.toLocaleString()}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      <button
                        onClick={() => handleTransferAction(sub.id, "APPROVE")}
                        disabled={verifyingId === sub.id}
                        className="btn btn-sm btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Check size={13} />
                        Verify
                      </button>
                      <button
                        onClick={() => setRejectionModalSub(sub)}
                        disabled={verifyingId === sub.id}
                        className="btn btn-sm btn-secondary"
                        style={{ display: "flex", alignItems: "center", gap: "4px", color: "#ef4444" }}
                      >
                        <X size={13} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Freeze Requests Widget */}
        {data?.pendingFreezeRequests && data.pendingFreezeRequests.length > 0 && (
          <div className="glass-panel" style={{ padding: "24px", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={18} style={{ color: "#f59e0b" }} />
                Pending Membership Freeze Requests ({data.pendingFreezeRequests.length})
              </h3>
              <span className="badge badge-warning">Needs Approval</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "12px" }}>
              {data.pendingFreezeRequests.map((fr: any) => (
                <div
                  key={fr.id}
                  style={{
                    padding: "14px 16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{fr.gymMember.fullName} ({fr.gymMember.memberId})</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--accent-primary)", marginTop: "2px" }}>
                      Requested: {fr.requestedDays} Din Freeze ({fr.membership.planName})
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "2px" }}>
                      Wajah: {fr.reason}
                    </div>
                  </div>
                  {user.role === "OWNER" ? <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleReviewFreeze(fr.id, "APPROVE")}
                      className="btn btn-sm btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Check size={13} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReviewFreeze(fr.id, "REJECT")}
                      className="btn btn-sm btn-secondary"
                      style={{ display: "flex", alignItems: "center", gap: "4px", color: "#ef4444" }}
                    >
                      <X size={13} />
                      Reject
                    </button>
                  </div> : <span className="badge badge-warning">Awaiting owner</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Today's Payments Table */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <Receipt size={18} style={{ color: "#10b981" }} />
              My Cash & Payment Receipts Today
            </h3>
            <Link href="/admin/payments" className="btn btn-sm btn-secondary">
              View All
            </Link>
          </div>

          {!data?.myTodayPayments || data.myTodayPayments.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
              <Receipt size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
              <p style={{ margin: 0 }}>Aaj aapne abhi tak koi payment enter nahi ki.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-muted)" }}>
                    <th style={{ padding: "8px 10px" }}>RECEIPT</th>
                    <th style={{ padding: "8px 10px" }}>MEMBER</th>
                    <th style={{ padding: "8px 10px" }}>AMOUNT</th>
                    <th style={{ padding: "8px 10px" }}>TIME</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>PRINT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.myTodayPayments.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "10px" }}>
                        <span style={{ fontWeight: 600 }}>{p.receiptNumber}</span>
                      </td>
                      <td style={{ padding: "10px" }}>{p.gymMember.fullName}</td>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#10b981" }}>
                        Rs. {p.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px", color: "var(--text-muted)" }}>
                        {new Date(p.paymentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <button
                          onClick={() => setActiveReceiptPaymentId(p.id)}
                          className="icon-button"
                          title="Print Receipt"
                        >
                          <Receipt size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Check-ins Strip */}
      {data?.recentCheckIns && data.recentCheckIns.length > 0 && (
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={18} style={{ color: "var(--accent-primary)" }} />
            Recent Member Visits Today
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "12px" }}>
            {data.recentCheckIns.slice(0, 8).map((ci: any) => (
              <div
                key={ci.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--blue-soft)",
                    color: "var(--blue-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  {ci.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{ci.name}</div>
                  <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                    {new Date(ci.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Rejection Reason Modal */}
      {rejectionModalSub && (
        <ModalOverlay className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <h3 style={{ marginTop: 0 }}>Reject Bank Transfer</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Member: <strong>{rejectionModalSub.gymMember.fullName}</strong> (Rs. {rejectionModalSub.amount.toLocaleString()})
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px" }}>
                Wajah / Rejection Reason (Member ko dikhega):
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Details match nahi huin ya raqam account mein receive nahi hui..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setRejectionModalSub(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransferAction(rejectionModalSub.id, "REJECT", rejectionReason)}
                disabled={verifyingId === rejectionModalSub.id}
                className="btn btn-primary"
                style={{ background: "#ef4444" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Receipt Modal */}
      {activeReceiptPaymentId && (
        <ReceiptModal
          receiptId={activeReceiptPaymentId}
          isOpen={!!activeReceiptPaymentId}
          onClose={() => setActiveReceiptPaymentId(null)}
        />
      )}
    </div>
  );
}
