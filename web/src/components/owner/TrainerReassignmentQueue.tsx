"use client";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";
import { useEffect, useState } from "react";
import AssignTrainerModal from "@/components/members/AssignTrainerModal";
export default function TrainerReassignmentQueue() {
  const readCacheVersion = useReadCacheVersion();
  const [rows, setRows] = useState<any[]>([]), [member, setMember] = useState<any>(null), [error, setError] = useState("");
  const load = async () => { try { const res = await apiFetch("/api/v1/trainers/reassignment-pending"); const data = await res.json(); if (!res.ok) throw new Error(data.error); setRows(data.assignments || []); } catch(error: any) { setError(error.message); } };
  useEffect(() => { void load(); }, [readCacheVersion]);
  if (!rows.length && !error) return null;
  return <section className="glass-panel" style={{ padding: 24, marginBottom: 24 }}><h3>Members needing a trainer</h3>{error && <p role="alert">{error}</p>}{rows.map(row => <div key={row.id} className="section-toolbar"><span>{row.gymMember.fullName} · {row.gymMember.memberId} — {row.trainer.name} suspended</span><button className="btn-secondary" onClick={() => setMember(row.gymMember)}>Reassign trainer</button></div>)}{member && <AssignTrainerModal isOpen member={member} onClose={() => setMember(null)} onSuccess={() => { setMember(null); void load(); }} />}</section>;
}
