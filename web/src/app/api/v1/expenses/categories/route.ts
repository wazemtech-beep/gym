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
    const includeInactive = searchParams.get("includeInactive") === "true";

    const categories = await prisma.expenseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Get Categories Error:", error);
    return NextResponse.json(
      { success: false, error: "Categories load karne mein khata aayi." },
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
        { success: false, error: "Nayi category sirf Owner add kar sakta hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Category ka naam lazmi hai." },
        { status: 400 }
      );
    }

    const trimmed = name.trim();

    // Check duplicate
    const existing = await prisma.expenseCategory.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });

    if (existing) {
      if (!existing.isActive) {
        // Reactivate
        const reactivated = await prisma.expenseCategory.update({
          where: { id: existing.id },
          data: { isActive: true, description: description?.trim() || existing.description },
        });
        return NextResponse.json({
          success: true,
          message: `Category '${reactivated.name}' ko dobaara activate kar diya gaya!`,
          category: reactivated,
        });
      }
      return NextResponse.json(
        { success: false, error: `Category '${trimmed}' pehle se maujood hai.` },
        { status: 400 }
      );
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: trimmed,
        description: description ? description.trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Category '${category.name}' add ho gayi!`,
      category,
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    return NextResponse.json(
      { success: false, error: "Category create karne mein masla aaya." },
      { status: 500 }
    );
  }
}

async function patchHandler(req: NextRequest) {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return NextResponse.json({ success: false, error: "Pehle login karein." }, { status: 401 });
    }

    if (current.user.role !== Role.OWNER) {
      return NextResponse.json(
        { success: false, error: "Category status badalne ka ikhtiyar sirf Owner ke paas hai." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Category ID aur active status lazmi hain." },
        { status: 400 }
      );
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({
      success: true,
      message: `Category '${updated.name}' ab ${updated.isActive ? "ACTIVE" : "INACTIVE"} hai.`,
      category: updated,
    });
  } catch (error) {
    console.error("Toggle Category Error:", error);
    return NextResponse.json(
      { success: false, error: "Category status badalne mein masla aaya." },
      { status: 500 }
    );
  }
}

export const GET = withReadCache(getHandler);
export const POST = withReadCache(postHandler);
export const PATCH = withReadCache(patchHandler);
