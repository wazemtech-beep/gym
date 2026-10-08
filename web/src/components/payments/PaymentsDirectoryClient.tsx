"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Search,
  Filter,
  CreditCard,
  Building,
  Receipt,
  User,
  Calendar,
  RefreshCw,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import ReceiptModal from "@/components/receipts/ReceiptModal";
import RecordPaymentModal from "@/components/members/RecordPaymentModal";
import RecordRefundModal from "./RecordRefundModal";
import { useSearchParams } from "next/navigation";

interface Payment {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  status?: string;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  gymMember: {
    id: string;
    fullName: string;
    memberId: string;
    phone: string;
  };
  receivingAccount?: {
    id: string;
    displayName: string;
    type: string;
    accountNumber: string;
  };
  recordedBy: {
    id: string;
    name: string;
    role: string;
  };
  allocations: Array<{
    id: string;
    amount: number;
    invoice: {
      id: string;
      invoiceNumber: string;
      totalAmount: number;
      balanceAmount: number;
      status: string;
    };
  }>;
}

export default function PaymentsDirectoryClient() {
  const readCacheVersion = useReadCacheVersion();
  const memberIdFilter = useSearchParams().get("memberId");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [selectedRefundPayment, setSelectedRefundPayment] = useState<Payment | null>(null);

  // Quick payment modal state
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (memberIdFilter) params.append("memberId", memberIdFilter);
      if (search) params.append("search", search);
      if (methodFilter !== "ALL") params.append("method", methodFilter);

      const res = await apiFetch(`/api/v1/payments?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, memberIdFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments, readCacheVersion]);

  // Fetch members list for the quick payment modal
  useEffect(() => {
    apiFetch("/api/v1/members?limit=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMembersList(d.members || []);
      })
      .catch(() => {});
  }, [readCacheVersion]);

  // Compute summary metrics
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const cashAmount = payments.filter((p) => p.method === "CASH").reduce((sum, p) => sum + p.amount, 0);
  const bankAmount = payments.filter((p) => p.method !== "CASH").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="badge badge-primary">Financial Collections</span>
          </div>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: 0 }}>Payments & Receipts Ledger</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "4px 0 0" }}>
            Verified income records, cash drawer receipts, and digital account transfers
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() => fetchPayments()}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          {membersList.length > 0 && (
            <button
              onClick={() => {
                setSelectedMemberForPayment(membersList[0]);
                setRecordModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Plus size={16} />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
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
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>TOTAL RECEIVED</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
              <DollarSign size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#10b981" }}>
            Rs. {totalAmount.toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Across {payments.length} verified receipts</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>CASH COLLECTION</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              <Building size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#3b82f6" }}>
            Rs. {cashAmount.toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Physical cash received</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>BANK & DIGITAL TRANSFERS</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
              <CreditCard size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#8b5cf6" }}>
            Rs. {bankAmount.toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Bank / Easypaisa / JazzCash</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>RECEIPTS ISSUED</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              <Receipt size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700 }}>
            {payments.length}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Unique confirmed receipts</small>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="input"
            placeholder="Search receipt #, member name, transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "36px", width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {["ALL", "CASH", "BANK_TRANSFER", "EASYPAISA", "JAZZCASH"].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`btn btn-sm ${methodFilter === m ? "btn-primary" : "btn-secondary"}`}
            >
              {m.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            Payments load ho rahi hain...
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <DollarSign size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <h3>Koi payment record nahi mila</h3>
            <p>Diye gaye criteria ke mutabiq koi payment mojood nahi hai.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 16px" }}>RECEIPT #</th>
                  <th style={{ padding: "14px 16px" }}>MEMBER</th>
                  <th style={{ padding: "14px 16px" }}>AMOUNT</th>
                  <th style={{ padding: "14px 16px" }}>METHOD</th>
                  <th style={{ padding: "14px 16px" }}>ACCOUNT / TRX</th>
                  <th style={{ padding: "14px 16px" }}>DATE</th>
                  <th style={{ padding: "14px 16px" }}>RECORDED BY</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.15s ease" }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Receipt size={15} style={{ color: "var(--accent-primary)" }} />
                        {p.receiptNumber}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{p.gymMember.fullName}</div>
                      <small style={{ color: "var(--text-muted)" }}>
                        {p.gymMember.memberId} · {p.gymMember.phone}
                      </small>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#10b981", fontSize: "1rem" }}>
                      Rs. {p.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span className="badge badge-primary">{p.method.replace("_", " ")}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>{p.receivingAccount?.displayName || "Cash Drawer"}</div>
                      {p.referenceNumber && (
                        <small style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>
                          Ref: {p.referenceNumber}
                        </small>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>{new Date(p.paymentDate).toLocaleDateString()}</div>
                      <small style={{ color: "var(--text-muted)" }}>
                        {new Date(p.paymentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </small>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>{p.recordedBy.name}</div>
                      <small style={{ color: "var(--text-muted)" }}>{p.recordedBy.role.toLowerCase()}</small>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px", justifyContent: "flex-end" }}>
                        {p.status === "CONFIRMED" && (
                          <button
                            onClick={() => setSelectedRefundPayment(p)}
                            className="btn btn-sm btn-secondary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--danger)" }}
                            title="Record member refund"
                          >
                            <RotateCcw size={13} />
                            <span>Refund</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedReceiptPayment(p)}
                          className="btn btn-sm btn-secondary"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <Receipt size={14} />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {selectedReceiptPayment && (
        <ReceiptModal
          receiptId={selectedReceiptPayment.id}
          isOpen={!!selectedReceiptPayment}
          onClose={() => setSelectedReceiptPayment(null)}
        />
      )}

      {/* Record Refund Modal */}
      {selectedRefundPayment && (
        <RecordRefundModal
          isOpen={!!selectedRefundPayment}
          payment={selectedRefundPayment}
          onClose={() => setSelectedRefundPayment(null)}
          onSuccess={() => {
            fetchPayments();
          }}
        />
      )}

      {/* Quick Record Payment Modal */}
      {recordModalOpen && selectedMemberForPayment && (
        <RecordPaymentModal
          isOpen={recordModalOpen}
          member={selectedMemberForPayment}
          invoices={[]}
          onClose={() => {
            setRecordModalOpen(false);
            setSelectedMemberForPayment(null);
          }}
          onSuccess={() => {
            setRecordModalOpen(false);
            setSelectedMemberForPayment(null);
            fetchPayments();
          }}
        />
      )}
    </div>
  );
}
