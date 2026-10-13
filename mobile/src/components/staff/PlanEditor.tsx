import { useRef, useState } from "react";
import { Alert, Text } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Heading,
  Screen,
  styles,
} from "../ui";
import { Choices } from "../controls";
import { Back, type Row } from "./common";
import { useStaffAction } from "../../hooks/staff";

type ExerciseDraft = {
  name: string;
  type: string;
  sets: string;
  reps: string;
  restSeconds: string;
  targetLoad: string;
  instructions: string;
  demoVideoUrl: string;
  alternativeExercise: string;
  durationMinutes: string;
  distanceMeters: string;
};
type DayDraft = {
  title: string;
  dayOfWeek: string;
  exercises: ExerciseDraft[];
};
type MealDraft = {
  title: string;
  slotType: string;
  foodItems: string;
  suggestedTiming: string;
  alternatives: string;
  notes: string;
  estimatedCalories: string;
  estimatedProtein: string;
  estimatedCarbs: string;
  estimatedFats: string;
};
const exercise = (): ExerciseDraft => ({
  name: "",
  type: "STRENGTH",
  sets: "",
  reps: "",
  restSeconds: "60",
  targetLoad: "",
  instructions: "",
  demoVideoUrl: "",
  alternativeExercise: "",
  durationMinutes: "",
  distanceMeters: "",
});
const day = (): DayDraft => ({
  title: "",
  dayOfWeek: "MONDAY",
  exercises: [exercise()],
});
const meal = (): MealDraft => ({
  title: "",
  slotType: "BREAKFAST",
  foodItems: "",
  suggestedTiming: "",
  alternatives: "",
  notes: "",
  estimatedCalories: "",
  estimatedProtein: "",
  estimatedCarbs: "",
  estimatedFats: "",
});

export function PlanEditor({
  id,
  kind,
  admin = false,
}: {
  id: string;
  kind: string;
  admin?: boolean;
}) {
  const [drafted, setDrafted] = useState(false);
  const diet = kind === "diet",
    send = useStaffAction(),
    lock = useRef(false),
    createdPlan = useRef<string | null>(null);
  const [title, setTitle] = useState(""),
    [goal, setGoal] = useState(""),
    [notes, setNotes] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [specialist, setSpecialist] = useState(""),
    [schedule, setSchedule] = useState("Monday, Wednesday, Friday"),
    [days, setDays] = useState<DayDraft[]>([day()]),
    [meals, setMeals] = useState<MealDraft[]>([meal()]),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  function updateExercise(
    dayIndex: number,
    index: number,
    key: keyof ExerciseDraft,
    value: string,
  ) {
    setDays((current) =>
      current.map((item, i) =>
        i !== dayIndex
          ? item
          : {
              ...item,
              exercises: item.exercises.map((ex, j) =>
                j === index ? { ...ex, [key]: value } : ex,
              ),
            },
      ),
    );
  }
  function updateMeal(index: number, key: keyof MealDraft, value: string) {
    setMeals((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  async function save(status: "DRAFT" | "PUBLISHED") {
    if (lock.current || saved) return;
    setError("");
    if (!title.trim() || !goal.trim()) {
      setError("Enter a title and goal.");
      return;
    }
    if (
      [start, end].some(
        (value) =>
          value &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(new Date(value).getTime())),
      ) ||
      (start && end && start > end)
    ) {
      setError("Enter valid dates in order (YYYY-MM-DD).");
      return;
    }
    if (
      diet
        ? meals.some((item) => !item.title.trim() || !item.foodItems.trim())
        : days.some(
            (item) =>
              !item.title.trim() ||
              !item.exercises.length ||
              item.exercises.some((ex) => !ex.name.trim()),
          )
    ) {
      setError(
        diet
          ? "Add each meal’s name and foods / portions."
          : "Add each day’s title and exercise names.",
      );
      return;
    }
    const numbers = diet
      ? meals.flatMap((item) => [
          item.estimatedCalories,
          item.estimatedProtein,
          item.estimatedCarbs,
          item.estimatedFats,
        ])
      : days.flatMap((item) =>
          item.exercises.flatMap((ex) => [
            ex.sets,
            ex.restSeconds,
            ex.durationMinutes,
            ex.distanceMeters,
          ]),
        );
    if (
      numbers.some(
        (value) =>
          value && (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    ) {
      setError("Use positive numeric targets.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const body: Row = {
        title: title.trim(),
        goal: goal.trim(),
        notes,
        status: "DRAFT",
        ...(start ? { startDate: start } : {}),
      };
      if (diet)
        Object.assign(body, {
          mealSlots: meals,
          specialistReference: specialist,
          ...(end ? { reviewDate: end } : {}),
        });
      else
        Object.assign(body, {
          workoutDays: days,
          weeklySchedule: schedule,
          ...(end ? { endDate: end } : {}),
        });
      if (!createdPlan.current) {
        const result = await send<{ data: { id: string } }>(
          `/api/v1/trainer/members/${encodeURIComponent(id)}/${diet ? "diet" : "plans"}`,
          body,
        );
        createdPlan.current = result.data.id;
        setDrafted(true);
      }
      if (status === "PUBLISHED")
        await send(
          `/api/v1/trainer/${diet ? "diet/plans" : "plans"}/${createdPlan.current}/publish`,
          {},
        );
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Plan could not be saved.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || saved || drafted;
  return (
    <Screen>
      <Back home={admin ? "/admin" : "/trainer"} />
      <Heading>{diet ? "New diet plan" : "New workout plan"}</Heading>
      <ErrorNotice error={error} />
      <Card title="Plan details">
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          editable={!disabled}
        />
        <Field
          label="Goal"
          value={goal}
          onChangeText={setGoal}
          editable={!disabled}
        />
        <Field
          label="Start date (YYYY-MM-DD, optional)"
          value={start}
          onChangeText={setStart}
          editable={!disabled}
        />
        <Field
          label={
            diet
              ? "Review date (YYYY-MM-DD, optional)"
              : "End date (YYYY-MM-DD, optional)"
          }
          value={end}
          onChangeText={setEnd}
          editable={!disabled}
        />
        {!diet && (
          <Field
            label="Weekly schedule"
            value={schedule}
            onChangeText={setSchedule}
            editable={!disabled}
          />
        )}
        {diet && (
          <Field
            label="Specialist reference (optional)"
            value={specialist}
            onChangeText={setSpecialist}
            editable={!disabled}
          />
        )}
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={!disabled}
        />
      </Card>
      {diet
        ? meals.map((item, index) => (
            <Card key={index} title={`Meal ${index + 1}`}>
              <Choices
                label="Meal slot"
                value={item.slotType}
                options={[
                  "BREAKFAST",
                  "MORNING_SNACK",
                  "LUNCH",
                  "EVENING_SNACK",
                  "DINNER",
                  "LATE_SNACK",
                  "PRE_WORKOUT",
                  "POST_WORKOUT",
                ].map((value) => ({ label: value.replace(/_/g, " "), value }))}
                onChange={(value) => updateMeal(index, "slotType", value)}
                disabled={disabled}
              />
              {(
                [
                  "title",
                  "foodItems",
                  "suggestedTiming",
                  "alternatives",
                  "notes",
                  "estimatedCalories",
                  "estimatedProtein",
                  "estimatedCarbs",
                  "estimatedFats",
                ] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    key === "foodItems"
                      ? "Foods and portions"
                      : key.replace(/([A-Z])/g, " $1")
                  }
                  value={item[key]}
                  onChangeText={(value) => updateMeal(index, key, value)}
                  multiline={["foodItems", "notes"].includes(key)}
                  keyboardType={
                    key.startsWith("estimated") ? "decimal-pad" : "default"
                  }
                  editable={!disabled}
                />
              ))}
              <Button
                secondary
                title="Remove meal"
                disabled={disabled || meals.length <= 1}
                onPress={() =>
                  setMeals((current) => current.filter((_, i) => i !== index))
                }
              />
            </Card>
          ))
        : days.map((item, dayIndex) => (
            <Card key={dayIndex} title={`Day ${dayIndex + 1}`}>
              <Field
                label="Day title"
                value={item.title}
                onChangeText={(value) =>
                  setDays((current) =>
                    current.map((d, i) =>
                      i === dayIndex ? { ...d, title: value } : d,
                    ),
                  )
                }
                editable={!disabled}
              />
              <Choices
                label="Day of week"
                value={item.dayOfWeek}
                options={[
                  "MONDAY",
                  "TUESDAY",
                  "WEDNESDAY",
                  "THURSDAY",
                  "FRIDAY",
                  "SATURDAY",
                  "SUNDAY",
                ].map((value) => ({ value, label: value }))}
                disabled={disabled}
                onChange={(value) =>
                  setDays((current) =>
                    current.map((d, i) =>
                      i === dayIndex ? { ...d, dayOfWeek: value } : d,
                    ),
                  )
                }
              />
              {item.exercises.map((ex, index) => (
                <Card key={index} title={`Exercise ${index + 1}`}>
                  <Choices
                    label="Type"
                    value={ex.type}
                    options={["STRENGTH", "CARDIO", "MOBILITY"].map(
                      (value) => ({ value, label: value }),
                    )}
                    onChange={(value) =>
                      updateExercise(dayIndex, index, "type", value)
                    }
                    disabled={disabled}
                  />
                  {(
                    [
                      "name",
                      "sets",
                      "reps",
                      "targetLoad",
                      "restSeconds",
                      "durationMinutes",
                      "distanceMeters",
                      "instructions",
                      "alternativeExercise",
                      "demoVideoUrl",
                    ] as const
                  ).map((key) => (
                    <Field
                      key={key}
                      label={key.replace(/([A-Z])/g, " $1")}
                      value={ex[key]}
                      onChangeText={(value) =>
                        updateExercise(dayIndex, index, key, value)
                      }
                      multiline={key === "instructions"}
                      keyboardType={
                        [
                          "sets",
                          "restSeconds",
                          "durationMinutes",
                          "distanceMeters",
                        ].includes(key)
                          ? "number-pad"
                          : "default"
                      }
                      autoCapitalize={
                        key === "demoVideoUrl" ? "none" : "sentences"
                      }
                      editable={!disabled}
                    />
                  ))}
                  <Button
                    secondary
                    title="Remove exercise"
                    disabled={disabled || item.exercises.length <= 1}
                    onPress={() =>
                      setDays((current) =>
                        current.map((d, i) =>
                          i === dayIndex
                            ? {
                                ...d,
                                exercises: d.exercises.filter(
                                  (_, j) => j !== index,
                                ),
                              }
                            : d,
                        ),
                      )
                    }
                  />
                </Card>
              ))}
              <Button
                secondary
                title="Add exercise"
                disabled={disabled}
                onPress={() =>
                  setDays((current) =>
                    current.map((d, i) =>
                      i === dayIndex
                        ? { ...d, exercises: [...d.exercises, exercise()] }
                        : d,
                    ),
                  )
                }
              />
              <Button
                secondary
                title="Remove day"
                disabled={disabled || days.length <= 1}
                onPress={() =>
                  setDays((current) => current.filter((_, i) => i !== dayIndex))
                }
              />
            </Card>
          ))}
      <Button
        secondary
        title={diet ? "Add meal" : "Add day"}
        disabled={disabled}
        onPress={() =>
          diet
            ? setMeals((current) => [...current, meal()])
            : setDays((current) => [...current, day()])
        }
      />
      {saved && (
        <Card>
          <Text style={styles.text}>
            Plan saved. Return to the coaching profile to view it.
          </Text>
        </Card>
      )}
      <Button
        secondary
        title="Save draft"
        busy={busy}
        disabled={saved}
        onPress={() => void save("DRAFT")}
      />
      <Button
        title="Publish plan"
        busy={busy}
        disabled={saved}
        onPress={() =>
          Alert.alert(
            "Publish plan?",
            "This will replace the current active plan. Review the member’s needs and allergies first.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Publish", onPress: () => void save("PUBLISHED") },
            ],
          )
        }
      />
    </Screen>
  );
}
