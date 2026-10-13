import { withReadCache } from "@/lib/serverReadCache";
import { applyMembershipLifecycle } from "@/lib/membershipLifecycle";
import { getDateRangeForPeriod } from "@/lib/businessDates";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, MembershipStatus, WorkoutPlanStatus } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }
    if (current.user.role !== Role.MEMBER) return NextResponse.json({ success: false, error: "Member login required." }, { status: 403 });
    if (current.user.mustChangePassword) return NextResponse.json({ success: false, error: "Pehle apna password change karein." }, { status: 403 });

    // Identify member through session (strictly prevents spoofing via request body/param)
    let gymMemberId: string | null = null;

    if (current.user.role === Role.MEMBER) {
      const memberRecord = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!memberRecord) {
        return NextResponse.json({
          success: true,
          data: {
            isSetupPending: true,
            user: {
              name: current.user.name,
              email: current.user.email,
              memberId: current.user.memberId,
            },
            membership: null,
            feeSummary: {
              outstanding: 0,
              overdue: 0,
              upcomingInstallments: 0,
            },
            latestPayment: null,
            pendingTransfer: null,
            todayWorkout: null,
            trainer: null,
            announcements: [],
            availablePlans: [],
            receivingAccounts: [],
          },
        }, { headers: { "Cache-Control": "no-store" } });
      }
      gymMemberId = memberRecord.id;
    }

    if (!gymMemberId) {
      return NextResponse.json({
        success: false,
        error: "Member profile nahi mili ya access unauthorized hai.",
      }, { status: 403 });
    }

    const now = new Date();

    // 1. Fetch Gym Member with related data
    await applyMembershipLifecycle(gymMemberId);
    const member = await prisma.gymMember.findUnique({
      where: { id: gymMemberId },
      include: {
        memberships: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          where: { status: { not: "VOID" } },
          include: {
            installments: true,
          },
          orderBy: { dueDate: "asc" },
        },
        payments: {
          where: { status: "CONFIRMED" },
          orderBy: { paymentDate: "desc" },
          take: 5,
        },
        transferSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 3,
          include: {
            receivingAccount: true,
          },
        },
        trainerAssignments: {
          where: { isActive: true, startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          include: {
            trainer: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatarUrl: true,
                email: true,
                status: true,
              },
            },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        workoutPlans: {
          orderBy: { startDate: "desc" },
          where: { status: WorkoutPlanStatus.PUBLISHED, startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          include: {
            workoutDays: {
              include: {
                exercises: {
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          take: 1,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member profile dastiyab nahi hai." }, { status: 404 });
    }

    // 2. Active / Latest Membership & Expiry calculation
    const activeMembership = member.memberships.find(
      (m) => [MembershipStatus.ACTIVE, MembershipStatus.FROZEN].includes(m.status as any) && m.startDate <= now && (m.endDate >= now || m.status === MembershipStatus.FROZEN)
    ) || member.memberships[0] || null;

    let membershipData = null;
    if (activeMembership) {
      const isExpired = activeMembership.status === MembershipStatus.EXPIRED || (activeMembership.status === MembershipStatus.ACTIVE && activeMembership.endDate < now);
      let daysRemaining = 0;
      if (activeMembership.endDate) {
        const diffTime = activeMembership.endDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      membershipData = {
        id: activeMembership.id,
        planName: activeMembership.planName,
        status: isExpired ? MembershipStatus.EXPIRED : activeMembership.status,
        startDate: activeMembership.startDate,
        endDate: activeMembership.endDate,
        daysRemaining,
        isExpired,
        isExpiringSoon: activeMembership.status === MembershipStatus.ACTIVE && daysRemaining <= 7 && !isExpired,
        price: activeMembership.feeAmount,
      };
    }

    // 3. Fee summary calculation (Separating Outstanding, Overdue, and Upcoming installments)
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalUpcoming = 0;

    for (const inv of member.invoices) {
      if (inv.balanceAmount > 0) {
        totalOutstanding += inv.balanceAmount;

        if (inv.installments && inv.installments.length > 0) {
          // Installment-based invoice: use unpaid remaining amount per installment
          for (const inst of inv.installments) {
            if (inst.status !== "PAID") {
              const remainingInst = Math.max(0, inst.amount - (inst.paidAmount || 0));
              if (remainingInst > 0) {
                if (new Date(inst.dueDate) < now) {
                  totalOverdue += remainingInst;
                } else {
                  totalUpcoming += remainingInst;
                }
              }
            }
          }
        } else {
          // Regular invoice (single due date)
          if (new Date(inv.dueDate) < now) {
            totalOverdue += inv.balanceAmount;
          } else {
            totalUpcoming += inv.balanceAmount;
          }
        }
      }
    }

    // 4. Latest Confirmed Payment
    const latestPaymentRecord = member.payments[0] || null;
    const latestPayment = latestPaymentRecord
      ? {
          id: latestPaymentRecord.id,
          receiptNumber: latestPaymentRecord.receiptNumber,
          amount: latestPaymentRecord.amount,
          paymentDate: latestPaymentRecord.paymentDate,
          method: latestPaymentRecord.method,
          receiptUrl: `/api/v1/receipts/${encodeURIComponent(latestPaymentRecord.id)}/download`,
        }
      : null;

    // 5. Latest Transfer Submission (Pending or recent verification)
    const latestTransferRecord = member.transferSubmissions[0] || null;
    const pendingTransfer = latestTransferRecord
      ? {
          id: latestTransferRecord.id,
          amount: latestTransferRecord.amount,
          status: latestTransferRecord.status,
          transactionReference: latestTransferRecord.transactionReference,
          receivingAccountName: latestTransferRecord.receivingAccount?.displayName || "Gym Account",
          submittedAt: latestTransferRecord.submittedAt,
          rejectionReason: latestTransferRecord.rejectionReason,
        }
      : null;

    // 6. Assigned Trainer
    const activeAssignment = member.trainerAssignments[0] || null;
    let trainerData = null;
    if (activeAssignment && activeAssignment.trainer) {
      const isSuspended = activeAssignment.trainer.status !== "ACTIVE";
      trainerData = {
        id: activeAssignment.trainer.id,
        name: activeAssignment.trainer.name,
        avatarUrl: activeAssignment.trainer.avatarUrl,
        phone: activeAssignment.trainer.phone,
        coachingFocus: activeAssignment.coachingFocus || "General Fitness & Health",
        startDate: activeAssignment.startDate,
        isReassignmentPending: isSuspended,
      };
    }

    // 7. Today's Workout determination
    const publishedPlan = member.workoutPlans[0] || null;
    let todayWorkout = null;

    if (publishedPlan && publishedPlan.workoutDays.length > 0) {
      const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const currentDayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long" }).format(now).toUpperCase();

      // Match today's day of week or pick the first day
      let dayMatch = publishedPlan.workoutDays.find(
        (d) => d.dayOfWeek?.toUpperCase() === currentDayName
      );


      // Check if there is already a session for today
      const { start: startOfDay, end: endOfDay } = getDateRangeForPeriod("today");

      const existingSession = await prisma.workoutSession.findFirst({
        where: {
          gymMemberId: member.id,
          planId: publishedPlan.id,
          sessionDate: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          exerciseLogs: true,
        },
      });

      if (dayMatch) todayWorkout = {
        planId: publishedPlan.id,
        planTitle: publishedPlan.title,
        goal: publishedPlan.goal,
        dayId: dayMatch.id,
        dayTitle: dayMatch.title,
        dayOfWeek: dayMatch.dayOfWeek,
        exercises: dayMatch.exercises.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          sets: e.sets,
          reps: e.reps,
          targetLoad: e.targetLoad,
          durationMinutes: e.durationMinutes,
          distanceMeters: e.distanceMeters,
          restSeconds: e.restSeconds,
          instructions: e.instructions,
          alternativeExercise: e.alternativeExercise,
          demoVideoUrl: e.demoVideoUrl,
        })),
        session: existingSession
          ? {
              id: existingSession.id,
              status: existingSession.status,
              startedAt: existingSession.startedAt,
              completedAt: existingSession.completedAt,
              durationMinutes: existingSession.durationMinutes,
              skipReason: existingSession.skipReason,
              memberNotes: existingSession.memberNotes,
              trainerFeedback: existingSession.trainerFeedback,
              exerciseLogs: existingSession.exerciseLogs,
            }
          : null,
      };
    }

    // 8. Gym Announcements
    const hasActiveMembership = member.memberships.some(m => m.status === MembershipStatus.ACTIVE && m.startDate <= now && m.endDate >= now);
    const announcements = await prisma.announcement.findMany({
      where: {
        isPublished: true, publishAt: { lte: now }, channels: { has: "IN_APP" },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [
            { audience: "ALL_MEMBERS" },
            ...(hasActiveMembership && member.status === "CURRENT" ? [{ audience: "ACTIVE_MEMBERS" as const }] : []),
            { audience: "SELECTED_MEMBERS", targetMemberIds: { hasSome: [member.id, current.user.id] } },
          ] },
        ],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        pinned: true,
        createdAt: true,
      },
    });

    // 9. Available Fee Plans (for Request Renewal modal)
    const freezePolicy = { maxDays: (await prisma.gymSettings.findFirst({ select: { maxFreezeDays: true } }))?.maxFreezeDays ?? 30 };
    const availablePlans = await prisma.feePlan.findMany({
      where: { isActive: true },
      orderBy: { membershipFee: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationValue: true,
        durationUnit: true,
        membershipFee: true,
        includedServices: true,
      },
    });

    // 10. Active Receiving Accounts (for payment submission)
    const receivingAccounts = await prisma.receivingAccount.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        displayName: true,
        accountTitle: true,
        accountNumber: true,
        type: true,
        instructions: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isSetupPending: false,
        member: {
          id: member.id,
          memberId: member.memberId,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email,
          photoUrl: member.photoUrl,
          fitnessGoal: member.fitnessGoal,
          joiningDate: member.joiningDate,
        },
        membership: membershipData,
        feeSummary: {
          outstanding: Math.round(totalOutstanding),
          overdue: Math.round(totalOverdue),
          upcomingInstallments: Math.round(totalUpcoming),
          advanceBalance: Math.round(member.advanceBalance || 0),
        },
        latestPayment,
        pendingTransfer,
        todayWorkout,
        trainer: trainerData,
        announcements,
        availablePlans,
        freezePolicy,
        receivingAccounts,
        lastUpdated: new Date().toISOString(),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("MEMBER_DASHBOARD_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Dashboard load karne mein masla pesh aya. Dobara koshish karein." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
