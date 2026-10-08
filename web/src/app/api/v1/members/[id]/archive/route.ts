import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MemberRecordStatus, Role } from "@prisma/client";

async function postHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Strictly Owner only can archive or unarchive members (Requirement Point 10 & 11)
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Member ko archive/unarchive karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, reason } = body; // action: "ARCHIVE" | "UNARCHIVE"

    const member = await prisma.gymMember.findFirst({
      where: {
        OR: [{ id }, { memberId: id }],
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member nahi mila." }, { status: 404 });
    }

    if (action === "UNARCHIVE" || member.status === MemberRecordStatus.ARCHIVED) {
      // Unarchive flow
      const restored = await prisma.$transaction(async (tx) => {
        const updated = await tx.gymMember.update({
          where: { id: member.id },
          data: {
            status: MemberRecordStatus.CURRENT,
            archivedAt: null,
            archiveReason: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "MEMBER_UNARCHIVED",
            entityType: "GYM_MEMBER",
            entityId: member.id,
            details: JSON.stringify({
              memberId: member.memberId,
              fullName: member.fullName,
              message: "Member unarchived and restored to active gym roster.",
            }),
          },
        });

        return updated;
      });

      return NextResponse.json({
        success: true,
        message: `${restored.fullName} (${restored.memberId}) unarchive ho kar active roster mein wapas aa chuka hai.`,
        member: restored,
      });
    } else {
      // Archive flow
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { success: false, error: "Member archive karne ki waja (reason) likhna lazmi hai." },
          { status: 400 }
        );
      }

      const archived = await prisma.$transaction(async (tx) => {
        const updated = await tx.gymMember.update({
          where: { id: member.id },
          data: {
            status: MemberRecordStatus.ARCHIVED,
            archivedAt: new Date(),
            archiveReason: reason.trim(),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: current.user.id,
            actorName: current.user.name,
            actorRole: current.user.role,
            action: "MEMBER_ARCHIVED",
            entityType: "GYM_MEMBER",
            entityId: member.id,
            details: JSON.stringify({
              memberId: member.memberId,
              fullName: member.fullName,
              reason: reason.trim(),
            }),
          },
        });

        return updated;
      });

      return NextResponse.json({
        success: true,
        message: `${archived.fullName} (${archived.memberId}) kamiyabi se archive ho gaya. Records aur dues reports mein balance mehfooz rahega.`,
        member: archived,
      });
    }
  } catch (error) {
    console.error("Archive Member Error:", error);
    return NextResponse.json(
      { success: false, error: "Member archive/unarchive karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
