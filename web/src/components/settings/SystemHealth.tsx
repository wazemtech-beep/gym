"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useEffect, useState } from "react";
export default function SystemHealth() {
  const readCacheVersion = useReadCacheVersion();
  const [health, setHealth] = useState<any>(null), [error, setError] = useState("");
  useEffect(() => { let alive = true; apiFetch("/api/v1/settings/health").then(async res => { if (!res.ok) throw new Error("Could not read system status."); return res.json(); }).then(data => { if (alive) setHealth(data); }).catch(err => { if (alive) setError(err.message); }); return () => { alive = false; }; }, [readCacheVersion]);
  return <section className="glass-panel" style={{ padding: 20 }}><h3>System status</h3>{error && <p role="alert">{error}</p>}{!health && !error && <p>Reading status…</p>}{health && <dl>{["database", "smtp", "push", "worker", "backups"].map(key => <div key={key} style={{ padding: "8px 0" }}><dt>{key === "smtp" ? "Email service" : key === "push" ? "Push service" : key.charAt(0).toUpperCase() + key.slice(1)}</dt><dd>{health[key]}</dd></div>)}</dl>}</section>;
}
