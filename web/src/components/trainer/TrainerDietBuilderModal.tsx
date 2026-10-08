"use client";
import ModalOverlay from "@/components/common/ModalOverlay";
import { apiFetch, useReadCacheVersion } from "@/lib/apiFetch";

import React, { useState, useEffect } from "react";
import {
  Utensils,
  Plus,
  Trash2,
  Save,
  Send,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

interface TrainerDietBuilderModalProps {
  memberItem: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TrainerDietBuilderModal({
  memberItem,
  onClose,
  onSuccess,
}: TrainerDietBuilderModalProps) {
  const readCacheVersion = useReadCacheVersion();
  const [preferences, setPreferences] = useState<any>(null);
  const [pastPlans, setPastPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("Balanced High-Protein Routine");
  const [goal, setGoal] = useState(memberItem.coachingFocus || "Weight Management");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [reviewDate, setReviewDate] = useState("");
  const [notes, setNotes] = useState("");
  const [specialistReference, setSpecialistReference] = useState("");

  const [mealSlots, setMealSlots] = useState<any[]>([
    {
      slotType: "BREAKFAST",
      title: "Breakfast",
      suggestedTiming: "08:30 AM",
      foodItems: "3 Boiled Eggs + 2 slices Whole Wheat Bread + 1 cup Green Tea",
      alternatives: "Oatmeal with 1 scoop Whey Protein & 1 banana",
      notes: "Do not add table sugar.",
      estimatedCalories: 450,
      estimatedProtein: 28,
    },
    {
      slotType: "LUNCH",
      title: "Lunch",
      suggestedTiming: "01:30 PM",
      foodItems: "150g Grilled Chicken Breast + 1 cup White Rice + Fresh Green Salad",
      alternatives: "150g Fish Fillet or 1 bowl Daal with 2 rotis",
      notes: "Light olive oil cooking.",
      estimatedCalories: 550,
      estimatedProtein: 40,
    },
    {
      slotType: "DINNER",
      title: "Dinner",
      suggestedTiming: "08:30 PM",
      foodItems: "150g Grilled Chicken/Beef + Mixed Steamed Vegetables",
      alternatives: "Egg Omelette (3 whites, 1 whole) with sautéed spinach",
      notes: "Eat at least 2 hours before sleep.",
      estimatedCalories: 400,
      estimatedProtein: 35,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);

  useEffect(() => {
    const fetchDietData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/v1/trainer/members/${memberItem.member.id}/diet`);
        const json = await res.json();
        if (json.success) {
          setPreferences(json.data.preferences);
          setPastPlans(json.data.plans || []);
        }
      } catch (err) {
        console.error("Failed to load diet data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDietData();
  }, [memberItem.member.id, readCacheVersion]);

  const handleSave = async (status: "DRAFT" | "PUBLISHED", overrideAllergy = false) => {
    setSaving(true);
    setErrorMsg(null);
    setAllergyWarning(null);

    try {
      const res = await apiFetch(`/api/v1/trainer/members/${memberItem.member.id}/diet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          goal,
          startDate,
          reviewDate: reviewDate || null,
          notes,
          specialistReference,
          status,
          mealSlots,
          ignoreAllergyWarning: overrideAllergy,
        }),
      });

      const json = await res.json();
      if (json.success) {
        onSuccess();
        onClose();
      } else {
        if (json.allergyWarning) {
          setAllergyWarning(json.error);
        } else {
          setErrorMsg(json.error || "Plan save karne mein masla aya.");
        }
      }
    } catch (err) {
      setErrorMsg("Server error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: "780px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Diet & Nutrition Plan Builder</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              Member: {memberItem.member.fullName} ({memberItem.member.memberId})
            </span>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "6px" }}>
            <X size={18} />
          </button>
        </div>

        {/* Member Preferences Alert Banner */}
        {preferences && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "16px",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--accent-primary)", marginBottom: "4px" }}>
              Member Declared Preferences:
            </div>
            <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", color: "var(--text-dim)" }}>
              <div><strong>Food Pref:</strong> {preferences.foodPreference || "Not specified"}</div>
              <div><strong>Allergies:</strong> <span style={{ color: preferences.allergies ? "#f87171" : "inherit" }}>{preferences.allergies || "None declared"}</span></div>
              <div><strong>Cooking Access:</strong> {preferences.cookingAccess || "Not specified"}</div>
              <div><strong>Budget:</strong> {preferences.budget || "Not specified"}</div>
              <div><strong>Routine:</strong> {preferences.routine || "Not specified"}</div>
              <div><strong>Disliked:</strong> {preferences.dislikedFoods || "None"}</div>
            </div>
          </div>
        )}

        {/* Allergy Conflict Warning Banner */}
        {allergyWarning && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "16px",
              color: "#f87171",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, marginBottom: "4px" }}>
              <ShieldAlert size={18} /> Declared Allergy Conflict Detected!
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "0.8rem", lineHeight: 1.4 }}>{allergyWarning}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave("PUBLISHED", true)}
              style={{ fontSize: "0.75rem", padding: "4px 10px", borderColor: "rgba(239,68,68,0.4)" }}
            >
              Confirm Verified & Override Warning
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              marginBottom: "16px",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#f87171",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Form Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Plan Title *</label>
              <input
                type="text"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Dietary Goal *</label>
              <input
                type="text"
                className="input-field"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="field-label">Start Date *</label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Review Date (Optional)</label>
              <input
                type="date"
                className="input-field"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </div>
          </div>

          {/* Meal Slots Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <label className="field-label" style={{ margin: 0 }}>Meal Slots & Food Portions</label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMealSlots([
                    ...mealSlots,
                    {
                      slotType: "SNACK",
                      title: `Meal ${mealSlots.length + 1}`,
                      suggestedTiming: "05:00 PM",
                      foodItems: "1 handful almonds + 1 apple",
                      alternatives: "Greek yogurt with berries",
                      estimatedCalories: 200,
                      estimatedProtein: 8,
                    },
                  ]);
                }}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                <Plus size={14} /> Add Meal Slot
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {mealSlots.map((slot, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "10px",
                    padding: "14px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "8px", marginBottom: "10px" }}>
                    <input
                      type="text"
                      className="input-field"
                      value={slot.title}
                      onChange={(e) => {
                        const copy = [...mealSlots];
                        copy[idx].title = e.target.value;
                        setMealSlots(copy);
                      }}
                      placeholder="Slot Title (e.g. Breakfast)"
                    />
                    <select
                      className="input-field"
                      value={slot.slotType}
                      onChange={(e) => {
                        const copy = [...mealSlots];
                        copy[idx].slotType = e.target.value;
                        setMealSlots(copy);
                      }}
                    >
                      <option value="BREAKFAST">BREAKFAST</option>
                      <option value="MORNING_SNACK">MORNING SNACK</option>
                      <option value="LUNCH">LUNCH</option>
                      <option value="EVENING_SNACK">EVENING SNACK</option>
                      <option value="DINNER">DINNER</option>
                      <option value="PRE_WORKOUT">PRE-WORKOUT</option>
                      <option value="POST_WORKOUT">POST-WORKOUT</option>
                    </select>
                    <input
                      type="text"
                      className="input-field"
                      value={slot.suggestedTiming || ""}
                      onChange={(e) => {
                        const copy = [...mealSlots];
                        copy[idx].suggestedTiming = e.target.value;
                        setMealSlots(copy);
                      }}
                      placeholder="Timing (e.g. 8am)"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setMealSlots(mealSlots.filter((_, i) => i !== idx));
                      }}
                      style={{ padding: "8px" }}
                    >
                      <Trash2 size={16} color="#f87171" />
                    </button>
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={slot.foodItems}
                      onChange={(e) => {
                        const copy = [...mealSlots];
                        copy[idx].foodItems = e.target.value;
                        setMealSlots(copy);
                      }}
                      placeholder="Prescribed food items + exact portions (e.g. 3 eggs, 2 slices bread)..."
                      required
                    />
                  </div>

                  <div className="responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input
                      type="text"
                      className="input-field"
                      value={slot.alternatives || ""}
                      onChange={(e) => {
                        const copy = [...mealSlots];
                        copy[idx].alternatives = e.target.value;
                        setMealSlots(copy);
                      }}
                      placeholder="Practical alternative options..."
                      style={{ fontSize: "0.8rem" }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="number"
                        className="input-field"
                        value={slot.estimatedCalories || ""}
                        onChange={(e) => {
                          const copy = [...mealSlots];
                          copy[idx].estimatedCalories = e.target.value;
                          setMealSlots(copy);
                        }}
                        placeholder="Est. Calories"
                        style={{ fontSize: "0.8rem" }}
                      />
                      <input
                        type="number"
                        className="input-field"
                        value={slot.estimatedProtein || ""}
                        onChange={(e) => {
                          const copy = [...mealSlots];
                          copy[idx].estimatedProtein = e.target.value;
                          setMealSlots(copy);
                        }}
                        placeholder="Est. Protein (g)"
                        style={{ fontSize: "0.8rem" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => handleSave("DRAFT")}
          >
            <Save size={16} /> Save as Draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => handleSave("PUBLISHED")}
          >
            <Send size={16} /> {saving ? "Publishing..." : "Publish to Member"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
