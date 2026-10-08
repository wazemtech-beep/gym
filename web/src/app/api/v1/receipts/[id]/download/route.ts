import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateReceiptPdf } from "@/lib/pdfGenerator";
import { Role } from "@prisma/client";

async function getHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Role guard: Trainer cannot view receipts
    if (current.user.role === Role.TRAINER) {
      return NextResponse.json(
        { success: false, error: "Trainer role ko receipts access karne ki ijazat nahi hai." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "A4") as "A4" | "THERMAL_80MM";

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { receiptNumber: id }],
      },
      include: {
        gymMember: true,
        recordedBy: { select: { name: true } },
        allocations: {
          include: { invoice: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Receipt nahi mili." }, { status: 404 });
    }

    // If member, ensure they only download their own receipt
    if (current.user.role === Role.MEMBER) {
      const currentMember = await prisma.gymMember.findFirst({
        where: { userId: current.user.id },
      });
      if (!currentMember || currentMember.id !== payment.gymMemberId) {
        return NextResponse.json(
          { success: false, error: "Aap sirf apni receipts download kar sakte hain." },
          { status: 403 }
        );
      }
    }

    const snapshot = payment.brandingSnapshot as Record<string, any> | null;
    const settings = snapshot || await prisma.gymSettings.findFirst();

    const pdfBuffer = generateReceiptPdf(
      {
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate.toISOString().split("T")[0],
        memberName: snapshot?.memberName ?? payment.gymMember.fullName,
        memberId: snapshot?.memberId ?? payment.gymMember.memberId,
        memberPhone: snapshot?.memberPhone ?? payment.gymMember.phone,
        amount: payment.amount,
        method: payment.method,
        referenceNumber: payment.referenceNumber || undefined,
        recordedBy: payment.recordedBy?.name || "Front Desk",
        memberRemainingDues: payment.memberRemainingDues ?? undefined,
        gymName: settings?.gymName || "OXGEN FITNESS CLUB",
        gymPhone: settings?.contactPhone || undefined,
        gymAddress: settings?.address || undefined,
        receiptFooter: settings?.receiptFooter || "Thank you for choosing OXGEN GYM",
      },
      format
    );

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${payment.receiptNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    console.error("RECEIPT_PDF_DOWNLOAD_ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const GET = withReadCache(getHandler);
