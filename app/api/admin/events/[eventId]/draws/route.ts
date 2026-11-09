import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { lockDrawSession } from "@/lib/draw-lock";
import { ApiError, errorResponse, requireAdminResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { formatTicketNumber } from "@/lib/ticket-number";
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
    const prizeCategoryId = body.prizeCategoryId;
    if (typeof prizeCategoryId !== "string" || !prizeCategoryId) {
      throw new ApiError("กรุณาเลือกประเภทรางวัล", 400);
    }

    const draw = await prisma.$transaction(async (transaction) => {
      await lockDrawSession(transaction, eventId);
      const event = await transaction.drawSession.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      if (!event) {
        throw new ApiError("ไม่พบกิจกรรมนี้", 404);
      }
      if (event.status !== "ACTIVE") {
        throw new ApiError("กิจกรรมต้องอยู่ในสถานะกำลังดำเนินการจึงจะสุ่มได้", 409);
      }

      const pendingDraw = await transaction.drawHistory.findFirst({
        where: { drawSessionId: eventId, status: "PENDING" },
        select: { id: true },
      });
      if (pendingDraw) {
        throw new ApiError("กรุณายืนยันผลการสุ่มครั้งก่อนก่อนเริ่มครั้งใหม่", 409);
      }

      const category = await transaction.prizeCategory.findFirst({
        where: { id: prizeCategoryId, drawSessionId: eventId },
      });
      if (!category) {
        throw new ApiError("ไม่พบประเภทรางวัลนี้ในกิจกรรม", 404);
      }

      let drawnNumber: string;
      let winningTickets: { id: string; number: string }[];

      if (category.drawType === "LAST_3_DIGITS") {
        drawnNumber = String(randomInt(0, 1000)).padStart(3, "0");
        winningTickets = await transaction.ticket.findMany({
          where: {
            drawSessionId: eventId,
            number: { endsWith: drawnNumber },
            prizeResults: { none: { drawSessionId: eventId } },
          },
          select: { id: true, number: true },
          orderBy: { number: "asc" },
        });
      } else {
        const eligibleWhere = {
          drawSessionId: eventId,
          prizeResults: { none: { drawSessionId: eventId } },
        };
        const eligibleCount = await transaction.ticket.count({
          where: eligibleWhere,
        });
        if (eligibleCount === 0) {
          drawnNumber = formatTicketNumber(randomInt(1, 100_000));
          winningTickets = [];
        } else {
          const [ticket] = await transaction.ticket.findMany({
            where: eligibleWhere,
            select: { id: true, number: true },
            orderBy: { number: "asc" },
            skip: randomInt(0, eligibleCount),
            take: 1,
          });
          if (!ticket) {
            throw new Error("Eligible ticket disappeared during a locked draw.");
          }
          drawnNumber = ticket.number;
          winningTickets = [ticket];
        }
      }

      const created = await transaction.drawHistory.create({
        data: {
          drawSessionId: eventId,
          prizeCategoryId,
          drawnNumber,
          winnersCount: winningTickets.length,
        },
      });
      if (winningTickets.length > 0) {
        await transaction.prizeResult.createMany({
          data: winningTickets.map((ticket) => ({
            id: randomUUID(),
            drawSessionId: eventId,
            ticketId: ticket.id,
            prizeCategoryId,
            drawHistoryId: created.id,
          })),
        });
      }
      await transaction.auditLog.create({
        data: {
          adminId: admin.id,
          drawSessionId: eventId,
          action: "DRAW_STARTED",
          details: {
            drawHistoryId: created.id,
            prizeCategoryId,
            drawType: category.drawType,
            drawnNumber,
            winnersCount: winningTickets.length,
          },
        },
      });

      return {
        ...created,
        prizeCategory: {
          id: category.id,
          name: category.name,
          drawType: category.drawType,
        },
        prizeResults: winningTickets.map((ticket) => ({
          ticket: { number: ticket.number },
        })),
      };
    });

    return NextResponse.json({ draw }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Admin draw failed");
  }
}
