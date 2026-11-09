import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { lockDrawSession } from "@/lib/draw-lock";
import { ApiError, errorResponse, requireAdminResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonObject } from "@/lib/validation";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await getCurrentAdmin();
    if (!admin) {
      return requireAdminResponse();
    }

    const { eventId } = await context.params;
    const body = await readJsonObject(request);
    const allowedKeys = new Set(["name", "description", "status"]);
    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some((key) => !allowedKeys.has(key))
    ) {
      throw new ApiError("ข้อมูลที่แก้ไขไม่ถูกต้อง", 400);
    }

    const data: {
      name?: string;
      description?: string | null;
      status?: "DRAFT" | "ACTIVE" | "COMPLETED";
    } = {};
    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
        throw new ApiError("ชื่อกิจกรรมต้องมีความยาว 1–120 ตัวอักษร", 400);
      }
      data.name = body.name.trim();
    }
    if ("description" in body) {
      if (typeof body.description !== "string" || body.description.length > 5000) {
        throw new ApiError("รายละเอียดกิจกรรมต้องไม่เกิน 5,000 ตัวอักษร", 400);
      }
      data.description = body.description.trim() || null;
    }
    if ("status" in body) {
      if (body.status !== "ACTIVE" && body.status !== "COMPLETED") {
        throw new ApiError("สถานะกิจกรรมที่เลือกไม่ถูกต้อง", 400);
      }
      data.status = body.status;
    }

    const event = await prisma.$transaction(async (transaction) => {
      await lockDrawSession(transaction, eventId);
      const current = await transaction.drawSession.findUnique({
        where: { id: eventId },
      });
      if (!current) {
        throw new ApiError("ไม่พบกิจกรรมนี้", 404);
      }

      if (data.status) {
        const validTransition =
          (current.status === "DRAFT" && data.status === "ACTIVE") ||
          (current.status === "ACTIVE" && data.status === "COMPLETED");
        if (!validTransition) {
          throw new ApiError("ไม่สามารถเปลี่ยนสถานะกิจกรรมในลำดับนี้ได้", 409);
        }
        if (data.status === "COMPLETED") {
          const pendingDraw = await transaction.drawHistory.findFirst({
            where: { drawSessionId: eventId, status: "PENDING" },
            select: { id: true },
          });
          if (pendingDraw) {
            throw new ApiError("กรุณายืนยันผลการสุ่มที่ค้างอยู่ก่อนปิดกิจกรรม", 409);
          }
        }
      }

      const updated = await transaction.drawSession.update({
        where: { id: eventId },
        data,
      });
      await transaction.auditLog.create({
        data: {
          adminId: admin.id,
          drawSessionId: eventId,
          action: "EVENT_UPDATED",
          details: { fields: Object.keys(data) },
        },
      });
      return updated;
    });

    return NextResponse.json({ event });
  } catch (error) {
    return errorResponse(error, "Admin event update failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await getCurrentAdmin();
    if (!admin) {
      return requireAdminResponse();
    }

    const { eventId } = await context.params;
    await prisma.$transaction(async (transaction) => {
      await lockDrawSession(transaction, eventId);
      const event = await transaction.drawSession.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      if (!event) {
        throw new ApiError("ไม่พบกิจกรรมนี้", 404);
      }
      if (event.status !== "DRAFT") {
        throw new ApiError("ลบได้เฉพาะกิจกรรมฉบับร่างเท่านั้น", 409);
      }
      const history = await transaction.drawHistory.findFirst({
        where: { drawSessionId: eventId },
        select: { id: true },
      });
      if (history) {
        throw new ApiError("กิจกรรมที่มีประวัติการสุ่มแล้วไม่สามารถลบได้", 409);
      }

      await transaction.auditLog.create({
        data: {
          adminId: admin.id,
          drawSessionId: eventId,
          action: "EVENT_DELETED",
        },
      });
      await transaction.drawSession.delete({ where: { id: eventId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Admin event deletion failed");
  }
}
