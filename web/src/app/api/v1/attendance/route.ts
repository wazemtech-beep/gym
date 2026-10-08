import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "today";
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "ALL"; // ALL, VALID, VOID
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const skip = (page - 1) * limit;

    const now = new Date();
    let gteDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    let lteDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dateRange === "yesterday") {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      gteDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      lteDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (dateRange === "this_week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      gteDate = startOfWeek;
    } else if (dateRange === "this_month") {
      gteDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "all") {
      gteDate = new Date(2020, 0, 1);
    }

    const whereClause: any = {
      checkIn: { gte: gteDate, lte: lteDate },
    };

    if (statusParam === "VALID") {
      whereClause.isVoid = false;
    } else if (statusParam === "VOID") {
      whereClause.isVoid = true;
    }

    if (search.trim()) {
      const term = search.trim();
      whereClause.gymMember = {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { memberId: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
        ],
      };
    }

    // Role check: If trainer, only see assigned members
    if (current.user.role === Role.TRAINER) {
      whereClause.gymMember = {
        ...whereClause.gymMember,
        trainerId: current.user.id,
      };
    }

    const [totalCount, records, allRecordsInPeriod, settings] = await Promise.all([
      prisma.attendanceRecord.count({ where: whereClause }),
      prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          gymMember: {
            select: {
              id: true,
              memberId: true,
              fullName: true,
              phone: true,
              photoUrl: true,
              status: true,
            },
          },
          membership: {
            select: {
              planName: true,
              status: true,
              endDate: true,
            },
          },
          recordedBy: {
            select: { name: true, role: true },
          },
          voidedBy: {
            select: { name: true },
          },
        },
        orderBy: { checkIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendanceRecord.findMany({
        where: { checkIn: { gte: gteDate, lte: lteDate } },
        select: {
          gymMemberId: true,
          isVoid: true,
          overrideReason: true,
        },
      }),
      prisma.gymSettings.findFirst(),
    ]);

    const validRecords = allRecordsInPeriod.filter((r) => !r.isVoid);
    const uniqueMemberIds = new Set(validRecords.map((r) => r.gymMemberId));
    const overridesCount = validRecords.filter((r) => !!r.overrideReason).length;
    const voidedCount = allRecordsInPeriod.filter((r) => r.isVoid).length;

    return NextResponse.json({
      success: true,
      attendanceEnabled: settings?.attendanceEnabled || false,
      summary: {
        totalVisits: validRecords.length,
        uniqueMembers: uniqueMemberIds.size,
        overridesCount,
        voidedCount,
      },
      records,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get Attendance Error:", error);
    return NextResponse.json(
      { success: false, error: "Attendance records load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
