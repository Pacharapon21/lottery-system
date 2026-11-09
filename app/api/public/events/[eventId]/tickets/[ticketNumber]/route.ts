import { connection, NextResponse } from "next/server";
import { isDemoMode, lookupDemoTicket } from "@/lib/demo-data";
import { ApiError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { isValidTicketNumber } from "@/lib/ticket-number";

type RouteContext = {
  params: Promise<{ eventId: string; ticketNumber: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  await connection();
  try {
    const { eventId, ticketNumber } = await context.params;
    if (!isValidTicketNumber(ticketNumber)) {
      throw new ApiError("หมายเลขสลากต้องเป็นเลข 00001–99999", 400);
    }

    if (isDemoMode()) {
      const result = lookupDemoTicket(eventId, ticketNumber);
      if (!result) {
        throw new ApiError("ไม่พบกิจกรรมนี้", 404);
      }
      return NextResponse.json({ ...result, demo: true });
    }

    const ticket = await prisma.ticket.findUnique({
      where: {
        drawSessionId_number: { drawSessionId: eventId, number: ticketNumber },
      },
      select: {
        number: true,
        prizeResults: {
          where: { drawHistory: { status: "ANNOUNCED" } },
          select: {
            wonAt: true,
            prizeCategory: { select: { name: true, drawType: true } },
            drawHistory: {
              select: { drawnNumber: true, announcedAt: true },
            },
          },
          orderBy: { wonAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      ticketNumber,
      ticketExists: Boolean(ticket),
      wins: ticket?.prizeResults ?? [],
      won: Boolean(ticket?.prizeResults.length),
      demo: false,
    });
  } catch (error) {
    return errorResponse(error, "Public ticket lookup failed");
  }
}
