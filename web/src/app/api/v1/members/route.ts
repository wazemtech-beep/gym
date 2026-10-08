import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { hasRolePermission, hasUserPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { MemberRecordStatus, InvoiceStatus } from "@prisma/client";
import { generateNextMemberId, normalizePhoneNumber } from "@/lib/members";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();

    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "Members list access karne ki permission nahi hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "CURRENT"; // CURRENT, ARCHIVED, ALL
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    // Filter by record status
    if (statusParam === "CURRENT") {
      whereClause.status = MemberRecordStatus.CURRENT;
    } else if (statusParam === "ARCHIVED") {
      whereClause.status = MemberRecordStatus.ARCHIVED;
    }

    // Search by name, phone, or memberId
    if (search.trim()) {
      const term = search.trim();
      const normPhone = normalizePhoneNumber(term);
      whereClause.OR = [
        { fullName: { contains: term, mode: "insensitive" } },
        { memberId: { contains: term, mode: "insensitive" } },
        { phone: { contains: normPhone || term } },
      ];
    }

    const [totalCount, members] = await Promise.all([
      prisma.gymMember.count({ where: whereClause }),
      prisma.gymMember.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, status: true, mustChangePassword: true },
          },
          trainer: {
            select: { id: true, name: true },
          },
          invoices: {
            where: {
              status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
            },
            select: { balanceAmount: true, dueDate: true, status: true },
          },
          memberships: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              planName: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // Format member records with computed dues, membership & app access
    const formattedMembers = members.map((m) => {
      const totalDues = m.invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
      const isOverdue = m.invoices.some((inv) => new Date(inv.dueDate) < new Date());

      let appAccessStatus = "NOT_ACTIVATED";
      if (m.user) {
        appAccessStatus = m.user.status; // ACTIVE or SUSPENDED
      }

      const latestMembership = m.memberships[0] || null;

      return {
        id: m.id,
        memberId: m.memberId,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        photoUrl: m.photoUrl,
        joiningDate: m.joiningDate,
        status: m.status,
        archivedAt: m.archivedAt,
        archiveReason: m.archiveReason,
        fitnessGoal: m.fitnessGoal,
        assignedTrainer: m.trainer ? m.trainer.name : null,
        currentMembership: latestMembership
          ? {
              planName: latestMembership.planName,
              status: latestMembership.status,
              startDate: latestMembership.startDate,
              endDate: latestMembership.endDate,
            }
          : null,
        appAccessStatus,
        totalDues,
        isOverdue,
      };
    });

    return NextResponse.json({
      success: true,
      members: formattedMembers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get Members API Error:", error);
    return NextResponse.json(
      { success: false, error: "Members list load karne mein khata aayi." },
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

    if (!hasUserPermission(current.user, "MEMBER_REGISTER_UPDATE")) {
      return NextResponse.json(
        { success: false, error: "Member add karne ki permission nahi hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      fullName,
      phone,
      email,
      photoUrl,
      joiningDate,
      dateOfBirth,
      address,
      emergencyContactName,
      emergencyContactPhone,
      fitnessGoal,
      limitations,
      staffNote,
      openingDues,
      allowFamilyDuplicate,
      familyContactReason,
      admissionFeePreviouslyPaid = false,
      admissionHistoryNote,
    } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { success: false, error: "Member ka poora naam aur phone number lazmi hain." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: "Durust phone number darj karein (e.g. 03001234567)." },
        { status: 400 }
      );
    }

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    if (allowFamilyDuplicate && !String(familyContactReason || "").trim()) return NextResponse.json({ success: false, error: "Shared family contact ki wajah lazmi hai." }, { status: 400 });

    if (admissionFeePreviouslyPaid && !String(admissionHistoryNote || "").trim()) return NextResponse.json({ success: false, error: "Record a note for imported admission history." }, { status: 400 });
    // 1. Check duplicate phone unless authorized family duplicate
    const existingWithPhone = await prisma.gymMember.findFirst({
      where: { phone: normalizedPhone },
    });

    if (existingWithPhone && !allowFamilyDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Is phone number par member pehle se mojood hai: ${existingWithPhone.fullName} (${existingWithPhone.memberId}). Returning member ke liye purani profile reactivate karein ya family duplicate confirm karein.`,
          duplicateMemberId: existingWithPhone.memberId,
        },
        { status: 400 }
      );
    }

    // 2. Check if email is linked to an existing login account
    if (cleanEmail) {
      const existingUser = await prisma.user.findFirst({
        where: { email: cleanEmail },
      });
      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: "Yeh email pehle se kisi account ke sath linked hai.",
          },
          { status: 400 }
        );
      }
    }

    // 3. Generate sequential unique Member ID
    const actualJoiningDate = joiningDate ? new Date(joiningDate) : new Date();
    const parsedOpeningDues = parseFloat(openingDues) || 0;

    // 4. Save Member + Optional Opening Dues in transaction
    const newMember = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('member-register'))`;
      const duplicate = await tx.gymMember.findFirst({ where: { phone: normalizedPhone } });
      if (duplicate && !allowFamilyDuplicate) throw new Error("Contact already belongs to a member. Refresh and review the existing profile.");
      const nextMemberId = await generateNextMemberId(tx);
      const member = await tx.gymMember.create({
        data: {
          memberId: nextMemberId,
          fullName: fullName.trim(),
          phone: normalizedPhone,
          email: cleanEmail,
          photoUrl: photoUrl || null,
          joiningDate: actualJoiningDate,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          address: address || null,
          emergencyContactName: emergencyContactName || null,
          emergencyContactPhone: emergencyContactPhone ? normalizePhoneNumber(emergencyContactPhone) : null,
          fitnessGoal: fitnessGoal || null,
          limitations: limitations || null,
          staffNote: staffNote || null,
          openingDues: parsedOpeningDues,
          admissionFeePreviouslyPaid: Boolean(admissionFeePreviouslyPaid),
          admissionHistoryNote: String(admissionHistoryNote || "").trim() || null,
          status: MemberRecordStatus.CURRENT,
        },
      });

      // If opening dues entered (e.g. existing member balance Rs. 1,500), create opening invoice
      // Note: Opening dues is NOT collection because money has not been received yet!
      if (parsedOpeningDues > 0) {
        await tx.invoice.create({
          data: {
            invoiceNumber: `OXG-INV-OPN-${nextMemberId.replace("OXG-", "")}`,
            gymMemberId: member.id,
            title: "Opening Dues Balance",
            totalAmount: parsedOpeningDues,
            paidAmount: 0,
            balanceAmount: parsedOpeningDues,
            dueDate: actualJoiningDate,
            status: InvoiceStatus.UNPAID,
            notes: "Purani outstanding fees balance import",
          },
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          actorName: current.user.name,
          actorRole: current.user.role,
          action: "MEMBER_REGISTERED",
          entityType: "GYM_MEMBER",
          entityId: member.id,
          details: JSON.stringify({
            memberId: member.memberId,
            fullName: member.fullName,
            phone: member.phone,
            openingDues: parsedOpeningDues,
            familyContactReason: allowFamilyDuplicate ? String(familyContactReason).trim() : null,
          }),
        },
      });

      return member;
    });

    return NextResponse.json({
      success: true,
      message: `Member ${newMember.fullName} kamiyabi se add ho gaya! Member ID: ${newMember.memberId}`,
      member: newMember,
    });
  } catch (error) {
    console.error("Create Member API Error:", error);
    return NextResponse.json(
      { success: false, error: "Member add karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
