import { withReadCache } from "@/lib/serverReadCache";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validateRegistration } from "@/lib/registrationValidation";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function postHandler(req: NextRequest) {
  let uploadedId: string | null = null;
  let saved = false;
  try {
    const origin = req.headers.get("origin");
    const allowed = [req.nextUrl.origin, ...(process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : [])];
    if (origin && !allowed.includes(origin)) return reply({ success: false, error: "Request origin not allowed." }, 403);
    const multipart = req.headers.get("content-type")?.includes("multipart/form-data");
    if (Number(req.headers.get("content-length") || 0) > (multipart ? 2 * 1024 * 1024 + 16384 : 8192)) return reply({ success: false, error: "Form is too large." }, 413);
    let body: unknown;
    let photo: File | null = null;
    if (multipart) {
      const fields = await req.formData();
      const file = fields.get("photo");
      if (file instanceof File && file.size) photo = file;
      fields.delete("photo"); body = Object.fromEntries(fields);
      if (JSON.stringify(body).length > 8192) return reply({ success: false, error: "Form is too large." }, 413);
    } else {
      const text = await req.text();
      if (text.length > 8192) return reply({ success: false, error: "Form is too large." }, 413);
      try { body = JSON.parse(text); } catch { return reply({ success: false, error: "Invalid form." }, 400); }
    }
    const validation = validateRegistration(body);
    if (!validation.success) return reply({ success: false, error: validation.error }, 400);
    const { password, dateOfBirth, joiningDate, ...data } = validation.data;
    const ipHash = createHash("sha256").update(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0,128) || req.headers.get("x-real-ip")?.slice(0,128) || "unknown").digest("hex");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (await prisma.memberRegistrationRequest.count({ where: { ipHash, createdAt: { gte: since } } }) >= 5) return reply({ success: false, error: "Too many requests. Please contact reception or try tomorrow." }, 429);
    const passwordHash = await bcrypt.hash(password, 12);
    let photoUrl: string | null = null;
    if (photo) {
      if (photo.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return reply({ success: false, error: "Choose a JPG, PNG or WebP photo up to 2 MB." }, 400);
      const bytes = Buffer.from(await photo.arrayBuffer());
      const valid = (photo.type === "image/jpeg" && bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) || (photo.type === "image/png" && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (photo.type === "image/webp" && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP");
      if (!valid) return reply({ success: false, error: "The selected file is not a supported photo." }, 400);
      const upload = await uploadToCloudinary(bytes, { folder: "oxgen-gym/registration", resourceType: "image", transformation: [{ width: 600, height: 600, crop: "limit" }] });
      uploadedId = upload.publicId; photoUrl = upload.secureUrl;
    }
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('member-register'))`;
      if (await tx.memberRegistrationRequest.count({ where: { ipHash, createdAt: { gte: since } } }) >= 5) return { error: "Too many requests. Please try tomorrow.", status: 429 };
      const user = await tx.user.findFirst({ where: { OR: [{ email: { equals: data.email, mode: "insensitive" } }, { phone: data.phone }] }, select: { id: true } });
      const member = await tx.gymMember.findFirst({ where: { OR: [{ email: { equals: data.email, mode: "insensitive" } }, { phone: data.phone }] }, select: { id: true } });
      const pending = await tx.memberRegistrationRequest.findFirst({ where: { status: "PENDING", OR: [{ email: data.email }, { phone: data.phone }] }, select: { id: true } });
      if (user || member || pending) return { error: "An account, member record or pending request already uses these details. Contact reception for access.", status: 409 };
      const request = await tx.memberRegistrationRequest.create({ data: { ...data, photoUrl, joiningDate: joiningDate ? new Date(joiningDate + "T00:00:00+05:00") : null, dateOfBirth: dateOfBirth ? new Date(dateOfBirth + "T00:00:00Z") : null, passwordHash, ipHash } });
      const owners = await tx.user.findMany({ where: { role: "OWNER", status: "ACTIVE" }, select: { id: true } });
      await tx.notification.createMany({ data: owners.map(owner => ({ userId: owner.id, title: "New registration request", message: data.fullName + " has requested member access.", entityType: "MEMBER_REGISTRATION", entityId: request.id, actionUrl: "/admin/members" })) });
      await tx.auditLog.create({ data: { action: "MEMBER_REGISTRATION_SUBMITTED", entityType: "MEMBER_REGISTRATION", entityId: request.id, details: JSON.stringify({ status: "PENDING" }) } });
      return { id: request.id };
    }, { maxWait: 10000, timeout: 30000 });
    if ("error" in result) return reply({ success: false, error: result.error }, result.status);
    saved = true;
    return reply({ success: true, requestId: result.id, message: "Request submitted. You can sign in after admin approval." }, 201);
  } catch (cause) {
    console.error("MEMBER_REGISTRATION_ERROR", cause instanceof Error ? cause.name : "Unknown error");
    return reply({ success: false, error: "Could not submit your request. Please try again or contact reception." }, 500);
  } finally {
    if (uploadedId && !saved) await deleteFromCloudinary(uploadedId).catch(() => false);
  }
}

export const POST = withReadCache(postHandler);
