import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role, TransferProofStatus } from "@prisma/client";
import { readPrivateAssetToken } from "@/lib/privateAssets";

async function postHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!["MEMBER", "OWNER", "RECEPTIONIST"].includes(current.user.role)) return NextResponse.json({ success: false, error: "Transfer access denied." }, { status: 403 });
    // Must be member or owner/receptionist submitting on behalf of member
    let gymMemberId: string | null = null;

    if (current.user.role === Role.MEMBER) {
      const member = await prisma.gymMember.findUnique({
        where: { userId: current.user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member profile nahi mili." }, { status: 404 });
      }
      gymMemberId = member.id;
    } else {
      const bodyPreview = await req.clone().json().catch(() => ({}));
      gymMemberId = bodyPreview.memberId || null;
    }

    if (!gymMemberId) {
      return NextResponse.json({ success: false, error: "Member profile identify nahi ho saki." }, { status: 400 });
    }

    const body = await req.json();
    const { amount, receivingAccountId, transactionReference, proofImageUrl, transferDate } = body;

    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ success: false, error: "Durust amount darj karein." }, { status: 400 });
    }

    if (!receivingAccountId) {
      return NextResponse.json({ success: false, error: "Receiving account muntakhib karein." }, { status: 400 });
    }
    if (typeof transactionReference !== "string" || !transactionReference.trim() || transactionReference.length > 150) return NextResponse.json({ success: false, error: "Transfer reference enter karein." }, { status: 400 });
    let proof: URL;
    try { proof = new URL(String(proofImageUrl || ""), req.url); } catch { return NextResponse.json({ success: false, error: "Upload a valid transfer receipt." }, { status: 400 }); }
    const asset = readPrivateAssetToken(proof.searchParams.get("token") || "");
    if (proof.pathname !== "/api/v1/uploads/cloudinary/asset" || !asset || asset.category !== "transfers" || asset.ownerId !== current.user.id) return NextResponse.json({ success: false, error: "Upload your transfer receipt using the upload button." }, { status: 400 });
    const recordedDate = transferDate ? new Date(transferDate) : new Date();
    if (!Number.isFinite(recordedDate.getTime()) || recordedDate > new Date()) return NextResponse.json({ success: false, error: "Valid transfer date required." }, { status: 400 });

    const receivingAccount = await prisma.receivingAccount.findUnique({
      where: { id: receivingAccountId },
    });

    if (!receivingAccount || !receivingAccount.isActive) {
      return NextResponse.json(
        { success: false, error: "Muntakhib receiving account active nahi hai." },
        { status: 400 }
      );
    }

    // Create Transfer Submission with status PENDING
    // CRITICAL: Dues are NOT updated, payment is NOT paid until staff verifies
    const submission = await prisma.transferSubmission.create({
      data: {
        gymMemberId,
        amount: numAmount,
        receivingAccountId,
        transactionReference: transactionReference?.trim() || null,
        proofImageUrl: proof.pathname + proof.search,
        transferDate: recordedDate,
        status: TransferProofStatus.PENDING,
      },
      include: {
        receivingAccount: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: current.user.id,
        actorName: current.user.name,
        actorRole: current.user.role,
        action: "TRANSFER_PROOF_SUBMITTED",
        entityType: "TRANSFER_SUBMISSION",
        entityId: submission.id,
        details: JSON.stringify({
          memberId: gymMemberId,
          amount: numAmount,
          receivingAccount: receivingAccount.displayName,
          reference: transactionReference,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transfer proof kamyabi se jama ho gaya. Staff verification ke baad status update hoga.",
      data: {
        submissionId: submission.id,
        amount: submission.amount,
        status: submission.status,
        receivingAccount: submission.receivingAccount.displayName,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error: any) {
    console.error("MEMBER_TRANSFER_SUBMIT_ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Transfer proof jama karne mein masla aya." },
      { status: 500 }
    );
  }
}

export const POST = withReadCache(postHandler);
