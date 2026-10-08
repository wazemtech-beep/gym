"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Lock,
  Clock,
  ArrowRight,
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

export default function AuditLogsViewer() {
  const readCacheVersion = useReadCacheVersion();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [actorId, setActorId] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter options from backend
  const [availableActors, setAvailableActors] = useState<any[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Expanded log IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "25");

      if (search.trim()) params.set("search", search.trim());
      if (actorId !== "ALL") params.set("actorId", actorId);
      if (entityType !== "ALL") params.set("entityType", entityType);
      if (action !== "ALL") params.set("action", action);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await apiFetch(`/api/v1/audit?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load audit logs.");
      }

      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotalRecords(data.pagination.total);

      if (data.filters) {
        setAvailableActors(data.filters.actors || []);
        setAvailableEntities(data.filters.availableEntityTypes || []);
        setAvailableActions(data.filters.availableActions || []);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actorId, entityType, action, readCacheVersion]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch("");
    setActorId("ALL");
    setEntityType("ALL");
    setAction("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Header & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
              System Audit Trail & History
            </h3>
            <span
              className="badge"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-primary)",
                border: "1px solid var(--border-accent)",
              }}
            >
              Tamper-Evident Ledger
            </span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Owner actions, financial corrections, staff access changes aur status updates ka muqammal record.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          title="Refresh logs"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          background: "var(--bg-surface)",
        }}
      >
        <form onSubmit={handleSearchSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "32px", fontSize: "0.82rem" }}
                placeholder="Search action, details, actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Actor Filter */}
            <select
              aria-label="Filter by actor"
              className="form-input"
              style={{ fontSize: "0.82rem" }}
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Staff & Actors</option>
              {availableActors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>

            {/* Module Filter */}
            <select
              aria-label="Filter by module"
              className="form-input"
              style={{ fontSize: "0.82rem" }}
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Modules</option>
              {availableEntities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>

            {/* Action Filter */}
            <select
              aria-label="Filter by action"
              className="form-input"
              style={{ fontSize: "0.82rem" }}
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Actions</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Date Range:</span>
              <input
                type="date"
                className="form-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "0.8rem" }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "0.8rem" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: "6px 14px", fontSize: "0.8rem", minHeight: "34px" }}
              >
                Apply Dates
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Reset Filters
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: "20px" }}>
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div
        className="glass-card"
        style={{
          borderRadius: "12px",
          overflow: "hidden",
          background: "var(--bg-surface)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-dim)",
                }}
              >
                <th style={{ padding: "12px 14px", width: "40px" }}></th>
                <th style={{ padding: "12px 14px" }}>Timestamp (PKT)</th>
                <th style={{ padding: "12px 14px" }}>Actor</th>
                <th style={{ padding: "12px 14px" }}>Action</th>
                <th style={{ padding: "12px 14px" }}>Module</th>
                <th style={{ padding: "12px 14px" }}>Record ID</th>
                <th style={{ padding: "12px 14px" }}>Reason / Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "36px", textAlign: "center", color: "var(--text-muted)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    Koi audit log nahi mila. Filters adjust karein.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  const hasDetails = Boolean(log.changes || log.details || log.ipAddress);

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => hasDetails && toggleExpand(log.id)}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: hasDetails ? "pointer" : "default",
                          background: isExpanded ? "var(--bg-secondary)" : "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          {hasDetails && (
                            <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 650 }}>{log.actorName}</div>
                          <span
                            className="badge"
                            style={{
                              fontSize: "0.68rem",
                              padding: "1px 6px",
                              marginTop: "2px",
                              background:
                                log.actorRole === "OWNER"
                                  ? "var(--amber-soft)"
                                  : "var(--blue-soft)",
                              color:
                                log.actorRole === "OWNER"
                                  ? "var(--amber-primary)"
                                  : "var(--blue-primary)",
                            }}
                          >
                            {log.actorRole}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: log.action.includes("REVERS")
                                ? "var(--danger)"
                                : log.action.includes("UPDATE")
                                ? "var(--accent-primary)"
                                : "var(--text-main)",
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--bg-secondary)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            {log.entityType}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {log.entityId || "—"}
                        </td>
                        <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                          {log.reason || "—"}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-medium)" }}>
                          <td colSpan={7} style={{ padding: "16px 24px 20px 48px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              {/* Field Changes Table */}
                              {log.changes && Array.isArray(log.changes) && log.changes.length > 0 && (
                                <div>
                                  <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px" }}>
                                    Modified Fields (Diff):
                                  </div>
                                  <div className="table-scroll"><table style={{ width: "100%", maxWidth: "600px", borderCollapse: "collapse", fontSize: "0.8rem", background: "var(--bg-surface)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                                    <thead>
                                      <tr style={{ textAlign: "left", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <th style={{ padding: "6px 10px" }}>Field</th>
                                        <th style={{ padding: "6px 10px" }}>Before</th>
                                        <th style={{ padding: "6px 10px" }}>After</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {log.changes.map((c: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                          <td style={{ padding: "6px 10px", fontWeight: 600 }}>{c.field}</td>
                                          <td style={{ padding: "6px 10px", color: "var(--danger)" }}>
                                            {typeof c.before === "object" ? JSON.stringify(c.before) : String(c.before ?? "None")}
                                          </td>
                                          <td style={{ padding: "6px 10px", color: "var(--accent-primary)" }}>
                                            {typeof c.after === "object" ? JSON.stringify(c.after) : String(c.after ?? "None")}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table></div>
                                </div>
                              )}

                              {/* Details JSON or String */}
                              {log.details && (
                                <div>
                                  <div style={{ fontSize: "0.78rem", fontWeight: 700, marginBottom: "4px" }}>
                                    Context Details:
                                  </div>
                                  <pre
                                    style={{
                                      background: "var(--bg-surface)",
                                      border: "1px solid var(--border-subtle)",
                                      padding: "10px 14px",
                                      borderRadius: "6px",
                                      fontSize: "0.76rem",
                                      overflowX: "auto",
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--text-main)",
                                    }}
                                  >
                                    {typeof log.details === "object"
                                      ? JSON.stringify(log.details, null, 2)
                                      : log.details}
                                  </pre>
                                </div>
                              )}

                              {log.ipAddress && (
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  Origin IP: <span style={{ fontFamily: "var(--font-mono)" }}>{log.ipAddress}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "0.82rem",
            color: "var(--text-muted)",
          }}
        >
          <div>
            Showing {logs.length} of {totalRecords} total audit events (Page {page} of {totalPages})
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.8rem", minHeight: "32px" }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.8rem", minHeight: "32px" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
