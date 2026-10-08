import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { sanitizeAuditData } from "@/lib/audit";

async function getHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    // Requirement 14.10: "Owner operational audit access karega. Poore gym ka audit staff/member ke liye nahi."
    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Audit history dekhne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "40", 10)));
    const skip = (page - 1) * limit;

    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const actorId = searchParams.get("actorId");
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const recordId = searchParams.get("recordId");
    const search = searchParams.get("search");

    const where: Record<string, any> = {};

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        where.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (actorId && actorId !== "ALL") {
      where.actorId = actorId;
    }

    if (entityType && entityType !== "ALL") {
      where.entityType = entityType;
    }

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (recordId) {
      where.OR = [
        { entityId: { contains: recordId, mode: "insensitive" } },
        { relatedEntityId: { contains: recordId, mode: "insensitive" } },
      ];
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { actorName: { contains: term, mode: "insensitive" } },
        { action: { contains: term, mode: "insensitive" } },
        { entityId: { contains: term, mode: "insensitive" } },
        { details: { contains: term, mode: "insensitive" } },
        { reason: { contains: term, mode: "insensitive" } },
      ];
    }

    const [logs, totalCount, distinctActions, distinctEntities, actors] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        select: { action: true },
        distinct: ["action"],
        orderBy: { action: "asc" },
      }),
      prisma.auditLog.findMany({
        select: { entityType: true },
        distinct: ["entityType"],
        orderBy: { entityType: "asc" },
      }),
      prisma.user.findMany({
        where: { role: { in: [Role.OWNER, Role.RECEPTIONIST, Role.TRAINER] } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const sanitizedLogs = logs.map((log) => {
      let parsedDetails = null;
      if (log.details) {
        try {
          parsedDetails = sanitizeAuditData(JSON.parse(log.details));
        } catch {
          parsedDetails = log.details;
        }
      }

      return {
        id: log.id,
        createdAt: log.createdAt,
        actorId: log.actorId,
        actorName: log.actorName || log.actor?.name || "System",
        actorRole: log.actorRole || log.actor?.role || "SYSTEM",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        reason: log.reason,
        changes: log.changes,
        details: parsedDetails,
        ipAddress: log.ipAddress,
      };
    });

    return NextResponse.json({
      success: true,
      logs: sanitizedLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      filters: {
        availableActions: distinctActions.map((a) => a.action),
        availableEntityTypes: distinctEntities.map((e) => e.entityType),
        actors,
      },
    });
  } catch (error) {
    console.error("Get Audit Logs Error:", error);
    return NextResponse.json(
      { success: false, error: "Audit history load karne mein khata aayi." },
      { status: 500 }
    );
  }
}

// Requirement 14.11: "Normal app se audit entry edit/delete nahi hogi, owner bhi nahi."
async function postHandler() {
  return NextResponse.json(
    { success: false, error: "Audit logs are strictly append-only and cannot be created directly." },
    { status: 405 }
  );
}

async function putHandler() {
  return NextResponse.json(
    { success: false, error: "Audit logs are tamper-evident and cannot be edited." },
    { status: 405 }
  );
}

async function patchHandler() {
  return NextResponse.json(
    { success: false, error: "Audit logs are tamper-evident and cannot be modified." },
    { status: 405 }
  );
}

async function deleteHandler() {
  return NextResponse.json(
    { success: false, error: "Audit logs cannot be deleted through the application." },
    { status: 405 }
  );
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const PUT = withReadCache(putHandler);
export const PATCH = withReadCache(patchHandler);
export const DELETE = withReadCache(deleteHandler);
