type DrawType = "FULL_TICKET" | "LAST_3_DIGITS";

type DemoPrizeCategory = {
  id: string;
  name: string;
  drawType: DrawType;
};

type DemoDraw = {
  id: string;
  drawnNumber: string;
  winnersCount: number;
  announcedAt: string;
  prizeCategory: DemoPrizeCategory;
  prizeResults: { ticket: { number: string } }[];
};

export type DemoEvent = {
  id: string;
  name: string;
  description: string | null;
  ticketCount: number;
  status: "ACTIVE" | "COMPLETED";
  createdAt: string;
  prizeCategories: DemoPrizeCategory[];
  drawHistories: DemoDraw[];
};

const firstPrize: DemoPrizeCategory = {
  id: "demo-prize-first",
  name: "รางวัลที่ 1",
  drawType: "FULL_TICKET",
};

const secondPrize: DemoPrizeCategory = {
  id: "demo-prize-second",
  name: "รางวัลที่ 2",
  drawType: "FULL_TICKET",
};

const lastThreePrize: DemoPrizeCategory = {
  id: "demo-prize-last-three",
  name: "เลขท้าย 3 ตัว",
  drawType: "LAST_3_DIGITS",
};

/**
 * ข้อมูลตัวอย่างที่ใช้เมื่อยังไม่ได้ตั้งค่า DATABASE_URL
 * แก้ไขหมายเลขและรายชื่อผู้ถูกรางวัลได้ในไฟล์นี้ หรือเชื่อมต่อฐานข้อมูลจริงเพื่อใช้ข้อมูลจากผู้ดูแลระบบ
 */
export const DEMO_EVENTS: DemoEvent[] = [
  {
    id: "demo-lucky-2026",
    name: "กิจกรรมนำโชค 2026 (ข้อมูลตัวอย่าง)",
    description:
      "ข้อมูลตัวอย่างสำหรับทดลองตรวจสอบรางวัล เชื่อมต่อฐานข้อมูลเพื่อใช้ผลรางวัลจริงจากหน้าผู้ดูแลระบบ",
    ticketCount: 2_000,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    prizeCategories: [firstPrize, secondPrize, lastThreePrize],
    drawHistories: [
      {
        id: "demo-draw-first",
        drawnNumber: "01287",
        winnersCount: 1,
        announcedAt: "2026-01-01T09:00:00.000Z",
        prizeCategory: firstPrize,
        prizeResults: [{ ticket: { number: "01287" } }],
      },
      {
        id: "demo-draw-second",
        drawnNumber: "01942",
        winnersCount: 1,
        announcedAt: "2026-01-01T09:30:00.000Z",
        prizeCategory: secondPrize,
        prizeResults: [{ ticket: { number: "01942" } }],
      },
      {
        id: "demo-draw-last-three",
        drawnNumber: "128",
        winnersCount: 2,
        announcedAt: "2026-01-01T10:00:00.000Z",
        prizeCategory: lastThreePrize,
        prizeResults: [
          { ticket: { number: "00128" } },
          { ticket: { number: "01128" } },
        ],
      },
    ],
  },
];

export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

export function findDemoEvent(eventId: string): DemoEvent | undefined {
  return DEMO_EVENTS.find((event) => event.id === eventId);
}

export function lookupDemoTicket(eventId: string, ticketNumber: string) {
  const event = findDemoEvent(eventId);
  if (!event) {
    return null;
  }

  const wins = event.drawHistories.flatMap((draw) =>
    draw.prizeResults
      .filter(({ ticket }) => ticket.number === ticketNumber)
      .map(() => ({
        wonAt: draw.announcedAt,
        prizeCategory: {
          id: draw.prizeCategory.id,
          name: draw.prizeCategory.name,
          drawType: draw.prizeCategory.drawType,
        },
        drawHistory: {
          drawnNumber: draw.drawnNumber,
          announcedAt: draw.announcedAt,
        },
      })),
  );

  return {
    ticketNumber,
    ticketExists: Number(ticketNumber) >= 1 && Number(ticketNumber) <= event.ticketCount,
    wins,
    won: wins.length > 0,
  };
}
