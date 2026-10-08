import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { isSessionReauthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role, PaymentMethod } from "@prisma/client";
import { hasUserPermission } from "@/lib/permissions";

async function getHandler() {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }
    if (!hasUserPermission(current.user, "PAYMENT_RECORD_VERIFY") && !hasUserPermission(current.user, "EXPENSES_MANAGE")) return NextResponse.json({ success: false, error: "Account administration access denied." }, { status: 403 });

    const accounts = await prisma.receivingAccount.findMany({
      include: {
        _count: {
          select: {
            payments: true,
            transferSubmissions: true,
            expensePayments: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    const formatted = accounts.map((acc) => ({
      id: acc.id,
      type: acc.type,
      displayName: acc.displayName,
      accountTitle: acc.accountTitle,
      accountNumber: acc.accountNumber,
      instructions: acc.instructions,
      isActive: acc.isActive,
      isDefault: acc.isDefault,
      createdAt: acc.createdAt,
      totalUsageCount:
        acc._count.payments +
        acc._count.transferSubmissions +
        acc._count.expensePayments,
    }));

    return NextResponse.json({
      success: true,
      accounts: formatted,
    });
  } catch (error) {
    console.error("Get Accounts Error:", error);
    return NextResponse.json(
      { success: false, error: "Accounts load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Payment accounts add karne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    // Sensitive check: requires recent password re-authentication (Requirement 14.3)
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

    const body = await req.json();
    const {
      type,
      displayName,
      accountTitle,
      accountNumber,
      instructions,
      isDefault = false,
    } = body;

    if (!type || !displayName || !accountTitle || !accountNumber) {
      return NextResponse.json(
        { success: false, error: "Type, Display Name, Account Title aur Account Number lazmi hain." },
        { status: 400 }
      );
    }

    const validTypes = Object.values(PaymentMethod);
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Account type durust nahi hai. Options: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Mask account number for audit logs (only last 4 visible)
    const maskedNumber =
      accountNumber.length > 4
        ? "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4)
        : "****";

    const result = await prisma.$transaction(async (tx) => {
      // If setting this account as default, clear default from others
      if (isDefault) {
        await tx.receivingAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const newAccount = await tx.receivingAccount.create({
        data: {
          type,
          displayName: displayName.trim(),
          accountTitle: accountTitle.trim(),
          accountNumber: accountNumber.trim(),
          instructions: instructions ? instructions.trim() : null,
          isActive: true,
          isDefault: Boolean(isDefault),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "PAYMENT_ACCOUNT_CREATED",
          entityType: "RECEIVING_ACCOUNT",
          entityId: newAccount.id,
          details: JSON.stringify({
            displayName: newAccount.displayName,
            type: newAccount.type,
            accountTitle: newAccount.accountTitle,
            accountNumberMasked: maskedNumber,
            isDefault: newAccount.isDefault,
          }),
        },
      });

      return newAccount;
    }, { maxWait: 10000, timeout: 25000 });

    return NextResponse.json({
      success: true,
      message: `Receiving account '${result.displayName}' kamiyabi se add ho gaya.`,
      account: result,
    });
  } catch (error) {
    console.error("Create Account Error:", error);
    return NextResponse.json(
      { success: false, error: "Account create karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
