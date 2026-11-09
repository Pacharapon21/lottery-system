import { randomUUID } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ApiError, errorResponse, requireAdminResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { formatTicketNumber } from "@/lib/ticket-number";
import { assertSameOrigin, readJsonObject } from "@/lib/validation";

const TICKET_BATCH_SIZE = 5_000;

export async function GET() {
  await connection();
  try {
    if (!(await getCurrentAdmin())) {
      return requireAdminResponse();
    }

    const events = await prisma.drawSession.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        ticketCount: true,
        status: true,
        createdAt: true,
        prizeCategories: {
          select: { id: true, name: true, drawType: true },
          orderBy: { createdAt: "asc" },
        },
        drawHistories: {
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            drawnNumber: true,
            status: true,
            winnersCount: true,
            startedAt: true,
            confirmedAt: true,
            announcedAt: true,
            prizeCategory: { select: { id: true, name: true, drawType: true } },
            prizeResults: {
              select: { ticket: { select: { number: true } } },
              orderBy: { wonAt: "asc" },
            },
          },
        },
        auditLogs: {
          take: 25,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            details: true,
            createdAt: true,
            admin: { select: { email: true } },
          },
        },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    return errorResponse(error, "Admin event lookup failed");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await getCurrentAdmin();
    if (!admin) {
      return requireAdminResponse();
    }

    const body = await readJsonObject(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const ticketCount = body.ticketCount;
    if (!name || name.length > 120 || description.length > 5000) {
      throw new ApiError("กรุณาระบุชื่อกิจกรรมและรายละเอียดไม่เกิน 5,000 ตัวอักษร", 400);
    }
    if (
      typeof ticketCount !== "number" ||
      !Number.isInteger(ticketCount) ||
      ticketCount < 1 ||
      ticketCount > 99_999
    ) {
      throw new ApiError("จำนวนสลากต้องอยู่ระหว่าง 1 ถึง 99,999 ใบ", 400);
    }

    const event = await prisma.$transaction(
      async (transaction) => {
        const created = await transaction.drawSession.create({
          data: {
            name,
            description: description || null,
            ticketCount,
          },
        });

        for (let start = 1; start <= ticketCount; start += TICKET_BATCH_SIZE) {
          const end = Math.min(start + TICKET_BATCH_SIZE, ticketCount + 1);
          await transaction.ticket.createMany({
            data: Array.from({ length: end - start }, (_, offset) => ({
              id: randomUUID(),
              drawSessionId: created.id,
              number: formatTicketNumber(start + offset),
            })),
          });
        }

        await transaction.auditLog.create({
          data: {
            adminId: admin.id,
            drawSessionId: created.id,
            action: "EVENT_CREATED",
            details: { ticketCount },
          },
        });
        return created;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Admin event creation failed");
  }
}
