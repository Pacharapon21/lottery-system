import { connection, NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await connection();
  try {
    const events = await prisma.drawSession.findMany({
      where: { status: { in: ["ACTIVE", "COMPLETED"] } },
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
          where: { status: "ANNOUNCED" },
          orderBy: { announcedAt: "desc" },
          select: {
            id: true,
            drawnNumber: true,
            winnersCount: true,
            announcedAt: true,
            prizeCategory: { select: { id: true, name: true, drawType: true } },
            prizeResults: {
              select: {
                ticket: { select: { number: true } },
              },
              orderBy: { wonAt: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    return errorResponse(error, "Public events lookup failed");
  }
}
