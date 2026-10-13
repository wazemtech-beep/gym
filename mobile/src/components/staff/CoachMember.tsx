import { useState } from "react";
import { router } from "expo-router";
import { Image, Text } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Heading,
  LoadingCard,
  Screen,
  styles,
} from "../ui";
import { Choices } from "../controls";
import { ActionForm } from "./ActionForm";
import { text } from "./adminConfig";
import { Back, Details, type Row } from "./common";
import { useStaffQuery } from "../../hooks/staff";
import { useSession } from "../../providers/session";
import { privateImage } from "../../lib/assets";

export function CoachMember({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const { token } = useSession(),
    [tab, setTab] = useState("profile");
  const base = `/api/v1/trainer/members/${encodeURIComponent(id)}`;
  const profile = useStaffQuery<{ data: Row }>(base),
    plans = useStaffQuery<{ data: Row[] }>(base + "/plans", tab === "workout"),
    diet = useStaffQuery<{ data: Row }>(base + "/diet", tab === "diet"),
    progress = useStaffQuery<{ data: Row }>(
      base + "/progress",
      tab === "progress",
    ),
    insights = useStaffQuery<{ data: Row }>(
      base + "/insights",
      tab === "activity",
    );
  const member = profile.data?.data;
  const selected =
    tab === "diet"
      ? diet
      : tab === "progress"
        ? progress
        : tab === "activity"
          ? insights
          : tab === "workout"
            ? plans
            : profile;
  function editor(kind: "workout" | "diet") {
    router.push({
      pathname: admin ? "/admin/plan/[id]" : "/trainer/plan/[id]",
      params: { id, kind },
    });
  }
  return (
    <Screen>
      <Back home={admin ? "/admin" : "/trainer"} />
      <Heading>{member?.fullName || "Coaching profile"}</Heading>
      <ErrorNotice
        error={selected.error}
        retry={() => void selected.refetch()}
      />
      <Card>
        <Choices
          label="Coaching"
          value={tab}
          onChange={setTab}
          options={["profile", "workout", "diet", "progress", "activity"].map(
            (value) => ({
              value,
              label:
                value === "activity"
                  ? "Activity & reviews"
                  : value.charAt(0).toUpperCase() + value.slice(1),
            }),
          )}
        />
      </Card>
      {tab === "profile" &&
        (!member ? (
          <LoadingCard title="Member details" />
        ) : (
          <Card title="Member details">
            <Details
              data={member}
              fields={[
                "memberId",
                "phone",
                "email",
                "fitnessGoal",
                "limitations",
                "joiningDate",
              ]}
            />
            <Details
              data={member.assignment}
              fields={[
                "coachingFocus",
                "startDate",
                "consentMeasurements",
                "consentHealthActivity",
              ]}
            />
          </Card>
        ))}
      {tab === "workout" && (
        <>
          <Button
            title="Create workout plan"
            onPress={() => editor("workout")}
          />
          {!plans.data ? (
            <LoadingCard title="Workout plans" />
          ) : plans.data.data.length ? (
            plans.data.data.map((plan) => (
              <Card key={plan.id} title={plan.title}>
                <Details
                  data={plan}
                  fields={[
                    "goal",
                    "version",
                    "status",
                    "weeklySchedule",
                    "startDate",
                    "endDate",
                    "notes",
                  ]}
                />
                {plan.workoutDays?.map((day: Row) => (
                  <Card key={day.id} title={day.title}>
                    {day.exercises?.map((exercise: Row) => (
                      <Details
                        key={exercise.id}
                        data={exercise}
                        fields={[
                          "name",
                          "type",
                          "sets",
                          "reps",
                          "targetLoad",
                          "restSeconds",
                          "instructions",
                          "demoVideoUrl",
                        ]}
                      />
                    ))}
                  </Card>
                ))}
                {plan.status === "DRAFT" && (
                  <ActionForm
                    operation={{
                      title: "Publish workout plan",
                      path: `/api/v1/trainer/plans/${plan.id}/publish`,
                      confirm: "Publish this plan and replace the active plan?",
                    }}
                  />
                )}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={styles.muted}>No workout plans yet.</Text>
            </Card>
          )}
          <Card title="Previous sessions">
            {member?.sessions?.length ? (
              member.sessions.map((session: Row) => (
                <Card key={session.id}>
                  <Details
                    data={session}
                    fields={[
                      "sessionDate",
                      "status",
                      "durationMinutes",
                      "skipReason",
                      "trainerFeedback",
                    ]}
                  />
                  {session.exerciseLogs?.map((log: Row) => (
                    <Details
                      key={log.id}
                      data={log}
                      fields={["actualReps", "actualLoad", "notes"]}
                    />
                  ))}
                  <ActionForm
                    operation={{
                      title: "Save session feedback",
                      path: `/api/v1/trainer/workouts/${session.id}/feedback`,
                      fields: [text("feedback", "Feedback", true, "multiline")],
                    }}
                  />
                </Card>
              ))
            ) : (
              <Text style={styles.muted}>No sessions recorded yet.</Text>
            )}
          </Card>
        </>
      )}
      {tab === "diet" && (
        <>
          <Button title="Create diet plan" onPress={() => editor("diet")} />
          {!diet.data ? (
            <LoadingCard title="Diet plans & preferences" />
          ) : (
            <>
              <Card title="Preferences & allergies">
                <Details
                  data={diet.data.data.preferences}
                  fields={[
                    "allergies",
                    "foodPreference",
                    "routine",
                    "cookingAccess",
                    "restrictions",
                    "dislikedFoods",
                    "budget",
                    "notes",
                  ]}
                />
              </Card>
              {diet.data.data.plans.map((plan: Row) => (
                <Card key={plan.id} title={plan.title}>
                  <Details
                    data={plan}
                    fields={[
                      "goal",
                      "version",
                      "status",
                      "notes",
                      "startDate",
                      "reviewDate",
                    ]}
                  />
                  {plan.mealSlots?.map((meal: Row) => (
                    <Card key={meal.id} title={meal.title}>
                      <Details
                        data={meal}
                        fields={[
                          "slotType",
                          "suggestedTiming",
                          "foodItems",
                          "alternatives",
                          "estimatedCalories",
                          "estimatedProtein",
                          "estimatedCarbs",
                          "estimatedFats",
                        ]}
                      />
                    </Card>
                  ))}
                  {plan.status === "DRAFT" && (
                    <ActionForm
                      operation={{
                        title: "Publish diet plan",
                        path: `/api/v1/trainer/diet/plans/${plan.id}/publish`,
                        confirm:
                          "Publish this diet plan after reviewing allergies?",
                      }}
                    />
                  )}
                </Card>
              ))}
              <Card title="Diet change requests">
                {diet.data.data.changeRequests?.length ? (
                  diet.data.data.changeRequests.map((row: Row) => (
                    <Details
                      key={row.id}
                      data={row}
                      fields={[
                        "reason",
                        "requestedChanges",
                        "createdAt",
                        "status",
                      ]}
                    />
                  ))
                ) : (
                  <Text style={styles.muted}>No change requests.</Text>
                )}
              </Card>
              <Card title="Meal logs">
                {diet.data.data.logs?.length ? (
                  diet.data.data.logs.map((log: Row) => (
                    <Card key={log.id}>
                      <Details
                        data={log}
                        fields={[
                          "date",
                          "slotType",
                          "status",
                          "actualFood",
                          "actualQuantity",
                          "skipReason",
                          "feedback",
                          "trainerFeedback",
                        ]}
                      />
                      <ActionForm
                        operation={{
                          title: "Save meal feedback",
                          path: `/api/v1/trainer/diet/logs/${log.id}/feedback`,
                          fields: [
                            text("feedback", "Feedback", true, "multiline"),
                          ],
                        }}
                      />
                    </Card>
                  ))
                ) : (
                  <Text style={styles.muted}>No meal logs.</Text>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {tab === "progress" &&
        (!progress.data ? (
          <LoadingCard title="Shared progress" />
        ) : !progress.data.data.consentGranted ? (
          <Card>
            <Text style={styles.muted}>{progress.data.data.message}</Text>
          </Card>
        ) : (
          <>
            <Card title="Progress summary">
              <Details
                data={progress.data.data.comparison}
                fields={["weightChangeKg", "waistChangeCm"]}
              />
              <Details
                data={progress.data.data.goal}
                fields={["targetWeightKg", "targetDate", "notes"]}
              />
            </Card>
            <Card title="Measurements">
              {progress.data.data.measurements.map((measurement: Row) => (
                <Card key={measurement.id}>
                  <Details
                    data={measurement}
                    fields={[
                      "date",
                      "weightKg",
                      "waistCm",
                      "chestCm",
                      "hipsCm",
                      "bodyFatPercent",
                      "trainerFeedback",
                    ]}
                  />
                  <ActionForm
                    operation={{
                      title: "Review measurement",
                      path: base + "/progress",
                      fixed: { measurementId: measurement.id },
                      fields: [text("feedback", "Feedback", true, "multiline")],
                    }}
                  />
                </Card>
              ))}
            </Card>
            <Card title="Shared photos">
              {progress.data.data.photos.length ? (
                progress.data.data.photos.map((photo: Row) => (
                  <Image
                    key={photo.id}
                    source={privateImage(photo.photoUrl || photo.url, token)}
                    style={{ width: "100%", height: 250, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                ))
              ) : (
                <Text style={styles.muted}>No photos shared.</Text>
              )}
            </Card>
          </>
        ))}
      {tab === "activity" && (
        <>
          {!insights.data ? (
            <LoadingCard title="Shared activity" />
          ) : (
            <>
              <Card title="This week">
                <Details
                  data={insights.data.data.comparison?.currentWeek?.aggregates}
                  fields={[
                    "stepsPerAvailableDay",
                    "daysWithStepsData",
                    "totalSteps",
                    "totalDistanceKm",
                    "totalActiveCalories",
                    "recordedWorkoutsCount",
                    "recordedWorkoutDurationMinutes",
                  ]}
                />
                <Text style={styles.muted}>
                  Shared:{" "}
                  {insights.data.data.sharedCategories?.join(", ") ||
                    "No activity categories"}
                </Text>
              </Card>
              <Card title="Previous reviews">
                {insights.data.data.pastReviews?.map((review: Row) => (
                  <Details
                    key={review.id}
                    data={review}
                    fields={[
                      "observation",
                      "memberFacingNote",
                      "suggestedAction",
                      "createdAt",
                    ]}
                  />
                ))}
              </Card>
            </>
          )}
          <ActionForm
            operation={{
              title: "Save coaching review",
              path: base + "/insights/review",
              fields: [
                text("observation", "Observation", true, "multiline"),
                text("memberFeedback", "Member feedback", false, "multiline"),
                text("suggestedAction", "Suggested action", false, "multiline"),
                text("memberFacingNote", "Note for member", false, "multiline"),
                text("reviewedStartDate", "Review from", false, "date"),
                text("reviewedEndDate", "Review to", false, "date"),
              ],
            }}
          />
          <ActionForm
            operation={{
              title: "Request activity sharing",
              path: base + "/insights/request-access",
              fields: [
                text("message", "Message for member", true, "multiline"),
              ],
              confirm: "Ask this member to share activity data?",
            }}
          />
        </>
      )}
    </Screen>
  );
}
