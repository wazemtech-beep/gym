"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  TrendingDown,
  DollarSign,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CreditCard,
  Wallet,
  Building2,
  CheckCircle2,
  Tag
} from "lucide-react";
import CloudinaryUploadButton from "@/components/common/CloudinaryUploadButton";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCreated: () => void;
  categories: Array<{ id: string; name: string }>;
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onExpenseCreated,
  categories,
}: AddExpenseModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bank Accounts for payment source
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form Fields
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payee, setPayee] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSalaryMonth, setEmployeeSalaryMonth] = useState("");

  // Payment Options
  const [isPaidNow, setIsPaidNow] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receivingAccountId, setReceivingAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  // New Category inline creation
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (categories.length > 0 && !categoryId) {
        setCategoryId(categories[0].id);
      }
      fetchAccounts();
      apiFetch("/api/v1/payroll/employees").then(res => res.json()).then(data => setEmployees(data.employees || [])).catch(() => setEmployees([]));
    } else {
      resetForm();
    }
  }, [isOpen, categories, readCacheVersion]);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch("/api/v1/settings/accounts");
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts.filter((account: any) => account.isActive));
        if (data.accounts.length > 0 && !receivingAccountId) {
          setReceivingAccountId(data.accounts[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  const resetForm = () => {
    setEmployeeId("");
    setTitle("");
    setPayee("");
    setTotalAmount("");
    setPaymentAmount("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setNotes("");
    setAttachmentUrl("");
    setEmployeeSalaryMonth("");
    setIsPaidNow(true);
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setError(null);
    setShowAddCategory(false);
    setNewCatName("");
  };

  // Sync paymentAmount to totalAmount by default
  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    if (isPaidNow && (!paymentAmount || paymentAmount === totalAmount)) {
      setPaymentAmount(val);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await apiFetch("/api/v1/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (data.success && data.category) {
        categories.push(data.category);
        setCategoryId(data.category.id);
        setShowAddCategory(false);
        setNewCatName("");
      } else {
        alert(data.error || "Category create nahi ho saki.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedTotal = parseFloat(totalAmount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError("Total amount positive number honi chahiye.");
      return;
    }

    let parsedPayment = 0;
    if (isPaidNow) {
      parsedPayment = parseFloat(paymentAmount || totalAmount);
      if (isNaN(parsedPayment) || parsedPayment <= 0) {
        setError("Payment amount darj karein.");
        return;
      }
      if (parsedPayment > parsedTotal) {
        setError("Payment amount total expense se zyada nahi ho sakti.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        categoryId,
        payee: payee.trim(),
        totalAmount: parsedTotal,
        expenseDate,
        dueDate: !isPaidNow && dueDate ? dueDate : null,
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl.trim() || null,
        employeeId: isSalaryCategory ? employeeId : null,
        employeeSalaryMonth: employeeSalaryMonth.trim() || null,
        isPaidNow,
        paymentAmount: isPaidNow ? parsedPayment : 0,
        paymentMethod: isPaidNow ? paymentMethod : null,
        receivingAccountId: isPaidNow && paymentMethod !== "CASH" ? receivingAccountId : null,
        referenceNumber: isPaidNow ? referenceNumber.trim() : null,
      };

      const res = await apiFetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onExpenseCreated();
        onClose();
      } else {
        setError(data.error || "Expense save karne mein khata aayi.");
      }
    } catch (err: any) {
      setError("Network error while submitting expense.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedPaid = isPaidNow ? parseFloat(paymentAmount || totalAmount) || 0 : 0;
  const remainingPayable = Math.max(0, parsedTotal - parsedPaid);

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const isSalaryCategory = selectedCategoryObj?.name?.toLowerCase().includes("salar");

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
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(244, 63, 94, 0.12)",
                color: "#f43f5e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingDown size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Record Gym Expense
              </h3>
              
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {error && (
            <div
              style={{
                background: "var(--danger-soft)",
                border: "1px solid var(--danger-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "var(--danger)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Title & Category */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                Expense Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. October Building Rent, LESCO Bill, Dumbbells Purchase"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                  }}
                >
                  Category *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-primary)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showAddCategory ? "Cancel" : "+ New Category"}
                </button>
              </div>

              {showAddCategory ? (
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name..."
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-main)",
                      fontSize: "0.82rem",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={addingCat || !newCatName.trim()}
                    className="btn btn-primary"
                    style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.86rem",
                    outline: "none",
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Row 2: Payee/Vendor & Total Amount */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                Payee / Vendor Name *
              </label>
              <input
                type="text"
                required
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="Vendor or payee"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                Total Amount (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={totalAmount}
                onChange={(e) => handleTotalAmountChange(e.target.value)}
                placeholder="e.g. 15000"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {isSalaryCategory && <label className="form-label">Employee<select className="input-field" required value={employeeId} onChange={e => { setEmployeeId(e.target.value); setPayee(employees.find(staff => staff.id === e.target.value)?.name || ""); }}><option value="">Choose employee</option>{employees.map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role}</option>)}</select></label>}
          {/* If Salary: Employee Salary Month */}
          {isSalaryCategory && (
            <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: "#818cf8",
                  marginBottom: "6px",
                }}
              >
                Salary Month & Year
              </label>
              <input
                type="month"
                required
                value={employeeSalaryMonth}
                onChange={(e) => setEmployeeSalaryMonth(e.target.value)}
                placeholder="e.g. October 2026"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.84rem",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Row 3: Expense Date & Due Date */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                
                Expense date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.86rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Payment Status Segment */}
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)" }}>
                
                Payment status
              </div>
              <div
                style={{
                  display: "flex",
                  background: "var(--bg-surface)",
                  borderRadius: "8px",
                  padding: "2px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsPaidNow(true)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: isPaidNow ? "var(--accent-primary)" : "transparent",
                    color: isPaidNow ? "var(--text-inverse)" : "var(--text-muted)",
                  }}
                >
                  Pay Now
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaidNow(false)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    background: !isPaidNow ? "rgba(244, 63, 94, 0.2)" : "transparent",
                    color: !isPaidNow ? "#f43f5e" : "var(--text-muted)",
                  }}
                >
                  Unpaid (Payable)
                </button>
              </div>
            </div>

            {isPaidNow ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                      Amount Paid Now (PKR)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={totalAmount || "0"}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-main)",
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                      Payment Source
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-main)",
                        fontSize: "0.84rem",
                        outline: "none",
                      }}
                    >
                      <option value="CASH">Cash drawer</option>
                      <option value="BANK_TRANSFER">Bank account</option>
                      <option value="EASYPAISA">Easypaisa</option>
                      <option value="JAZZCASH">JazzCash</option>
                    </select>
                  </div>
                </div>

                {/* Additional source account / ref */}
                {paymentMethod !== "CASH" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                        Bank Account Source
                      </label>
                      <select
                        value={receivingAccountId}
                        onChange={(e) => setReceivingAccountId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-main)",
                          fontSize: "0.84rem",
                          outline: "none",
                        }}
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.displayName} ({acc.accountTitle})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "4px" }}>
                        
                        Transaction reference (optional)
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="TRX-123456 or Cheque #987"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-main)",
                          fontSize: "0.84rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "CASH" && (
                  <div style={{ fontSize: "0.74rem", color: "var(--accent-primary)" }}>
                    
                    Deducted from the current cash drawer.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                Remains in <strong>Outstanding Payables</strong> until paid.
              </div>
            )}
          </div>

          {/* Financial Breakdown Preview */}
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.82rem",
            }}
          >
            <div>
              <span style={{ color: "var(--text-dim)" }}>Total Charge:</span>{" "}
              <strong style={{ color: "var(--text-main)" }}>Rs. {parsedTotal.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>Paid Outflow:</span>{" "}
              <strong style={{ color: "var(--accent-primary)" }}>Rs. {parsedPaid.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>Remaining Payable:</span>{" "}
              <strong style={{ color: remainingPayable > 0 ? "#f43f5e" : "var(--accent-primary)" }}>
                Rs. {remainingPayable.toLocaleString()}
              </strong>
            </div>
          </div>

          {/* Notes & Attachment */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Notes / Purpose
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.84rem",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                Bill / Invoice Receipt Attachment (Cloudinary)
              </label>
              <CloudinaryUploadButton
                folder="expenses"
                currentUrl={attachmentUrl}
                label="Upload Bill / Receipt to Cloudinary"
                onUploadSuccess={(data) => setAttachmentUrl(data.url)}
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: "8px 24px", fontWeight: 700 }}
            >
              {submitting ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
