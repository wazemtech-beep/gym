import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: current.user.id },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId: current.user.id,
          emailPayment: true,
          emailMembership: true,
          emailTraining: true,
          emailAnnouncements: true,
          pushPayment: true,
          pushMembership: true,
          pushTraining: true,
          pushAnnouncements: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: prefs });
  } catch (error: any) {
    console.error("GET_NOTIFICATION_PREFS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Preferences load nahi huin." }, { status: 500 });
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const body = await req.json();
    const {
      emailPayment,
      emailMembership,
      emailTraining,
      emailAnnouncements,
      pushPayment,
      pushMembership,
      pushTraining,
      pushAnnouncements,
    } = body;

    const updated = await prisma.notificationPreference.upsert({
      where: { userId: current.user.id },
      create: {
        userId: current.user.id,
        emailPayment: emailPayment ?? true,
        emailMembership: emailMembership ?? true,
        emailTraining: emailTraining ?? true,
        emailAnnouncements: emailAnnouncements ?? true,
        pushPayment: pushPayment ?? true,
        pushMembership: pushMembership ?? true,
        pushTraining: pushTraining ?? true,
        pushAnnouncements: pushAnnouncements ?? true,
      },
      update: {
        ...(emailPayment !== undefined && { emailPayment: !!emailPayment }),
        ...(emailMembership !== undefined && { emailMembership: !!emailMembership }),
        ...(emailTraining !== undefined && { emailTraining: !!emailTraining }),
        ...(emailAnnouncements !== undefined && { emailAnnouncements: !!emailAnnouncements }),
        ...(pushPayment !== undefined && { pushPayment: !!pushPayment }),
        ...(pushMembership !== undefined && { pushMembership: !!pushMembership }),
        ...(pushTraining !== undefined && { pushTraining: !!pushTraining }),
        ...(pushAnnouncements !== undefined && { pushAnnouncements: !!pushAnnouncements }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences update ho gayi hain.",
      data: updated,
    });
  } catch (error: any) {
    console.error("SAVE_NOTIFICATION_PREFS_ERROR:", error);
    return NextResponse.json({ success: false, error: "Preferences save karne mein masla aya." }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
