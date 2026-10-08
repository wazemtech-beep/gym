"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  Building2,
  Calendar,
  Eye,
  ShieldAlert,
  ArrowUpDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wallet
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import ReceiptModal from "./ReceiptModal";

interface ReceiptsDirectoryClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export default function ReceiptsDirectoryClient({ currentUser }: ReceiptsDirectoryClientProps) {
  const readCacheVersion = useReadCacheVersion();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    confirmedCount: 0,
    cashTotal: 0,
    bankTotal: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("this_month");

  // Selected receipt for modal
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        method,
        status,
        dateRange,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await apiFetch(`/api/v1/receipts?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setReceipts(data.receipts || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to load receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [search, method, status, dateRange, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts, readCacheVersion]);

  const handleOpenReceipt = (id: string) => {
    setSelectedReceiptId(id);
    setIsModalOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Receipt size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Receipts
              </h1>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchReceipts()}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}
          title="Refresh List"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
          gap: "16px",
        }}
      >
        {/* Total Confirmed Revenue */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "18px 20px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                Confirmed Collections
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "4px" }}>
                Rs. {stats.totalRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {stats.confirmedCount} issued receipts
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        {/* Cash Inflow */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                
                Cash received
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "4px" }}>
                Rs. {stats.cashTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Desk drawer collections
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={20} />
            </div>
          </div>
        </div>

        {/* Bank & Digital Transfers */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                
                Bank & wallet
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#06b6d4", marginTop: "4px" }}>
                Rs. {stats.bankTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Meezan, JazzCash, Easypaisa
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--accent-soft)",
                color: "#06b6d4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "min(100%, 260px)" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={16}
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
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              placeholder="Search by receipt # (e.g. OXG-RCP-000104), member name, ID, or TRX ref..."
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Date range pills */}
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
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "all", label: "All Time" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDateRange(d.id);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: dateRange === d.id ? "var(--accent-primary)" : "transparent",
                  color: dateRange === d.id ? "var(--text-inverse)" : "var(--text-muted)",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Payment Method Selector */}
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.82rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="JAZZCASH">JazzCash</option>
          </select>

          {/* Status Selector */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.82rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.86rem" }}>
            <thead>
              <tr
                style={{
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "14px 18px" }}>Receipt # & Date</th>
                <th style={{ padding: "14px 18px" }}>Member Details</th>
                <th style={{ padding: "14px 18px" }}>Method & Account</th>
                <th style={{ padding: "14px 18px" }}>Amount (PKR)</th>
                <th style={{ padding: "14px 18px" }}>Allocated Against</th>
                <th style={{ padding: "14px 18px" }}>Recorded By</th>
                <th style={{ padding: "14px 18px" }}>Status</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    <Receipt className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
                    Receipts load ho rahi hain...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    Koi receipts nahi milin.
                  </td>
                </tr>
              ) : (
                receipts.map((rcpt) => {
                  const isRev = rcpt.status === "REVERSED";
                  const member = rcpt.gymMember;
                  const firstAllocation = rcpt.allocations?.[0];

                  return (
                    <tr
                      key={rcpt.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.15s ease",
                        opacity: isRev ? 0.75 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Receipt # & Date */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "var(--accent-primary)", letterSpacing: "0.02em" }}>
                          {rcpt.receiptNumber}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                          {formatDateTime(rcpt.paymentDate)}
                        </div>
                      </td>

                      {/* Member */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                          {member?.fullName || "Walk-in Guest"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                          {member?.memberId || "No ID"} • {member?.phone || ""}
                        </div>
                      </td>

                      {/* Method & Account */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {rcpt.method?.replace("_", " ")}
                        </div>
                        {rcpt.referenceNumber ? (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Ref: <code>{rcpt.referenceNumber}</code>
                          </div>
                        ) : rcpt.receivingAccount ? (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            {rcpt.receivingAccount.displayName}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            Desk Drawer
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: "14px 18px" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            color: isRev ? "var(--danger)" : "var(--accent-primary)",
                          }}
                        >
                          Rs. {rcpt.amount?.toLocaleString()}
                        </div>
                      </td>

                      {/* Allocation */}
                      <td style={{ padding: "14px 18px" }}>
                        {firstAllocation ? (
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                              {firstAllocation.invoice?.invoiceNumber}
                            </span>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-dim)" }}>
                              {firstAllocation.invoice?.title} (Bal: Rs.{" "}
                              {firstAllocation.invoice?.balanceAmount?.toLocaleString()})
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>General</span>
                        )}
                      </td>

                      {/* Recorded By */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-main)" }}>
                          {rcpt.recordedBy?.name || "System"}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                          {rcpt.recordedBy?.role || ""}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {isRev ? (
                          <span
                            style={{
                              background: "var(--danger-soft)",
                              color: "var(--danger)",
                              border: "1px solid var(--danger-border)",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            REVERSED
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "var(--accent-soft)",
                              color: "var(--accent-primary)",
                              border: "1px solid var(--border-accent)",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            CONFIRMED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <button
                          onClick={() => handleOpenReceipt(rcpt.id)}
                          style={{
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            color: "var(--text-main)",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Printer size={14} />
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Showing <strong>{receipts.length}</strong> of <strong>{pagination.totalCount}</strong> receipts
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                padding: "6px 10px",
                color: pagination.page <= 1 ? "var(--text-dim)" : "var(--text-main)",
                cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                padding: "6px 10px",
                color: pagination.page >= pagination.totalPages ? "var(--text-dim)" : "var(--text-main)",
                cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modal */}
      <ReceiptModal
        receiptId={selectedReceiptId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserRole={currentUser.role}
        onReceiptUpdated={fetchReceipts}
      />
    </div>
  );
}
