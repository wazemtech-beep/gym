"use client";
import MemberLoadingLayout from "./MemberLoadingLayout";
import layoutStyles from "./MemberPages.module.css";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import DietChangeRequest from "./DietChangeRequest";
import {
  Utensils,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  Edit2,
  MessageSquare,
  Sparkles,
  ChevronDown,
  X,
  Check,
  Flame,
  AlertTriangle,
} from "lucide-react";

export default function DietPlanSection() {
  const readCacheVersion = useReadCacheVersion();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preference modal state
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    goal: "Weight management & muscle gain",
    foodPreference: "Non-Vegetarian (Halal)",
    allergies: "",
    budget: "Moderate",
    routine: "Morning wake-up 7am, Dinner 8:30pm",
    cookingAccess: "Home cooked meals",
    dislikedFoods: "",
    restrictions: "No processed sugars",
    notes: "",
  });

  // Meal action modal state
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [logModalAction, setLogModalAction] = useState<"FOLLOWED" | "PARTIALLY_FOLLOWED" | "DIFFERENT_MEAL" | "SKIPPED">("FOLLOWED");
  const [actualFood, setActualFood] = useState("");
  const [skipReason, setSkipReason] = useState("Outside food / travel");
  const [feedback, setFeedback] = useState("");
  const [loggingSubmitting, setLoggingSubmitting] = useState(false);

  const fetchDiet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/member/diet/today");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Diet plan load nahi ho saka.");
      }

      // Also fetch preferences
      const prefRes = await apiFetch("/api/v1/member/diet/preferences");
      const prefJson = await prefRes.json();
      if (prefJson.success && prefJson.data) {
        setPreferences({
          goal: prefJson.data.goal || "",
          foodPreference: prefJson.data.foodPreference || "",
          allergies: prefJson.data.allergies || "",
          budget: prefJson.data.budget || "",
          routine: prefJson.data.routine || "",
          cookingAccess: prefJson.data.cookingAccess || "",
          dislikedFoods: prefJson.data.dislikedFoods || "",
          restrictions: prefJson.data.restrictions || "",
          notes: prefJson.data.notes || "",
        });
      }
    } catch (err) {
      setError("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiet();
  }, [readCacheVersion]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefLoading(true);
    setPrefMsg(null);
    try {
      const res = await apiFetch("/api/v1/member/diet/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const json = await res.json();
      if (json.success) {
        setPrefMsg("Preferences save ho gayin. Assigned coach ke liye review notification queue ho gayi hai.");
        setTimeout(() => setShowPrefModal(false), 1200);
      } else {
        setPrefMsg(`Masla: ${json.error}`);
      }
    } catch (err) {
      setPrefMsg("Preferences save karne mein server error.");
    } finally {
      setPrefLoading(false);
    }
  };

  const handleLogMeal = async () => {
    if (!selectedSlot) return;
    setLoggingSubmitting(true);
    try {
      const res = await apiFetch("/api/v1/member/diet/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietPlanId: data?.plan?.id,
          mealSlotId: selectedSlot.id,
          slotType: selectedSlot.slotType,
          status: logModalAction,
          actualFood: logModalAction === "DIFFERENT_MEAL" ? actualFood : null,
          skipReason: logModalAction === "SKIPPED" ? skipReason : null,
          feedback,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchDiet();
        setSelectedSlot(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingSubmitting(false);
    }
  };

  if (loading && !data) return <MemberLoadingLayout variant="diet" />;

  const plan = data?.plan;
  const todayLogs = data?.todayLogs || [];

  return (
    <div>
      {/* Top Controls Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span className="badge badge-accent" style={{ marginBottom: "6px" }}>Nutrition & Diet Guidance</span>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
            {plan ? plan.title : "Diet Routine"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", margin: "4px 0 0" }}>
            {plan ? `Coach Goal: ${plan.goal}` : "Apni dietary preferences complete karein taake coach plan assign kar sakein."}
          </p>
        </div>

        <div className={layoutStyles.sectionActions}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowPrefModal(true);
              setPrefMsg(null);
            }}
          >
            <Edit2 size={15} /> My Diet Preferences
          </button>
        </div>
      </div>

      {/* Main Meal Routine Cards */}
      {plan && plan.mealSlots && plan.mealSlots.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {plan.mealSlots.map((slot: any, idx: number) => {
            const logged = todayLogs.find((l: any) => l.mealSlotId === slot.id);

            return (
              <div
                key={slot.id}
                className="glass-panel"
                style={{
                  padding: "20px",
                  borderLeft: logged
                    ? logged.status === "FOLLOWED"
                      ? "4px solid #34d399"
                      : logged.status === "PARTIALLY_FOLLOWED"
                      ? "4px solid #fbbf24"
                      : "4px solid #f87171"
                    : "4px solid rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge" style={{ background: "rgba(255,255,255,0.06)", fontSize: "0.75rem" }}>
                        {slot.slotType.replace("_", " ")}
                      </span>
                      {slot.suggestedTiming && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={13} /> {slot.suggestedTiming}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "6px 0 0" }}>
                      {slot.title}
                    </h3>
                  </div>

                  {/* Status Badge & Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {logged ? (
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "16px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background:
                            logged.status === "FOLLOWED"
                              ? "rgba(16, 185, 129, 0.2)"
                              : logged.status === "PARTIALLY_FOLLOWED"
                              ? "rgba(245, 158, 11, 0.2)"
                              : "rgba(239, 68, 68, 0.2)",
                          color:
                            logged.status === "FOLLOWED"
                              ? "#34d399"
                              : logged.status === "PARTIALLY_FOLLOWED"
                              ? "#fbbf24"
                              : "#f87171",
                        }}
                      >
                        {logged.status.replace("_", " ")}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Not logged yet</span>
                    )}

                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedSlot(slot);
                        setLogModalAction(logged ? logged.status : "FOLLOWED");
                        setActualFood(logged?.actualFood || "");
                        setFeedback(logged?.feedback || "");
                      }}
                      style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                    >
                      {logged ? "Update Log" : "Log Meal"}
                    </button>
                  </div>
                </div>

                {/* Food Items & Portion */}
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "4px" }}>Prescribed Food & Portion:</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-bright)", lineHeight: 1.5 }}>
                    {slot.foodItems}
                  </div>
                </div>

                {/* Alternatives & Notes */}
                {slot.alternatives && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "8px" }}>
                    <strong style={{ color: "var(--accent-primary)" }}>Practical Alternative:</strong> {slot.alternatives}
                  </div>
                )}
                {slot.notes && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "8px" }}>
                    <strong>Prep Notes:</strong> {slot.notes}
                  </div>
                )}

                {/* Nutrition estimate tags if entered */}
                {(slot.estimatedCalories || slot.estimatedProtein) && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                    {slot.estimatedCalories && (
                      <span style={{ fontSize: "0.75rem", background: "rgba(245,158,11,0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "6px" }}>
                        ~{slot.estimatedCalories} kcal (Est.)
                      </span>
                    )}
                    {slot.estimatedProtein && (
                      <span style={{ fontSize: "0.75rem", background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "2px 8px", borderRadius: "6px" }}>
                        ~{slot.estimatedProtein}g Protein (Est.)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-dim)" }}>
          <Utensils size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>Diet plan abhi available nahi</h3>
          <p style={{ fontSize: "0.85rem", maxWidth: "460px", margin: "0 auto 16px" }}>
            Aapke assigned trainer aapki preferences ke mutabiq custom meal plan tayyar karke publish karenge.
          </p>
          <button className="btn btn-primary" onClick={() => setShowPrefModal(true)}>
            Diet Preferences Update Karein
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Member Diet Preferences                          */}
      {/* ========================================================= */}
      <DietChangeRequest />
      {showPrefModal && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Diet & Food Preferences</h3>
              <button className="btn btn-secondary" onClick={() => setShowPrefModal(false)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            {prefMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  background: prefMsg.includes("Masla") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                  color: prefMsg.includes("Masla") ? "#f87171" : "#34d399",
                }}
              >
                {prefMsg}
              </div>
            )}

            <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="field-label">Primary Goal</label>
                <input
                  type="text"
                  className="input-field"
                  value={preferences.goal}
                  onChange={(e) => setPreferences({ ...preferences, goal: e.target.value })}
                  placeholder="e.g. Fat Loss, Lean Bulk, General Health"
                />
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Food Preference</label>
                  <select
                    className="input-field"
                    value={preferences.foodPreference}
                    onChange={(e) => setPreferences({ ...preferences, foodPreference: e.target.value })}
                  >
                    <option value="Non-Vegetarian (Halal)">Non-Vegetarian (Halal)</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Eggetarian">Eggetarian</option>
                    <option value="High-Protein Only">High-Protein Only</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Declared Allergies / Intolerances</label>
                  <input
                    type="text"
                    className="input-field"
                    value={preferences.allergies}
                    onChange={(e) => setPreferences({ ...preferences, allergies: e.target.value })}
                    placeholder="e.g. Peanuts, Lactose, Seafood"
                  />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Budget Preference</label>
                  <input
                    type="text"
                    className="input-field"
                    value={preferences.budget}
                    onChange={(e) => setPreferences({ ...preferences, budget: e.target.value })}
                    placeholder="e.g. Affordable / Student, Moderate"
                  />
                </div>
                <div>
                  <label className="field-label">Cooking & Food Access</label>
                  <input
                    type="text"
                    className="input-field"
                    value={preferences.cookingAccess}
                    onChange={(e) => setPreferences({ ...preferences, cookingAccess: e.target.value })}
                    placeholder="e.g. Ghar ka khana, Hostel mess, Bahir ka khana"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Daily Routine & Timings</label>
                <input
                  type="text"
                  className="input-field"
                  value={preferences.routine}
                  onChange={(e) => setPreferences({ ...preferences, routine: e.target.value })}
                  placeholder="e.g. Wake up 7am, Office 9-6, Gym 7pm, Dinner 9pm"
                />
              </div>

              <div>
                <label className="field-label">Disliked Foods (Jin ke practical substitutes chahiyein)</label>
                <input
                  type="text"
                  className="input-field"
                  value={preferences.dislikedFoods}
                  onChange={(e) => setPreferences({ ...preferences, dislikedFoods: e.target.value })}
                  placeholder="e.g. Karela, Fish, Raw Milk"
                />
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.4, margin: 0 }}>
                * Spec Rule: Preferences update karne par assigned coach ko review notice milega; active plan automatically rewrite nahi hoga.
              </p>

              <button type="submit" className="btn btn-primary" disabled={prefLoading} style={{ justifyContent: "center" }}>
                {prefLoading ? "Saving..." : "Save Preferences"}
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Log Meal Adherence                               */}
      {/* ========================================================= */}
      {selectedSlot && (
        <ModalOverlay className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: "520px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Log Meal Adherence</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{selectedSlot.title}</span>
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedSlot(null)} style={{ padding: "6px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="field-label">Adherence Status *</label>
                <select
                  className="input-field"
                  value={logModalAction}
                  onChange={(e: any) => setLogModalAction(e.target.value)}
                >
                  <option value="FOLLOWED">Followed as Prescribed</option>
                  <option value="PARTIALLY_FOLLOWED">Partly Followed</option>
                  <option value="DIFFERENT_MEAL">Ate a Different Meal</option>
                  <option value="SKIPPED">Skipped Meal</option>
                </select>
              </div>

              {logModalAction === "DIFFERENT_MEAL" && (
                <div>
                  <label className="field-label">Actual Food / Quantity Eaten</label>
                  <input
                    type="text"
                    className="input-field"
                    value={actualFood}
                    onChange={(e) => setActualFood(e.target.value)}
                    placeholder="e.g. 1 Chicken Biryani plate with raita"
                  />
                </div>
              )}

              {logModalAction === "SKIPPED" && (
                <div>
                  <label className="field-label">Reason for Skipping</label>
                  <select
                    className="input-field"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                  >
                    <option value="Outside food / travel">Traveling / Outside food</option>
                    <option value="Not hungry / fasting">Not hungry / Fasting</option>
                    <option value="Time shortage">Time shortage</option>
                    <option value="Financial / budget constraint">Budget constraint</option>
                  </select>
                </div>
              )}

              <div>
                <label className="field-label">Feedback / How it felt (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Taste, satiety, digestability..."
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleLogMeal}
                disabled={loggingSubmitting}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Check size={16} /> {loggingSubmitting ? "Recording..." : "Save Meal Log"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
