import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { isSessionReauthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function patchHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Payment accounts edit karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    if (!isSessionReauthenticated(current.session)) {
      return NextResponse.json(
        {
          success: false,
          requiresReauth: true,
          reauthRequired: true,
          error: "Hassas (sensitive) tabdeeli ke liye pehle apna password dobara verify karein.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await prisma.receivingAccount.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Account nahi mila." }, { status: 404 });
    }

    const body = await req.json();
    const {
      displayName,
      accountTitle,
      accountNumber,
      instructions,
      isActive,
      isDefault,
    } = body;

    const data: Record<string, any> = {};
    if (displayName !== undefined) data.displayName = displayName.trim();
    if (accountTitle !== undefined) data.accountTitle = accountTitle.trim();
    if (accountNumber !== undefined) data.accountNumber = accountNumber.trim();
    if (instructions !== undefined) data.instructions = instructions ? instructions.trim() : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (isDefault !== undefined) data.isDefault = Boolean(isDefault);

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.receivingAccount.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false },
        });
      }

      const acc = await tx.receivingAccount.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "PAYMENT_ACCOUNT_UPDATED",
          entityType: "RECEIVING_ACCOUNT",
          entityId: acc.id,
          details: JSON.stringify({
            displayName: acc.displayName,
            isActive: acc.isActive,
            isDefault: acc.isDefault,
            fieldsUpdated: Object.keys(data),
          }),
        },
      });

      return acc;
    }, { maxWait: 10000, timeout: 25000 });

    return NextResponse.json({
      success: true,
      message: `Account '${updated.displayName}' update ho gaya.`,
      account: updated,
    });
  } catch (error) {
    console.error("Update Account Error:", error);
    return NextResponse.json(
      { success: false, error: "Account update karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function deleteHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Account delete karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    if (!isSessionReauthenticated(current.session)) {
      return NextResponse.json(
        {
          success: false,
          requiresReauth: true,
          reauthRequired: true,
          error: "Hassas (sensitive) tabdeeli ke liye pehle apna password dobara verify karein.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const account = await prisma.receivingAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payments: true,
            transferSubmissions: true,
            expensePayments: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ success: false, error: "Account nahi mila." }, { status: 404 });
    }

    const totalUsage =
      account._count.payments +
      account._count.transferSubmissions +
      account._count.expensePayments;

    // Requirement 14.3: "Used account delete nahi hoga. Old payments ka receiving account overwrite nahi hoga."
    if (totalUsage > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Yeh account ${totalUsage} transactions mein istemal ho chuka hai. History ko mehfooz rakhne ke liye isay Delete nahi kiya ja sakta. Barah-e-karam isay 'Deactivate' karein.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.receivingAccount.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "PAYMENT_ACCOUNT_DELETED",
          entityType: "RECEIVING_ACCOUNT",
          entityId: id,
          details: JSON.stringify({
            displayName: account.displayName,
            type: account.type,
          }),
        },
      });
    }, { maxWait: 10000, timeout: 25000 });

    return NextResponse.json({
      success: true,
      message: `Unused account '${account.displayName}' delete kar diya gaya.`,
    });
  } catch (error) {
    console.error("Delete Account Error:", error);
    return NextResponse.json(
      { success: false, error: "Account delete karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const PATCH = withReadCache(patchHandler);
export const DELETE = withReadCache(deleteHandler);
