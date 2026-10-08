"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import { formatDate } from "@/lib/formatters";
import AddExpenseModal from "./AddExpenseModal";
import RecordExpensePaymentModal from "./RecordExpensePaymentModal";
import RecordVendorRefundModal from "./RecordVendorRefundModal";

interface ExpensesDirectoryClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export default function ExpensesDirectoryClient({ currentUser }: ExpensesDirectoryClientProps) {
  const readCacheVersion = useReadCacheVersion();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRecorded: 0,
    totalPaid: 0,
    outstandingPayable: 0,
    overduePayable: 0,
    categoryTotals: {} as Record<string, number>,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("this_month");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [paymentModalExpense, setPaymentModalExpense] = useState<any | null>(null);
  const [refundModalExpense, setRefundModalExpense] = useState<any | null>(null);

  // Void confirmation state
  const [voidExpenseItem, setVoidExpenseItem] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Copy state
  const [cloningId, setCloningId] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        categoryId,
        status,
        dateRange,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await apiFetch(`/api/v1/expenses?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setExpenses(data.expenses || []);
        if (data.categories) setCategories(data.categories);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, status, dateRange, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, readCacheVersion]);

  const handleCopyExpense = async (exp: any) => {
    if (!confirm(`Kya aap expense '${exp.title}' ko next record ke liye copy/clone karna chahte hain?`)) {
      return;
    }

    setCloningId(exp.id);
    try {
      const res = await apiFetch(`/api/v1/expenses/${exp.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchExpenses();
      } else {
        alert(data.error || "Expense clone nahi ho saka.");
      }
    } catch {
      alert("Clone request fail ho gayi.");
    } finally {
      setCloningId(null);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidExpenseItem) return;
    setVoiding(true);
    try {
      const res = await apiFetch(`/api/v1/expenses/${voidExpenseItem.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() || "Voided by owner" }),
      });
      const data = await res.json();
      if (data.success) {
        setVoidExpenseItem(null);
        setVoidReason("");
        fetchExpenses();
      } else {
        alert(data.error || "Expense void nahi ho saka.");
      }
    } catch {
      alert("Void request fail ho gayi.");
    } finally {
      setVoiding(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
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
                background: "rgba(244, 63, 94, 0.12)",
                color: "#f43f5e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingDown size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Expenses
              </h1>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => fetchExpenses()}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem" }}
            title="Refresh List"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700 }}
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Financial Executive Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "16px",
        }}
      >
        {/* Total Recorded Expenses */}
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
                Total Recorded Expenses
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
                Rs. {stats.totalRecorded.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Selected period charges
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--bg-secondary)",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingDown size={22} />
            </div>
          </div>
        </div>

        {/* Actual Paid Outflow */}
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
                Actual Payments Made
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent-primary)", marginTop: "4px" }}>
                Rs. {stats.totalPaid.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Real cash & bank outflow
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

        {/* Outstanding Payables */}
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
                Outstanding Payables
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: stats.outstandingPayable > 0 ? "var(--amber-primary)" : "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Rs. {stats.outstandingPayable.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                Bills pending payment
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--amber-soft)",
                color: "var(--amber-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Overdue Payables */}
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
                Overdue Payables
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: stats.overduePayable > 0 ? "#f43f5e" : "var(--accent-primary)",
                  marginTop: "4px",
                }}
              >
                Rs. {stats.overduePayable.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {stats.overduePayable > 0 ? "Deadline crossed!" : "Zero overdue obligations"}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: stats.overduePayable > 0 ? "rgba(244, 63, 94, 0.12)" : "var(--accent-soft)",
                color: stats.overduePayable > 0 ? "#f43f5e" : "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Strip */}
      {Object.keys(stats.categoryTotals).length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
            
            Expenses by category
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {Object.entries(stats.categoryTotals).map(([cat, amt]) => (
              <div
                key={cat}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>{cat}:</span>
                <strong style={{ color: "var(--text-main)" }}>Rs. {amt.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
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
              placeholder="Search expenses or payee"
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

          {/* Category Dropdown */}
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
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
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
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
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="VOID">Void</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
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
                <th style={{ padding: "14px 18px" }}>Expense # & Date</th>
                <th style={{ padding: "14px 18px" }}>Title & Category</th>
                <th style={{ padding: "14px 18px" }}>Payee / Vendor</th>
                <th style={{ padding: "14px 18px" }}>Total Amount</th>
                <th style={{ padding: "14px 18px" }}>Paid & Balance</th>
                <th style={{ padding: "14px 18px" }}>Due Date</th>
                <th style={{ padding: "14px 18px" }}>Status</th>
                <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    <TrendingDown className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
                    Expenses load ho rahe hain...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                    Koi expenses record nahi mile.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => {
                  const isVoid = exp.status === "VOID";
                  const isOverdue =
                    exp.balanceAmount > 0 && exp.dueDate && new Date(exp.dueDate) < new Date();

                  return (
                    <tr
                      key={exp.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.15s ease",
                        opacity: isVoid ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Expense # & Date */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{exp.expenseNumber}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                          {formatDate(exp.expenseDate)}
                        </div>
                      </td>

                      {/* Title & Category */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{exp.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--bg-secondary)",
                              color: "var(--text-dim)",
                              fontWeight: 600,
                            }}
                          >
                            {exp.category?.name || "Other"}
                          </span>
                          {exp.employeeSalaryMonth && (
                            <span style={{ fontSize: "0.7rem", color: "#818cf8" }}>
                              {exp.employeeSalaryMonth}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payee */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{exp.payee}</div>
                        {exp.notes && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {exp.notes}
                          </div>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
                          Rs. {exp.totalAmount?.toLocaleString()}
                        </div>
                      </td>

                      {/* Paid & Balance */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: "0.82rem", color: "var(--accent-primary)", fontWeight: 700 }}>
                          Paid: Rs. {exp.paidAmount?.toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: exp.balanceAmount > 0 ? "#f43f5e" : "var(--text-dim)",
                            fontWeight: exp.balanceAmount > 0 ? 700 : 400,
                            marginTop: "2px",
                          }}
                        >
                          Due: Rs. {exp.balanceAmount?.toLocaleString()}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: "14px 18px" }}>
                        {exp.dueDate ? (
                          <div>
                            <div style={{ fontSize: "0.82rem", color: isOverdue ? "#f43f5e" : "var(--text-main)", fontWeight: isOverdue ? 700 : 400 }}>
                              {formatDate(exp.dueDate)}
                            </div>
                            {isOverdue && (
                              <span style={{ fontSize: "0.68rem", color: "#f43f5e", fontWeight: 700 }}>
                                Overdue!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {exp.status === "PAID" && (
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
                            PAID
                          </span>
                        )}
                        {exp.status === "PARTIALLY_PAID" && (
                          <span
                            style={{
                              background: "var(--amber-soft)",
                              color: "var(--amber-primary)",
                              border: "1px solid var(--amber-border)",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            PARTIAL
                          </span>
                        )}
                        {exp.status === "UNPAID" && (
                          <span
                            style={{
                              background: "rgba(244, 63, 94, 0.15)",
                              color: "#f43f5e",
                              border: "1px solid rgba(244, 63, 94, 0.3)",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            UNPAID
                          </span>
                        )}
                        {exp.status === "VOID" && (
                          <span
                            style={{
                              background: "rgba(148, 163, 184, 0.15)",
                              color: "#94a3b8",
                              border: "1px solid rgba(148, 163, 184, 0.3)",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            VOID
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* Add payment button if balance remains */}
                          {exp.balanceAmount > 0 && exp.status !== "VOID" && (
                            <button
                              onClick={() => setPaymentModalExpense(exp)}
                              style={{
                                background: "var(--accent-soft)",
                                border: "1px solid var(--border-accent)",
                                color: "var(--accent-primary)",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Record payment against this expense"
                            >
                              Add Payment
                            </button>
                          )}

                          {/* Vendor Refund if paidAmount > 0 */}
                          {exp.paidAmount > 0 && exp.status !== "VOID" && (
                            <button
                              onClick={() => setRefundModalExpense(exp)}
                              style={{
                                background: "rgba(245, 158, 11, 0.15)",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                color: "#f59e0b",
                                borderRadius: "6px",
                                padding: "5px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                              title="Record vendor refund or payment correction"
                            >
                              <RotateCcw size={12} />
                              <span>Refund</span>
                            </button>
                          )}

                          {/* 1-click Clone/Copy previous expense */}
                          <button
                            onClick={() => handleCopyExpense(exp)}
                            disabled={cloningId === exp.id}
                            style={{
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-main)",
                              borderRadius: "6px",
                              padding: "5px 8px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Copy/Clone for new month"
                          >
                            <Copy size={13} />
                            <span>Copy</span>
                          </button>

                          {/* Void button (Owner only, if unpaid) */}
                          {currentUser.role === "OWNER" && exp.paidAmount === 0 && exp.status !== "VOID" && (
                            <button
                              onClick={() => setVoidExpenseItem(exp)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-dim)",
                                cursor: "pointer",
                                padding: "5px",
                                borderRadius: "6px",
                              }}
                              title="Void duplicate or incorrect expense"
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
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
            Showing <strong>{expenses.length}</strong> of <strong>{pagination.totalCount}</strong> expenses
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

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onExpenseCreated={fetchExpenses}
        categories={categories}
      />

      {/* Record Payment Modal */}
      <RecordExpensePaymentModal
        expense={paymentModalExpense}
        isOpen={!!paymentModalExpense}
        onClose={() => setPaymentModalExpense(null)}
        onPaymentRecorded={fetchExpenses}
      />

      {/* Record Vendor Refund Modal */}
      <RecordVendorRefundModal
        expense={refundModalExpense}
        isOpen={!!refundModalExpense}
        onClose={() => setRefundModalExpense(null)}
        onRefundRecorded={fetchExpenses}
      />

      {/* Void Confirmation Modal */}
      {voidExpenseItem && (
        <ModalOverlay className="modal-backdrop" role="dialog" aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--bg-secondary)",
            backdropFilter: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid var(--danger-border)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--danger)" }}>
                  Void Unpaid Expense?
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0 }}>
                  {voidExpenseItem.expenseNumber} • {voidExpenseItem.title}
                </p>
              </div>
            </div>

            <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "16px" }}>
              Yeh action is unpaid expense ko <strong>VOID</strong> mark kar dega. Record audit trail ke
              saath preserve rahega aur reports mein count nahi hoga.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Void Reason (Waja)*
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Duplicate entry, wrong vendor, cancelled service, etc..."
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setVoidExpenseItem(null)}
                className="btn btn-secondary"
                disabled={voiding}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voiding}
                style={{
                  background: "var(--danger)",
                  color: "var(--text-main)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {voiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
