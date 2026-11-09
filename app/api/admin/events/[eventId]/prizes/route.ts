import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { lockDrawSession } from "@/lib/draw-lock";
import { ApiError, errorResponse, requireAdminResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonObject } from "@/lib/validation";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await getCurrentAdmin();
    if (!admin) {
      return requireAdminResponse();
    }

    const { eventId } = await context.params;
    const body = await readJsonObject(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const drawType = body.drawType;
    if (!name || name.length > 120) {
      throw new ApiError("ชื่อประเภทรางวัลต้องมีความยาว 1–120 ตัวอักษร", 400);
    }
    if (drawType !== "FULL_TICKET" && drawType !== "LAST_3_DIGITS") {
      throw new ApiError("รูปแบบการสุ่มไม่ถูกต้อง", 400);
    }

    const prizeCategory = await prisma.$transaction(async (transaction) => {
      await lockDrawSession(transaction, eventId);
      const event = await transaction.drawSession.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      if (!event) {
        throw new ApiError("ไม่พบกิจกรรมนี้", 404);
      }
      if (event.status === "COMPLETED") {
        throw new ApiError("กิจกรรมที่ปิดแล้วไม่สามารถเพิ่มประเภทรางวัลได้", 409);
      }
      const pendingDraw = await transaction.drawHistory.findFirst({
        where: { drawSessionId: eventId, status: "PENDING" },
        select: { id: true },
      });
      if (pendingDraw) {
        throw new ApiError("กรุณายืนยันผลการสุ่มที่ค้างอยู่ก่อน", 409);
      }

      const category = await transaction.prizeCategory.create({
        data: { drawSessionId: eventId, name, drawType },
      });
      await transaction.auditLog.create({
        data: {
          adminId: admin.id,
          drawSessionId: eventId,
          action: "PRIZE_CATEGORY_CREATED",
          details: { prizeCategoryId: category.id, drawType },
        },
      });
      return category;
    });

    return NextResponse.json({ prizeCategory }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Admin prize category creation failed");
  }
}
