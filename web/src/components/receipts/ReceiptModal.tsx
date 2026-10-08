"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle2,
  Receipt as ReceiptIcon,
  Building2,
  Calendar,
  CreditCard,
  User,
  ShieldAlert,
  FileText,
  Copy,
  Check
} from "lucide-react";
import { formatDateTime, formatThermalDate } from "@/lib/formatters";

interface ReceiptModalProps {
  receiptId: string | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  onReceiptUpdated?: () => void;
}

export default function ReceiptModal({
  receiptId,
  isOpen,
  onClose,
  currentUserRole,
  onReceiptUpdated,
}: ReceiptModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"A4" | "THERMAL">("A4");

  // Reversal State
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && receiptId) {
      fetchReceipt(receiptId);
    } else {
      setReceiptData(null);
      setError(null);
      setShowReverseModal(false);
      setReversalReason("");
    }
  }, [isOpen, receiptId, readCacheVersion]);

  const fetchReceipt = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/receipts/${id}`);
      const data = await res.json();
      if (data.success) {
        setReceiptData(data.receipt);
      } else {
        setError(data.error || "Receipt load nahi ho saki.");
      }
    } catch (err: any) {
      setError("Receipt fetch karne mein network khata aayi.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (!receiptData) return;
    const shareText = `OXGEN GYM Confirmed Payment Receipt #${receiptData.receiptNumber}\nMember: ${receiptData.gymMember?.fullName} (${receiptData.gymMember?.memberId})\nAmount: Rs. ${receiptData.amount?.toLocaleString()}\nDate: ${formatDateTime(receiptData.paymentDate)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleReversePayment = async () => {
    if (!reversalReason.trim()) {
      alert("Payment reverse karne ki waja (reason) likhna lazmi hai.");
      return;
    }

    setReversing(true);
    try {
      const res = await apiFetch(`/api/v1/receipts/${receiptData.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowReverseModal(false);
        setReversalReason("");
        await fetchReceipt(receiptData.id);
        if (onReceiptUpdated) onReceiptUpdated();
      } else {
        alert(data.error || "Reversal fail ho gaya.");
      }
    } catch {
      alert("Reversal request bhejne mein network masla aaya.");
    } finally {
      setReversing(false);
    }
  };

  if (!isOpen) return null;

  const isReversed = receiptData?.status === "REVERSED";

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
      {/* Print-specific style tags */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt-area,
          #printable-receipt-area * {
            visibility: visible !important;
          }
          #printable-receipt-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: layoutMode === "A4" ? "820px" : "440px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          transition: "max-width 0.25s ease",
        }}
      >
        {/* Top Control Bar (Hidden during print) */}
        <div
          className="no-print"
          style={{
            padding: "16px 20px",
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
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ReceiptIcon size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                  {receiptData ? receiptData.receiptNumber : "Payment Receipt"}
                </h3>
                {isReversed && (
                  <span
                    style={{
                      background: "var(--danger-soft)",
                      color: "var(--danger)",
                      border: "1px solid var(--danger-border)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    REVERSED
                  </span>
                )}
              </div>
              
            </div>
          </div>

          {/* Action buttons & mode toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Format toggle */}
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
                onClick={() => setLayoutMode("A4")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: layoutMode === "A4" ? "var(--accent-primary)" : "transparent",
                  color: layoutMode === "A4" ? "var(--text-inverse)" : "var(--text-muted)",
                }}
              >
                A4 PDF
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("THERMAL")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: layoutMode === "THERMAL" ? "var(--accent-primary)" : "transparent",
                  color: layoutMode === "THERMAL" ? "var(--text-inverse)" : "var(--text-muted)",
                }}
              >
                80mm POS
              </button>
            </div>

            <button
              onClick={() => {
                const format = layoutMode === "THERMAL" ? "THERMAL_80MM" : "A4";
                window.open(`/api/v1/receipts/${receiptData.id}/download?format=${format}`, "_blank");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--accent-primary)",
                border: "none",
                color: "#ffffff",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Download Vector PDF"
            >
              <Download size={15} />
              PDF
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Print Receipt"
            >
              <Printer size={15} />
              Print
            </button>

            <button
              onClick={handleShare}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                color: copied ? "var(--accent-primary)" : "var(--text-main)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Copy Summary"
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              {copied ? "Copied" : "Share"}
            </button>

            {/* Reverse Receipt Button (Owner only, confirmed only) */}
            {currentUserRole === "OWNER" && !isReversed && receiptData && (
              <button
                onClick={() => setShowReverseModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Reverse confirmed payment"
              >
                <ShieldAlert size={15} />
                Reverse
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            background: "var(--bg-surface)",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
              <ReceiptIcon className="animate-spin" size={36} style={{ margin: "0 auto 12px" }} />
              <p>Confirmed receipt load ho rahi hai...</p>
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "var(--danger-soft)",
                borderRadius: "12px",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
              }}
            >
              <AlertTriangle size={32} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 600 }}>{error}</p>
            </div>
          ) : receiptData ? (
            <div id="printable-receipt-area">
              {/* ========================================================= */}
              {/* LAYOUT A: A4 ELEGANT CLEAN INVOICE RECEIPT                */}
              {/* ========================================================= */}
              {layoutMode === "A4" ? (
                <div
                  style={{
                    background: "#ffffff",
                    color: "#0f172a",
                    borderRadius: "12px",
                    padding: "36px 40px",
                    fontFamily: "Inter, system-ui, sans-serif",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    position: "relative",
                  }}
                >
                  {/* Reversed Watermark */}
                  {isReversed && (
                    <div
                      style={{
                        position: "absolute",
                        top: "40%",
                        left: "50%",
                        transform: "translate(-50%, -50%) rotate(-25deg)",
                        fontSize: "5.5rem",
                        fontWeight: 900,
                        color: "rgba(239, 68, 68, 0.12)",
                        letterSpacing: "0.2em",
                        pointerEvents: "none",
                        userSelect: "none",
                        border: "6px dashed rgba(239, 68, 68, 0.2)",
                        padding: "10px 40px",
                        borderRadius: "16px",
                      }}
                    >
                      REVERSED
                    </div>
                  )}

                  {/* Header: Gym Info & Receipt Meta */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      borderBottom: "2px solid #e2e8f0",
                      paddingBottom: "24px",
                      marginBottom: "24px",
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          fontSize: "1.75rem",
                          fontWeight: 900,
                          letterSpacing: "-0.03em",
                          color: "#0f172a",
                          margin: "0 0 4px",
                        }}
                      >
                        {receiptData.gymInfo?.name || "OXGEN GYM"}
                      </h1>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.4 }}>
                        <div>{receiptData.gymInfo?.tagline || "Strength & Performance"}</div>
                        <div>{receiptData.gymInfo?.address || "Gulberg III, Lahore, Pakistan"}</div>
                        <div>
                          Tel: {receiptData.gymInfo?.phone} | Email: {receiptData.gymInfo?.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 800,
                          color: isReversed ? "#ef4444" : "#10b981",
                          letterSpacing: "0.02em",
                        }}
                      >
                        PAYMENT RECEIPT
                      </div>
                      <div
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "#1e293b",
                          marginTop: "2px",
                        }}
                      >
                        {receiptData.receiptNumber}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                        Payment Date:{" "}
                        <strong>{formatDateTime(receiptData.paymentDate)}</strong>
                      </div>
                      {receiptData.createdAt && (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          Issued on: {formatDateTime(receiptData.createdAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reversal Banner if reversed */}
                  {isReversed && (
                    <div
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        marginBottom: "20px",
                        color: "#991b1b",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "0.85rem" }}>
                        <ShieldAlert size={16} color="#ef4444" />
                        This payment has been REVERSED and original invoice balance restored.
                      </div>
                      <div style={{ fontSize: "0.78rem", marginTop: "4px", color: "#7f1d1d" }}>
                        <strong>Reason:</strong> {receiptData.reversalReason || "Unspecified"} |{" "}
                        <strong>Reversed on:</strong>{" "}
                        {formatDateTime(receiptData.reversedAt)}{" "}
                        {receiptData.reversedBy && `by ${receiptData.reversedBy.name}`}
                      </div>
                    </div>
                  )}

                  {/* Member & Payment Info Grid */}
                  <div className="responsive-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "24px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      padding: "18px 20px",
                      marginBottom: "24px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.05em",
                          marginBottom: "4px",
                        }}
                      >
                        Received From (Member)
                      </div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                        {receiptData.gymMember?.fullName}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "2px" }}>
                        Member ID: <strong>{receiptData.gymMember?.memberId}</strong>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {receiptData.gymMember?.phone}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.05em",
                          marginBottom: "4px",
                        }}
                      >
                        Payment Details
                      </div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                        Method:{" "}
                        <span style={{ color: "#0284c7" }}>
                          {receiptData.method?.replace("_", " ")}
                        </span>
                      </div>
                      {receiptData.referenceNumber && (
                        <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "2px" }}>
                          Trx Ref: <code>{receiptData.referenceNumber}</code>
                        </div>
                      )}
                      {receiptData.receivingAccount && (
                        <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                          Deposited to: {receiptData.receivingAccount.displayName} (
                          {receiptData.receivingAccount.accountTitle})
                        </div>
                      )}
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                        Verified by:{" "}
                        <strong>{receiptData.recordedBy?.name || "System Staff"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Allocations Table */}
                  <div style={{ marginBottom: "28px" }}>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "#475569",
                        letterSpacing: "0.04em",
                        marginBottom: "10px",
                      }}
                    >
                      Payment Allocation & Invoice Breakdown
                    </div>

                    <div className="table-scroll"><table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.85rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: "2px solid #cbd5e1",
                            background: "#f1f5f9",
                            textAlign: "left",
                          }}
                        >
                          <th style={{ padding: "10px 12px", color: "#334155" }}>Invoice #</th>
                          <th style={{ padding: "10px 12px", color: "#334155" }}>Description / Plan</th>
                          <th style={{ padding: "10px 12px", color: "#334155", textAlign: "right" }}>
                            Invoice Total
                          </th>
                          <th style={{ padding: "10px 12px", color: "#334155", textAlign: "right" }}>
                            Allocated Now
                          </th>
                          <th style={{ padding: "10px 12px", color: "#334155", textAlign: "right" }}>
                            Remaining Dues
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptData.allocations?.map((alloc: any, idx: number) => {
                          const inv = alloc.invoice;
                          return (
                            <tr
                              key={alloc.id || idx}
                              style={{
                                borderBottom: "1px solid #e2e8f0",
                              }}
                            >
                              <td style={{ padding: "12px", fontWeight: 700, color: "#1e293b" }}>
                                {inv?.invoiceNumber || "N/A"}
                              </td>
                              <td style={{ padding: "12px", color: "#334155" }}>
                                <div>{inv?.title || "Membership Fee"}</div>
                                {inv?.membership?.planName && (
                                  <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    Plan: {inv.membership.planName}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", color: "#475569" }}>
                                Rs. {inv?.totalAmount?.toLocaleString() || "0"}
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: isReversed ? "#ef4444" : "#10b981",
                                }}
                              >
                                Rs. {alloc.amount?.toLocaleString()}
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", color: "#64748b" }}>
                                Rs. {inv?.balanceAmount?.toLocaleString() || "0"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table></div>
                  </div>

                  {/* Summary Block */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      borderTop: "2px solid #e2e8f0",
                      paddingTop: "18px",
                      marginBottom: "32px",
                    }}
                  >
                    <div style={{ maxWidth: "340px", fontSize: "0.78rem", color: "#64748b" }}>
                      <p style={{ margin: "0 0 4px" }}>
                        Snapshot at payment confirmation. Check the member profile for current balances.
                      </p>
                      {receiptData.memberRemainingDues !== undefined && receiptData.memberRemainingDues !== null && (
                        <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#475569" }}>
                          Member Total Dues After Payment: Rs. {receiptData.memberRemainingDues.toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        background: isReversed ? "#fef2f2" : "#f0fdf4",
                        border: isReversed ? "1px solid #fecaca" : "1px solid #bbf7d0",
                        borderRadius: "10px",
                        padding: "14px 20px",
                        minWidth: "240px",
                        textAlign: "right",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: isReversed ? "#991b1b" : "#166534",
                        }}
                      >
                        Total Amount Received
                      </div>
                      <div
                        style={{
                          fontSize: "1.6rem",
                          fontWeight: 900,
                          color: isReversed ? "#ef4444" : "#15803d",
                        }}
                      >
                        Rs. {receiptData.amount?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                        Status: <strong>{receiptData.status}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Authorized Stamp & Footer */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px dashed #cbd5e1",
                      paddingTop: "16px",
                      fontSize: "0.72rem",
                      color: "#94a3b8",
                    }}
                  >
                    
                    <div style={{ textAlign: "right" }}>
                      Recorded by: {receiptData.recordedBy?.name || "Reception Desk"}
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================= */
                /* LAYOUT B: 80MM THERMAL POS RECEIPT LAYOUT                 */
                /* ========================================================= */
                <div
                  style={{
                    background: "#ffffff",
                    color: "#000000",
                    width: "300px",
                    maxWidth: "100%",
                    margin: "0 auto",
                    padding: "24px 16px",
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: "12px",
                    lineHeight: 1.4,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    borderRadius: "4px",
                  }}
                >
                  {/* Gym Header */}
                  <div style={{ textAlign: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                      *** {receiptData.gymInfo?.name || "OXGEN GYM"} ***
                    </div>
                    <div>{receiptData.gymInfo?.address || "Gulberg III, Lahore"}</div>
                    <div>Phone: {receiptData.gymInfo?.phone}</div>
                    <div style={{ margin: "6px 0", borderBottom: "1px dashed #000" }} />
                    <div style={{ fontSize: "13px", fontWeight: "bold" }}>
                      {isReversed ? "RECEIPT (REVERSED)" : "PAYMENT RECEIPT"}
                    </div>
                  </div>

                  {/* Reversal Alert on Thermal */}
                  {isReversed && (
                    <div
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        margin: "6px 0",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      !!! REVERSED !!!
                      <div style={{ fontSize: "10px" }}>{receiptData.reversalReason}</div>
                    </div>
                  )}

                  {/* Meta details */}
                  <div style={{ marginBottom: "8px" }}>
                    <div>RCPT #: {receiptData.receiptNumber}</div>
                    <div>DATE : {formatThermalDate(receiptData.paymentDate)}</div>
                    <div>
                      MEMBER: {receiptData.gymMember?.fullName?.toUpperCase()}
                    </div>
                    <div>MEM ID: {receiptData.gymMember?.memberId}</div>
                    <div>METHOD: {receiptData.method?.replace("_", " ")}</div>
                    {receiptData.referenceNumber && (
                      <div>REF   : {receiptData.referenceNumber}</div>
                    )}
                  </div>

                  <div style={{ margin: "6px 0", borderBottom: "1px dashed #000" }} />

                  {/* Allocation items */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                      <span>ITEM / INVOICE</span>
                      <span>PAID</span>
                    </div>
                    <div style={{ margin: "3px 0", borderBottom: "1px dotted #000" }} />

                    {receiptData.allocations?.map((alloc: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{alloc.invoice?.invoiceNumber || "INV-FEE"}</span>
                          <span>Rs. {alloc.amount?.toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#333" }}>
                          {alloc.invoice?.title || "Membership"} (Bal: Rs.{" "}
                          {alloc.invoice?.balanceAmount?.toLocaleString() || "0"})
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ margin: "6px 0", borderBottom: "1px dashed #000" }} />

                  {/* Total */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                      fontWeight: "bold",
                      margin: "8px 0",
                    }}
                  >
                    <span>TOTAL RECEIVED:</span>
                    <span>Rs. {receiptData.amount?.toLocaleString()}</span>
                  </div>

                  <div style={{ margin: "6px 0", borderBottom: "1px dashed #000" }} />

                  {/* Thermal Footer */}
                  <div style={{ textAlign: "center", fontSize: "11px", marginTop: "12px" }}>
                    <div>Served by: {receiptData.recordedBy?.name || "Staff"}</div>
                    <div style={{ marginTop: "6px" }}>Thank You For Training!</div>
                    <div style={{ fontSize: "9px", marginTop: "4px" }}>
                      {receiptData.receiptNumber}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div
          className="no-print"
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
            Tip: Press <strong>Print</strong> to generate hardcopy or save PDF via browser dialog.
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: "6px 16px", fontSize: "0.85rem" }}
          >
            Close
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* OWNER REVERSAL CONFIRMATION MODAL                         */}
      {/* ========================================================= */}
      {showReverseModal && (
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
              maxWidth: "480px",
              background: "var(--bg-surface)",
              borderRadius: "14px",
              border: "1px solid var(--danger-border)",
              padding: "24px",
              boxShadow: "none",
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
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--danger)" }}>
                  Reverse Confirmed Payment?
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", margin: 0 }}>
                  Receipt #{receiptData?.receiptNumber} (Rs. {receiptData?.amount?.toLocaleString()})
                </p>
              </div>
            </div>

            <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "16px" }}>
              Yeh action original receipt ko <strong>REVERSED</strong> mark karega aur linked invoices ka
              balance dobaara restore kar dega. Pehle se issued receipt number preserve rahega.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: "6px",
                }}
              >
                Reversal Reason (Lazmi)*
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Misentry by staff, wrong member account, duplicate entry, etc..."
                rows={3}
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
                onClick={() => setShowReverseModal(false)}
                className="btn btn-secondary"
                disabled={reversing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReversePayment}
                disabled={reversing || !reversalReason.trim()}
                style={{
                  background: "var(--danger)",
                  color: "var(--text-main)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: reversing || !reversalReason.trim() ? "not-allowed" : "pointer",
                  opacity: reversing || !reversalReason.trim() ? 0.6 : 1,
                }}
              >
                {reversing ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </ModalOverlay>
  );
}
