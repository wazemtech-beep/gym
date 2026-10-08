import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { CashSessionStatus, Role } from "@prisma/client";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "PAYMENT_RECORD_VERIFY")) {
      return NextResponse.json(
        { success: false, error: "Cash session close karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { sessionId, countedCash, differenceReason } = body;

    const parsedCounted = parseFloat(countedCash);
    if (!Number.isFinite(parsedCounted) || parsedCounted < 0) {
      return NextResponse.json(
        { success: false, error: "Actual counted cash amount darj karein." },
        { status: 400 }
      );
    }

    // Find the session
    const session = sessionId
      ? await prisma.cashSession.findFirst({ where: { id: sessionId, staffId: current.user.id } })
      : await prisma.cashSession.findFirst({
          where: { status: CashSessionStatus.OPEN, staffId: current.user.id },
          orderBy: { openedAt: "desc" },
        });

    if (!session || session.status !== CashSessionStatus.OPEN) {
      return NextResponse.json(
        { success: false, error: "Koi open cash session nahi mila." },
        { status: 404 }
      );
    }

    const expected = session.expectedCash;
    const difference = parsedCounted - expected; // Negative = shortage, Positive = surplus
    if (difference !== 0 && !String(differenceReason || "").trim()) return NextResponse.json({ success: false, error: "Cash difference ki wajah lazmi hai." }, { status: 400 });

    // Find gym owner to record handover
    const owner = await prisma.user.findFirst({
      where: { role: Role.OWNER },
    });

    const closed = await prisma.cashSession.update({
      where: { id: session.id, status: CashSessionStatus.OPEN, expectedCash: expected },
      data: {
        countedCash: parsedCounted,
        difference,
        differenceReason: difference !== 0 ? differenceReason : null,
        closedAt: new Date(),
        status: CashSessionStatus.CLOSED,
        handoverToId: owner?.id || null,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "CASH_SESSION_CLOSED",
        entityType: "CASH_SESSION",
        entityId: closed.id,
        details: JSON.stringify({
          sessionNumber: closed.sessionNumber,
          expectedCash: expected,
          countedCash: parsedCounted,
          difference,
          hasShortage: difference < 0,
          reason: differenceReason || "Normal match",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Shift Cash Session closed! Expected: Rs. ${expected.toLocaleString()}, Counted: Rs. ${parsedCounted.toLocaleString()}, Difference: Rs. ${difference.toLocaleString()}`,
      session: closed,
    });
  } catch (error) {
    console.error("Close Cash Session Error:", error);
    return NextResponse.json(
      { success: false, error: "Cash session close karne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
