"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  DollarSign,
  CreditCard,
  TrendingDown,
  Users,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Wallet,
  Receipt as ReceiptIcon,
  RefreshCw
} from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/formatters";
import ReceiptModal from "@/components/receipts/ReceiptModal";

interface ReportsDirectoryClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export default function ReportsDirectoryClient({ currentUser }: ReportsDirectoryClientProps) {
  const readCacheVersion = useReadCacheVersion();
  const [activeReport, setActiveReport] = useState<"collection" | "dues" | "expenses" | "memberships" | "invoices" | "attendance">("collection");
  const [dateRange, setDateRange] = useState("this_month");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  // Report Data
  const [detailsData, setDetailsData] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [duesData, setDuesData] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [membershipsData, setMembershipsData] = useState<any>(null);

  // Receipt Modal drilldown
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const fetchCurrentReport = useCallback(async () => {
    setLoading(true);
    try {
      if (activeReport === "invoices" || activeReport === "attendance") {
        setDetailsData(null);
        const response = await apiFetch(`/api/v1/reports/details?type=${activeReport}&dateRange=${dateRange}`);
        setDetailsData(await response.json());
      } else if (activeReport === "collection") {
        const res = await apiFetch(`/api/v1/reports/collection?dateRange=${dateRange}`);
        const data = await res.json();
        if (data.success) setCollectionData(data);
      } else if (activeReport === "dues") {
        const res = await apiFetch(`/api/v1/reports/dues?asOfDate=${asOfDate}`);
        const data = await res.json();
        if (data.success) setDuesData(data);
      } else if (activeReport === "expenses") {
        const res = await apiFetch(`/api/v1/reports/expenses?dateRange=${dateRange}`);
        const data = await res.json();
        if (data.success) setExpensesData(data);
      } else if (activeReport === "memberships") {
        const res = await apiFetch(`/api/v1/reports/memberships?dateRange=${dateRange}`);
        const data = await res.json();
        if (data.success) setMembershipsData(data);
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateRange, asOfDate]);

  useEffect(() => {
    fetchCurrentReport();
  }, [fetchCurrentReport, readCacheVersion]);

  const handleExportCSV = () => {
    let url = `/api/v1/reports/export?type=${activeReport}&dateRange=${dateRange}&asOfDate=${asOfDate}`;
    if (activeReport === "collection") {
      url = `/api/v1/reports/collection?dateRange=${dateRange}&format=csv`;
    } else if (activeReport === "dues") {
      url = `/api/v1/reports/dues?asOfDate=${asOfDate}&format=csv`;
    }
    window.open(url, "_blank");
  };

  const handleExportExcel = () => { window.open(`/api/v1/reports/export?type=${activeReport}&dateRange=${dateRange}&asOfDate=${asOfDate}&format=xlsx`, "_blank"); };

  const handlePrint = () => {
    window.open(`/api/v1/reports/export?type=${activeReport}&dateRange=${dateRange}&asOfDate=${asOfDate}&format=pdf`, "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-report-area,
          #printable-report-area * {
            visibility: visible !important;
          }
          #printable-report-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.12)",
              color: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              
              Reports
            </h1>
            
          </div>
        </div>

        {/* Export & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => fetchCurrentReport()}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 700 }}
          >
            <Download size={15} />
            CSV
          </button>

          <button
            onClick={handleExportExcel}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 700 }}
          >
            <FileText size={15} />
            Excel (.xls)
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 700 }}
          >
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Type Switcher Tabs */}
      <div
        className="no-print"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        {[
          { id: "collection", label: "Collection & Receipts", icon: DollarSign },
          { id: "invoices", label: "Invoices", icon: FileText },
          { id: "attendance", label: "Attendance", icon: Users },
          { id: "dues", label: "Outstanding Dues Analysis", icon: Clock },
          { id: "expenses", label: "Expenses & Cash Movement", icon: TrendingDown },
          { id: "memberships", label: "Memberships & Renewals", icon: Users },
        ].filter(tab => currentUser.role === "OWNER" || tab.id === "collection").map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                borderBottom: isActive ? "3px solid var(--accent-primary)" : "3px solid transparent",
                color: isActive ? "#fff" : "var(--text-muted)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={16} color={isActive ? "var(--accent-primary)" : "var(--text-dim)"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div
        className="no-print"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          padding: "14px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {activeReport !== "dues" ? (
            <div
              style={{
                display: "flex",
                background: "var(--bg-secondary)",
                borderRadius: "8px",
                padding: "2px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {[
                { id: "today", label: "Today" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "all", label: "All Time" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDateRange(d.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: dateRange === d.id ? "var(--accent-primary)" : "transparent",
                    color: dateRange === d.id ? "#000" : "var(--text-muted)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Calculate Dues As-Of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "#fff",
                  fontSize: "0.82rem",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>

        <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
          Timezone: <strong>Asia/Karachi (PKT)</strong>
        </div>
      </div>

      {/* Main Report Viewable Area */}
      <div id="printable-report-area">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
            <BarChart3 className="animate-spin" size={32} style={{ margin: "0 auto 12px" }} />
            <p>Report data calculate ho rahi hai...</p>
          </div>
        ) : (
          <div>
            {/* ======================================================== */}
            {/* REPORT 1: COLLECTION REPORT                              */}
            {/* ======================================================== */}
            {activeReport === "collection" && collectionData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Total Collected</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", marginTop: "4px" }}>
                      Rs. {collectionData.summary?.totalReceived?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {collectionData.summary?.totalTransactions} confirmed receipts
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Cash received</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#10b981", marginTop: "4px" }}>
                      Rs. {collectionData.summary?.cashReceived?.toLocaleString()}
                    </div>
                    
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Bank & wallet</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#06b6d4", marginTop: "4px" }}>
                      Rs. {collectionData.summary?.digitalReceived?.toLocaleString()}
                    </div>
                    
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Net Collection</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--accent-primary)", marginTop: "4px" }}>
                      Rs. {collectionData.summary?.netCollection?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Total minus Rs. {collectionData.summary?.totalRefunds?.toLocaleString()} refunds
                    </div>
                  </div>
                </div>

                {/* Underlying Payments List */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 700, fontSize: "0.95rem" }}>
                    
                    Confirmed payments
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                          <th style={{ padding: "12px 16px" }}>Receipt #</th>
                          <th style={{ padding: "12px 16px" }}>Member</th>
                          <th style={{ padding: "12px 16px" }}>Date & Time</th>
                          <th style={{ padding: "12px 16px" }}>Source</th>
                          <th style={{ padding: "12px 16px" }}>Amount</th>
                          <th style={{ padding: "12px 16px" }}>Recorded By</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectionData.payments?.map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--accent-primary)" }}>
                              {p.receiptNumber}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 600 }}>{p.gymMember?.fullName}</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{p.gymMember?.memberId}</div>
                            </td>
                            <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>
                              {formatDateTime(p.paymentDate)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {p.method?.replace("_", " ")}
                              {p.referenceNumber && (
                                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Ref: {p.referenceNumber}</div>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 800, color: "#10b981" }}>
                              Rs. {p.amount?.toLocaleString()}
                            </td>
                            <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>
                              {p.recordedBy?.name || "Staff"}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                              <button
                                onClick={() => setSelectedReceiptId(p.id)}
                                style={{
                                  background: "rgba(16, 185, 129, 0.12)",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  color: "var(--accent-primary)",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                }}
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* REPORT 2: OUTSTANDING DUES REPORT                        */}
            {/* ======================================================== */}
            {activeReport === "dues" && duesData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "16px" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Total Outstanding Dues</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
                      Rs. {duesData.summary?.totalOutstandingDues?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Across {duesData.summary?.membersWithDuesCount} members
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Overdue Dues</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f43f5e", marginTop: "4px" }}>
                      Rs. {duesData.summary?.totalOverdueDues?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Past payment deadline as of {formatDate(asOfDate)}
                    </div>
                  </div>
                </div>

                {/* Dues Table */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 700, fontSize: "0.95rem" }}>
                    Members with Unpaid Fee Balances (As of {formatDate(asOfDate)})
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                          <th style={{ padding: "12px 16px" }}>Member</th>
                          <th style={{ padding: "12px 16px" }}>Membership Plan</th>
                          <th style={{ padding: "12px 16px" }}>Status</th>
                          <th style={{ padding: "12px 16px" }}>Overdue Amount</th>
                          <th style={{ padding: "12px 16px" }}>Total Outstanding</th>
                          <th style={{ padding: "12px 16px" }}>Unpaid Bills</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duesData.duesList?.map((m: any) => (
                          <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 700, color: "#fff" }}>{m.fullName}</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{m.memberId} • {m.phone}</div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {m.membershipPlan}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)" }}>
                                {m.membershipStatus}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: m.overdueDues > 0 ? "#f43f5e" : "var(--text-dim)" }}>
                              Rs. {m.overdueDues?.toLocaleString()}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 800, color: "#f59e0b" }}>
                              Rs. {m.totalOutstanding?.toLocaleString()}
                            </td>
                            <td style={{ padding: "12px 16px", color: "var(--text-dim)" }}>
                              {m.unpaidInvoicesCount} invoices
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* REPORT 3: EXPENSES & NET CASH MOVEMENT                   */}
            {/* ======================================================== */}
            {activeReport === "expenses" && expensesData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: "16px" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Recorded Charges</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", marginTop: "4px" }}>
                      Rs. {expensesData.summary?.totalRecordedExpenses?.toLocaleString()}
                    </div>
                    
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Actual Expense Outflow</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#10b981", marginTop: "4px" }}>
                      Rs. {expensesData.summary?.totalPaidOutflow?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Cash: Rs. {expensesData.summary?.cashOutflow?.toLocaleString()} | Bank: Rs. {expensesData.summary?.bankOutflow?.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Recorded Net Cash Movement</div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        fontWeight: 900,
                        color: expensesData.summary?.cashMovementAnalysis?.netCashMovement >= 0 ? "var(--accent-primary)" : "#f43f5e",
                        marginTop: "4px",
                      }}
                    >
                      Rs. {expensesData.summary?.cashMovementAnalysis?.netCashMovement?.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      Inflows (Rs. {expensesData.summary?.cashMovementAnalysis?.confirmedMemberCollection?.toLocaleString()}) minus Outflows
                    </div>
                  </div>
                </div>

                {/* Category breakdown bar */}
                {expensesData.summary?.categoryBreakdown && (
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "16px 20px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "10px" }}>
                      Expenses by Category
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {Object.entries(expensesData.summary.categoryBreakdown).map(([cat, amt]: any) => (
                        <div key={cat} style={{ background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: "8px", fontSize: "0.82rem" }}>
                          <span style={{ color: "var(--text-dim)" }}>{cat}:</span>{" "}
                          <strong style={{ color: "#fff" }}>Rs. {amt.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* REPORT 4: MEMBERSHIPS & RENEWALS                         */}
            {/* ======================================================== */}
            {activeReport === "memberships" && membershipsData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "16px" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Active Memberships</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--accent-primary)", marginTop: "4px" }}>
                      {membershipsData.summary?.active}
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Expiring in Period</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
                      {membershipsData.summary?.expiringCount}
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Expired</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#f43f5e", marginTop: "4px" }}>
                      {membershipsData.summary?.expired}
                    </div>
                  </div>

                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", padding: "18px 20px" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>Frozen / On Hold</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#06b6d4", marginTop: "4px" }}>
                      {membershipsData.summary?.frozen}
                    </div>
                  </div>
                </div>

                {/* Expiring List Table */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "14px", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 700, fontSize: "0.95rem" }}>
                    Memberships Expiring in Selected Range
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                          <th style={{ padding: "12px 16px" }}>Member</th>
                          <th style={{ padding: "12px 16px" }}>Plan Name</th>
                          <th style={{ padding: "12px 16px" }}>Expiry Date</th>
                          <th style={{ padding: "12px 16px" }}>Status</th>
                          <th style={{ padding: "12px 16px" }}>Fee Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membershipsData.expiringMemberships?.map((m: any) => (
                          <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 700, color: "#fff" }}>{m.gymMember?.fullName}</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{m.gymMember?.memberId} • {m.gymMember?.phone}</div>
                            </td>
                            <td style={{ padding: "12px 16px" }}>{m.planName}</td>
                            <td style={{ padding: "12px 16px", color: "#f59e0b", fontWeight: 600 }}>
                              {formatDate(m.endDate)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)" }}>
                                {m.status}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                              Rs. {m.feeAmount?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(activeReport === "invoices" || activeReport === "attendance") && detailsData && <section className="glass-panel" style={{ padding: 20, overflowX: "auto" }}>{detailsData.error && <p role="alert">{detailsData.error}</p>}{detailsData.headers && <div className="table-scroll"><table className="data-table"><thead><tr>{detailsData.headers.map((heading: string) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{detailsData.rows.map((row: any[], index: number) => <tr key={index}>{row.map((value, column) => <td key={column}>{value}</td>)}</tr>)}</tbody></table></div>}</section>}
      {/* Drilldown Receipt Modal */}
      <ReceiptModal
        receiptId={selectedReceiptId}
        isOpen={!!selectedReceiptId}
        onClose={() => setSelectedReceiptId(null)}
        currentUserRole={currentUser.role}
        onReceiptUpdated={fetchCurrentReport}
      />
    </div>
  );
}
