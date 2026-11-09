import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { lockDrawSession } from "@/lib/draw-lock";
import { ApiError, errorResponse, requireAdminResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/validation";

type RouteContext = { params: Promise<{ drawId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await getCurrentAdmin();
    if (!admin) {
      return requireAdminResponse();
    }

    const { drawId } = await context.params;
    const reference = await prisma.drawHistory.findUnique({
      where: { id: drawId },
      select: { drawSessionId: true },
    });
    if (!reference) {
      throw new ApiError("ไม่พบประวัติการสุ่มนี้", 404);
    }

    const draw = await prisma.$transaction(async (transaction) => {
      await lockDrawSession(transaction, reference.drawSessionId);
      const current = await transaction.drawHistory.findUnique({
        where: { id: drawId },
        select: { status: true },
      });
      if (!current) {
        throw new ApiError("ไม่พบประวัติการสุ่มนี้", 404);
      }
      if (current.status !== "CONFIRMED") {
        throw new ApiError("ต้องยืนยันผลก่อนประกาศ", 409);
      }

      const announced = await transaction.drawHistory.update({
        where: { id: drawId },
        data: { status: "ANNOUNCED", announcedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          adminId: admin.id,
          drawSessionId: reference.drawSessionId,
          action: "DRAW_ANNOUNCED",
          details: { drawHistoryId: drawId },
        },
      });
      return announced;
    });

    return NextResponse.json({ draw });
  } catch (error) {
    return errorResponse(error, "Admin draw announcement failed");
  }
}
