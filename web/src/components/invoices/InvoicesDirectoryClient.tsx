"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Receipt,
  User,
  Calendar,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import RecordPaymentModal from "@/components/members/RecordPaymentModal";
import InvoiceVoid from "./InvoiceVoid";
import InvoiceCreditNote from "./InvoiceCreditNote";

interface LineItem {
  id: string;
  description: string;
  amount: number;
  itemType: string;
}

interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

interface Allocation {
  id: string;
  amount: number;
  payment: {
    id: string;
    receiptNumber: string;
    paymentDate: string;
    method: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  issueDate: string;
  dueDate: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "VOID";
  notes?: string;
  gymMember: {
    id: string;
    fullName: string;
    memberId: string;
    phone: string;
  };
  membership?: {
    planName: string;
    startDate: string;
    endDate: string;
  };
  lineItems: LineItem[];
  installments: Installment[];
  allocations: Allocation[];
}

export default function InvoicesDirectoryClient({ canAdjust = false }: { canAdjust?: boolean }) {
  const readCacheVersion = useReadCacheVersion();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueCount: 0,
  });

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await apiFetch(`/api/v1/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices, readCacheVersion]);

  const handleOpenPayment = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPaymentModalOpen(true);
  };

  const getStatusBadge = (inv: Invoice) => {
    const isOverdue = inv.balanceAmount > 0 && new Date(inv.dueDate) < new Date();
    if (inv.status === "PAID") {
      return <span className="badge badge-success"><CheckCircle2 size={12} style={{ marginRight: 4 }} /> PAID</span>;
    }
    if (isOverdue) {
      return <span className="badge badge-danger"><AlertCircle size={12} style={{ marginRight: 4 }} /> OVERDUE</span>;
    }
    if (inv.status === "PARTIALLY_PAID") {
      return <span className="badge badge-warning"><Clock size={12} style={{ marginRight: 4 }} /> PARTIAL</span>;
    }
    return <span className="badge badge-neutral">UNPAID</span>;
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="badge badge-primary">Financial Billing</span>
          </div>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: 0 }}>Invoices & Member Dues</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "4px 0 0" }}>
            Track issued fees, installment balances, overdue dues, and direct payment receipts
          </p>
        </div>
        <button
          onClick={() => fetchInvoices()}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Stats Cards */}
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
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>TOTAL INVOICED</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
              <FileText size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700 }}>Rs. {stats.totalInvoiced.toLocaleString()}</div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Gross billed amount</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>COLLECTED / PAID</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "#10b981" }}>
            Rs. {stats.totalPaid.toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Settled against invoices</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>OUTSTANDING DUES</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              <DollarSign size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: stats.totalOutstanding > 0 ? "#f59e0b" : "inherit" }}>
            Rs. {stats.totalOutstanding.toLocaleString()}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Pending collection</small>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>OVERDUE INVOICES</span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
              <AlertCircle size={18} />
            </span>
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: stats.overdueCount > 0 ? "#ef4444" : "inherit" }}>
            {stats.overdueCount}
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Passed due date</small>
        </div>
      </div>

      {/* Filters Bar */}
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
            placeholder="Search invoice #, member name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "36px", width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {["ALL", "UNPAID", "PARTIALLY_PAID", "PAID"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`btn btn-sm ${statusFilter === st ? "btn-primary" : "btn-secondary"}`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            Invoices load ho rahi hain...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <FileText size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <h3>Koi invoice nahi mili</h3>
            <p>Diye gaye criteria ke mutabiq koi record mojood nahi hai.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  <th style={{ padding: "14px 16px" }}>INVOICE</th>
                  <th style={{ padding: "14px 16px" }}>MEMBER</th>
                  <th style={{ padding: "14px 16px" }}>TOTAL</th>
                  <th style={{ padding: "14px 16px" }}>PAID</th>
                  <th style={{ padding: "14px 16px" }}>BALANCE</th>
                  <th style={{ padding: "14px 16px" }}>DUE DATE</th>
                  <th style={{ padding: "14px 16px" }}>STATUS</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  return (
                    <React.Fragment key={inv.id}>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          background: isExpanded ? "rgba(255, 255, 255, 0.02)" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                          <small style={{ color: "var(--text-muted)" }}>{inv.title}</small>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 600 }}>{inv.gymMember.fullName}</div>
                          <small style={{ color: "var(--text-muted)" }}>
                            {inv.gymMember.memberId} · {inv.gymMember.phone}
                          </small>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                          Rs. {inv.totalAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#10b981", fontWeight: 600 }}>
                          Rs. {inv.paidAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: "14px 16px", color: inv.balanceAmount > 0 ? "#f59e0b" : "inherit", fontWeight: 700 }}>
                          Rs. {inv.balanceAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                          <small style={{ color: "var(--text-muted)" }}>
                            Issued: {new Date(inv.issueDate).toLocaleDateString()}
                          </small>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {getStatusBadge(inv)}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                            {canAdjust && inv.status !== "VOID" && <InvoiceVoid invoiceId={inv.id} paidAmount={inv.paidAmount} onSaved={fetchInvoices} />}
                            {canAdjust && inv.status !== "VOID" && <InvoiceCreditNote invoiceId={inv.id} onSuccess={fetchInvoices} />}
                            {inv.balanceAmount > 0 && (
                              <button
                                onClick={() => handleOpenPayment(inv)}
                                className="btn btn-sm btn-primary"
                                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                              >
                                <DollarSign size={13} />
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              className="btn btn-sm btn-secondary"
                              title="Toggle Details"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Breakdown Drawer */}
                      {isExpanded && (
                        <tr style={{ background: "rgba(255, 255, 255, 0.03)", borderBottom: "1px solid var(--border-color)" }}>
                          <td colSpan={8} style={{ padding: "20px 24px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "24px" }}>
                              {/* Line Items */}
                              <div>
                                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-muted)" }}>
                                  FEE LINE ITEMS
                                </h4>
                                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "12px" }}>
                                  {inv.lineItems.map((li) => (
                                    <div
                                      key={li.id}
                                      style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                    >
                                      <span>{li.description}</span>
                                      <strong style={{ color: li.amount < 0 ? "#10b981" : "inherit" }}>
                                        {li.amount < 0 ? `-Rs. ${Math.abs(li.amount).toLocaleString()}` : `Rs. ${li.amount.toLocaleString()}`}
                                      </strong>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Installment Breakdown */}
                              {inv.installments.length > 0 && (
                                <div>
                                  <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-muted)" }}>
                                    INSTALLMENT SCHEDULE
                                  </h4>
                                  <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "12px" }}>
                                    {inv.installments.map((inst) => (
                                      <div
                                        key={inst.id}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                      >
                                        <div>
                                          <span>Installment #{inst.installmentNumber}</span>
                                          <small style={{ display: "block", color: "var(--text-muted)" }}>
                                            Due: {new Date(inst.dueDate).toLocaleDateString()}
                                          </small>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                          <div>Rs. {inst.amount.toLocaleString()}</div>
                                          <small style={{ color: inst.paidAmount >= inst.amount ? "#10b981" : "#f59e0b" }}>
                                            Paid: Rs. {inst.paidAmount.toLocaleString()} ({inst.status})
                                          </small>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Payment Allocations & Receipts */}
                              <div>
                                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-muted)" }}>
                                  ALLOCATED PAYMENTS & RECEIPTS
                                </h4>
                                <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "12px" }}>
                                  {inv.allocations.length === 0 ? (
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "8px 0" }}>
                                      Abhi tak koi payment record nahi hui.
                                    </div>
                                  ) : (
                                    inv.allocations.map((alloc) => (
                                      <div
                                        key={alloc.id}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                      >
                                        <div>
                                          <span style={{ fontWeight: 600 }}>Receipt #{alloc.payment.receiptNumber}</span>
                                          <small style={{ display: "block", color: "var(--text-muted)" }}>
                                            {new Date(alloc.payment.paymentDate).toLocaleDateString()} · {alloc.payment.method}
                                          </small>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <strong style={{ color: "#10b981" }}>Rs. {alloc.amount.toLocaleString()}</strong>
                                          <a
                                            href={`/admin/receipts?receipt=${alloc.payment.receiptNumber}`}
                                            className="icon-button"
                                            title="View Receipt"
                                          >
                                            <Receipt size={14} />
                                          </a>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedInvoiceForPayment && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          member={selectedInvoiceForPayment.gymMember}
          invoices={[selectedInvoiceForPayment]}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedInvoiceForPayment(null);
          }}
          onSuccess={() => {
            setPaymentModalOpen(false);
            setSelectedInvoiceForPayment(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}
