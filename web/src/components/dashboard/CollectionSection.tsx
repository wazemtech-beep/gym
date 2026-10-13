"use client";
import { apiFetch } from "@/lib/apiFetch";
import { formatKarachiPaymentDate } from "@/lib/displayDates";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  RotateCcw,
  Clock,
  Search,
  CheckCircle2,
} from "lucide-react";
import RecordPaymentModal from "./RecordPaymentModal";
import PendingTransfersModal from "./PendingTransfersModal";
import CloseCashSessionModal from "./CloseCashSessionModal";
import OpenCashSession from "./OpenCashSession";
import styles from "./Dashboard.module.css";

const paymentMethodLabels: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", EASYPAISA: "Easypaisa", JAZZCASH: "JazzCash" };

interface PaymentItem {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  paymentDate: string;
  referenceNumber: string | null;
  gymMember: {
    fullName: string;
    memberId: string;
  };
  recordedBy: {
    name: string;
  };
  receivingAccount: {
    displayName: string;
  } | null;
}

interface CollectionMetrics {
  netCollection: number;
  totalReceived: number;
  cashReceived: number;
  bankReceived: number;
  totalRefunds: number;
  pendingTransfersCount: number;
  pendingTransfersAmount: number;
  totalOutstandingDues: number;
  totalOverdue: number;
  activeMembersCount: number;
  expiringMembershipsCount?: number;
}

interface CollectionSectionProps {
  initialMetrics: CollectionMetrics;
  initialPayments: PaymentItem[];
  membersList: Array<{ id: string; memberId: string; fullName: string }>;
  accountsList: Array<{ id: string; displayName: string; type: string }>;
  pendingTransfersList: any[];
  activeCashSession: any;
}

export default function CollectionSection({
  initialMetrics,
  initialPayments,
  membersList,
  accountsList,
  pendingTransfersList,
  activeCashSession,
}: CollectionSectionProps) {
  const [period, setPeriod] = useState("today");
  const [metrics, setMetrics] = useState<CollectionMetrics>(initialMetrics);
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [pendingTransfers, setPendingTransfers] = useState(pendingTransfersList);
  const [cashSession, setCashSession] = useState(activeCashSession);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchCollectionData = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/dashboard/collection?period=${selectedPeriod}${selectedPeriod === "custom" ? `&startDate=${customStart}&endDate=${customEnd}` : ""}`);
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setPayments(data.payments);
        setPendingTransfers(data.pendingTransfers);
        setCashSession(data.activeCashSession);
      }
    } catch (err) {
      console.error("Error refreshing collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    fetchCollectionData(newPeriod);
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.gymMember.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.gymMember.memberId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMethod = methodFilter === "ALL" || p.method === methodFilter;

    return matchesSearch && matchesMethod;
  });

  return (
    <div className={styles.collection}>
      {/* Header with Date Filter Pills & Quick Actions */}
      <div className={styles.header}>
        <div>
          <h1 className="page-heading">Dashboard</h1>
        </div>

        {/* Date Filter Pills */}
        <div className={styles.periodTabs} aria-label="Collection period">
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "this_week", label: "This Week" },
            { id: "this_month", label: "This Month" },
          ].map((tab) => (
            <button
              key={tab.id}
              aria-pressed={period === tab.id}
              onClick={() => handlePeriodChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className={styles.toolbar}>
          <form className={styles.dateForm} onSubmit={e => { e.preventDefault(); handlePeriodChange("custom"); }}><label>From<input className="input-field" type="date" required value={customStart} onChange={e => setCustomStart(e.target.value)} /></label><label>To<input className="input-field" type="date" min={customStart} required value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label><button className="btn-secondary">Apply dates</button></form>
          <div className={styles.actions}>
          {!cashSession && <OpenCashSession onSuccess={() => fetchCollectionData(period)} />}
          <RecordPaymentModal
            members={membersList}
            accounts={accountsList}
            onSuccess={() => fetchCollectionData(period)}
          />
          <PendingTransfersModal
            transfers={pendingTransfers}
            onSuccess={() => fetchCollectionData(period)}
          />
          <CloseCashSessionModal
            session={cashSession}
            onSuccess={() => fetchCollectionData(period)}
          />
          </div>
        </div>
      </div>

      {/* Financial overview */}
      <div className={styles.metricGrid} aria-busy={loading}>
        {[
          { label: "Outstanding dues", value: "Rs. " + metrics.totalOutstandingDues.toLocaleString("en-US"), icon: DollarSign, color: "var(--text-main)", surface: "var(--bg-surface)" },
          { label: "Overdue dues", value: "Rs. " + metrics.totalOverdue.toLocaleString("en-US"), icon: Clock, color: "var(--danger)", surface: "var(--danger-soft)" },
          { label: "Active members", value: metrics.activeMembersCount.toLocaleString("en-US"), icon: CheckCircle2, color: "var(--accent-primary)", surface: "var(--accent-soft)" },
          { label: "Net collection", value: "Rs. " + metrics.netCollection.toLocaleString("en-US"), icon: DollarSign, color: "var(--accent-primary)", surface: "var(--accent-soft)", caption: "Received − refunds" },
          { label: "Cash", value: "Rs. " + metrics.cashReceived.toLocaleString("en-US"), icon: TrendingUp, color: "var(--blue-primary)", surface: "var(--blue-soft)" },
          { label: "Confirmed transfers", value: "Rs. " + metrics.bankReceived.toLocaleString("en-US"), icon: CheckCircle2, color: "var(--accent-secondary)", surface: "var(--accent-soft)" },
          { label: "Refunds", value: "Rs. " + metrics.totalRefunds.toLocaleString("en-US"), icon: RotateCcw, color: "var(--danger)", surface: "var(--danger-soft)" },
          { label: "Pending transfers", value: metrics.pendingTransfersCount.toLocaleString("en-US"), icon: Clock, color: "var(--amber-primary)", surface: "var(--amber-soft)", caption: "Rs. " + metrics.pendingTransfersAmount.toLocaleString("en-US") + " awaiting verification" },
        ].map(({ label, value, icon: Icon, color, surface, caption }) => (
          <div key={label} className={`${styles.metricCard} ${label === "Net collection" ? styles.featuredCard : ""} ${label === "Outstanding dues" ? styles.duesCard : ""}`}>
            <div className={styles.metricTop}>
              <span className={styles.metricLabel}>{label}</span>
              <span className={styles.metricIcon} style={{ color, background: surface }}><Icon size={18} /></span>
            </div>
            <div className={styles.metricValue}>{value}</div>
            {caption && <div className={styles.metricCaption}>{caption}</div>}
          </div>
        ))}
      </div>

      <div className={styles.expiryStrip}><span><Clock size={18} /> Memberships expiring in 7 days</span><strong>{metrics.expiringMembershipsCount ?? 0}</strong></div>
      {/* Confirmed Payments Table matching Requirement Line 323 */}
      <div className={styles.panel}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "2px" }}>
              Payments
            </h3>
            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              {filteredPayments.length} payments
            </span>
          </div>

          {/* Search & Method Filter */}
          <div className="dashboard-payment-filters">
            <div className="dashboard-search">
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                }}
              />
              <input
                type="text"
                aria-label="Search payments"
                placeholder="Search member or receipt"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ padding: "8px 12px 8px 34px", fontSize: "0.84rem" }}
              />
            </div>

            <select
              aria-label="Payment method"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="form-input"
              style={{ padding: "8px 12px", fontSize: "0.84rem", width: "130px" }}
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank</option>
              <option value="EASYPAISA">Easypaisa</option>
              <option value="JAZZCASH">JazzCash</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        {filteredPayments.length === 0 ? (
          <div
            style={{
              padding: "36px",
              textAlign: "center",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border-subtle)",
              color: "var(--text-dim)",
              fontSize: "0.88rem",
            }}
          >
            No payments found.
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-dim)",
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                  }}
                >
                  <th style={{ padding: "12px 14px" }}>Receipt #</th>
                  <th style={{ padding: "12px 14px" }}>Member</th>
                  <th style={{ padding: "12px 14px" }}>Date</th>
                  <th style={{ padding: "12px 14px" }}>Method</th>
                  <th style={{ padding: "12px 14px" }}>Account / reference</th>
                  <th style={{ padding: "12px 14px" }}>Amount</th>
                  <th style={{ padding: "12px 14px" }}>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "14px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-primary)" }}>
                      {p.receiptNumber}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <div style={{ fontWeight: 700 }}>{p.gymMember.fullName}</div>
                      <span style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>
                        {p.gymMember.memberId}
                      </span>
                    </td>
                    <td style={{ padding: "14px", color: "var(--text-muted)" }}>
                      {formatKarachiPaymentDate(p.paymentDate)}
                    </td>
                    <td style={{ padding: "14px" }}>
                      <span
                        className="badge"
                        style={{
                          background:
                            p.method === "CASH"
                              ? "var(--accent-soft)"
                              : "var(--blue-soft)",
                          color: p.method === "CASH" ? "var(--accent-primary)" : "var(--blue-primary)",
                        }}
                      >
                        {paymentMethodLabels[p.method] || p.method}
                      </span>
                    </td>
                    <td style={{ padding: "14px", fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {p.receivingAccount?.displayName || p.referenceNumber || "Desk Cash"}
                    </td>
                    <td style={{ padding: "14px", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
                      Rs. {p.amount.toLocaleString("en-US")}
                    </td>
                    <td style={{ padding: "14px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {p.recordedBy.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
