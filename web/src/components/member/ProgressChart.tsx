"use client";
import { useState } from "react";
type Point = { date: string; weightKg?: number | null; waistCm?: number | null; chestCm?: number | null; hipsCm?: number | null; armsCm?: number | null; thighsCm?: number | null };
const metrics = { weightKg: "Weight (kg)", waistCm: "Waist (cm)", chestCm: "Chest (cm)", hipsCm: "Hips (cm)", armsCm: "Arms (cm)", thighsCm: "Thighs (cm)" };
export default function ProgressChart({ measurements }: { measurements: Point[] }) {
  const [metric, setMetric] = useState<keyof typeof metrics>("weightKg");
  const points = measurements.filter(p => typeof p[metric] === "number" && Number.isFinite(p[metric]) && Number.isFinite(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const values = points.map(p => p[metric] as number);
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const first = points.length ? Date.parse(points[0].date) : 0, last = points.length ? Date.parse(points[points.length - 1].date) : first;
  const x = (p: Point, index: number) => last === first ? 40 + index / Math.max(1, points.length - 1) * 520 : 40 + (Date.parse(p.date) - first) / (last - first) * 520;
  const y = (p: Point) => 155 - ((p[metric] as number) - min) / range * 115;
  return <section className="glass-panel" style={{ padding: 24, marginBottom: 24 }}><h3>Progress over time</h3><label>Measurement<select className="input-field" value={metric} onChange={e => setMetric(e.target.value as keyof typeof metrics)}>{Object.entries(metrics).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>{points.length < 2 ? <p>Add at least two readings for a trend.</p> : <><svg viewBox="0 0 600 195" role="img" aria-label={`${metrics[metric]} trend from ${values[0]} to ${values[values.length - 1]}`} style={{ width: "100%", maxHeight: 240 }}><line x1="40" y1="160" x2="560" y2="160" stroke="var(--border-medium)" /><polyline fill="none" stroke="var(--accent-primary)" strokeWidth="3" points={points.map((p, index) => `${x(p, index)},${y(p)}`).join(" ")} />{points.map((p, index) => <circle key={`${p.date}:${index}`} cx={x(p, index)} cy={y(p)} r="4" fill="var(--accent-primary)"><title>{new Date(p.date).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}: {p[metric]}</title></circle>)}<text x="40" y="185" fontSize="11" fill="var(--text-muted)">{new Date(points[0].date).toLocaleDateString("en-GB")}</text><text x="560" y="185" textAnchor="end" fontSize="11" fill="var(--text-muted)">{new Date(points[points.length - 1].date).toLocaleDateString("en-GB")}</text></svg><p>{metrics[metric]}: {values[0]} → {values[values.length - 1]} · {points.length} readings</p></>}</section>;
}
