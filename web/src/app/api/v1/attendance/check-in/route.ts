import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, MembershipStatus, MemberRecordStatus, InvoiceStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/formatters";
import { hasUserPermission } from "@/lib/permissions";
import { applyMembershipLifecycle } from "@/lib/membershipLifecycle";
import { getDateRangeForPeriod } from "@/lib/businessDates";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "ATTENDANCE_MANAGE")) return NextResponse.json({ success: false, error: "Attendance access denied." }, { status: 403 });
    // 1. Verify if attendance feature is enabled
    const settings = await prisma.gymSettings.findFirst();
    if (!settings?.attendanceEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Attendance feature is currently DISABLED by gym owner. Pehle Settings se enable karein.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      memberId, // e.g. internal ID or visible memberId
      isOverride = false,
      overrideReason,
      confirmAnotherVisit = false,
    } = body;

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member ID darj karna lazmi hai." },
        { status: 400 }
      );
    }

    const target = await prisma.gymMember.findFirst({ where: { OR: [{ id: memberId }, { memberId }] }, select: { id: true } });
    if (!target) return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    await applyMembershipLifecycle(target.id);
    // 2. Fetch member with memberships and invoices
    const member = await prisma.gymMember.findFirst({
      where: {
        OR: [{ id: memberId }, { memberId: memberId }],
      },
      include: {
        memberships: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] } },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    if (member.status === MemberRecordStatus.ARCHIVED) {
      return NextResponse.json(
        { success: false, error: "Yeh member ARCHIVED hai. Normal check-in blocked hai." },
        { status: 400 }
      );
    }

    const now = new Date();
    const activeMembership = member.memberships.find(m => ["ACTIVE", "FROZEN"].includes(m.status) && m.startDate <= now && (m.endDate >= now || m.status === "FROZEN")) || member.memberships[0] || null;
    const totalDues = member.invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

    // 3. Check membership validity (Point 13.3)
    let isBlocked = false;
    let blockReason = "";

    if (!activeMembership) {
      isBlocked = true;
      blockReason = "Is member ka koi fee package / membership assign nahi hai.";
    } else if (activeMembership.status === MembershipStatus.EXPIRED) {
      isBlocked = true;
      blockReason = `Membership expire ho chuki hai (Expiry: ${activeMembership.endDate.toLocaleDateString()}).`;
    } else if (activeMembership.status === MembershipStatus.FROZEN) {
      isBlocked = true;
      blockReason = "Membership abhi FROZEN hai.";
    } else if (activeMembership.status === MembershipStatus.UPCOMING) {
      isBlocked = true;
      blockReason = `Membership abhi shuru nahi hui (Starts: ${activeMembership.startDate.toLocaleDateString()}).`;
    } else if (activeMembership.status === MembershipStatus.CANCELLED) {
      isBlocked = true;
      blockReason = "Membership cancel ho chuki hai.";
    }

    // If blocked and not overridden by owner
    if (isBlocked && !isOverride) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          error: `${blockReason} Normal check-in blocked hai.`,
          canOverride: current.user.role === Role.OWNER,
        },
        { status: 403 }
      );
    }

    if (isBlocked && isOverride) {
      if (current.user.role !== Role.OWNER) {
        return NextResponse.json(
          { success: false, error: "Sirf Owner exception allow kar sakta hai." },
          { status: 403 }
        );
      }
      if (!overrideReason || !overrideReason.trim()) {
        return NextResponse.json(
          { success: false, error: "Override allow karne ki waja (reason) likhna lazmi hai." },
          { status: 400 }
        );
      }
    }

    // 4. Double-click & Same-day visit detection (Point 13.4)
    const startOfToday = getDateRangeForPeriod("today").start;

    const todayVisits = await prisma.attendanceRecord.findMany({
      where: {
        gymMemberId: member.id,
        checkIn: { gte: startOfToday },
        isVoid: false,
      },
      orderBy: { checkIn: "desc" },
    });

    // Double-click protection: if checked in within the last 60 seconds
    if (todayVisits.length > 0) {
      const lastVisitTime = new Date(todayVisits[0].checkIn).getTime();
      const diffSecs = (now.getTime() - lastVisitTime) / 1000;
      if (diffSecs < 60) {
        return NextResponse.json({
          success: true,
          message: "Check-in pehle hi record ho chuka hai (double-click prevented).",
          record: todayVisits[0],
          isDuplicatePrevented: true,
        });
      }

      // If already visited today and receptionist hasn't clicked "confirmAnotherVisit"
      if (!confirmAnotherVisit) {
        return NextResponse.json({
          success: false,
          needsConfirmation: true,
          lastVisitTime: formatDateTime(todayVisits[0].checkIn),
          message: `${member.fullName} aaj pehle hi ${formatDateTime(todayVisits[0].checkIn)} par visit kar chuke hain. Kya aap doosri visit (Repeat Visit) record karna chahte hain?`,
        });
      }
    }

    // 5. Create Attendance Record
    const record = await prisma.$transaction(async (tx) => {
      const att = await tx.attendanceRecord.create({
        data: {
          gymMemberId: member.id,
          membershipId: activeMembership?.id || null,
          checkIn: now,
          method: "MANUAL",
          overrideReason: isOverride ? overrideReason.trim() : null,
          recordedById: current.user.id,
        },
        include: {
          gymMember: { select: { fullName: true, memberId: true } },
          recordedBy: { select: { name: true } },
        },
      });

      if (isOverride) {
        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "ATTENDANCE_OVERRIDE",
            entityType: "ATTENDANCE",
            entityId: att.id,
            details: JSON.stringify({
              memberId: member.memberId,
              memberName: member.fullName,
              reason: overrideReason.trim(),
            }),
          },
        });
      }

      return att;
    });

    let duesWarning = null;
    if (totalDues > 0) {
      duesWarning = `Member ke Rs. ${totalDues.toLocaleString()} dues baqi hain!`;
    }

    return NextResponse.json({
      success: true,
      message: `Check-in recorded for ${member.fullName} (${member.memberId})!`,
      record,
      duesWarning,
      member: {
        fullName: member.fullName,
        memberId: member.memberId,
        planName: activeMembership?.planName || "No Plan",
        totalDues,
      },
    });
  } catch (error) {
    console.error("Check-in Error:", error);
    return NextResponse.json(
      { success: false, error: "Check-in record karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
