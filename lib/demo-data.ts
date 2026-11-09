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

const thirdPrize: DemoPrizeCategory = {
  id: "demo-prize-third",
  name: "รางวัลที่ 3",
  drawType: "FULL_TICKET",
};

const fourthPrize: DemoPrizeCategory = {
  id: "demo-prize-fourth",
  name: "รางวัลที่ 4",
  drawType: "FULL_TICKET",
};

const fifthPrize: DemoPrizeCategory = {
  id: "demo-prize-fifth",
  name: "รางวัลที่ 5",
  drawType: "FULL_TICKET",
};

const lastThreePrize: DemoPrizeCategory = {
  id: "demo-prize-last-three",
  name: "เลขท้าย 3 ตัว",
  drawType: "LAST_3_DIGITS",
};

const fullTicketDraws: DemoDraw[] = [
  { prizeCategory: firstPrize, numbers: ["30656"] },
  { prizeCategory: secondPrize, numbers: ["38335", "74388", "08954"] },
  { prizeCategory: thirdPrize, numbers: ["93141", "31211", "59984"] },
  { prizeCategory: fourthPrize, numbers: ["81202", "08731", "83104", "54828", "63190"] },
  { prizeCategory: fifthPrize, numbers: ["84983", "11102", "56344", "69272", "38519", "34206"] },
].flatMap(({ prizeCategory, numbers }, prizeIndex) =>
  numbers.map((number, numberIndex) => {
    const announcedAt = new Date(
      Date.UTC(2026, 0, 1, 9, prizeIndex * 10 + numberIndex * 2),
    ).toISOString();
    return {
      id: `demo-draw-${prizeCategory.id}-${numberIndex + 1}`,
      drawnNumber: number,
      winnersCount: 1,
      announcedAt,
      prizeCategory,
      prizeResults: [{ ticket: { number } }],
    };
  }),
);

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
    ticketCount: 99_999,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    prizeCategories: [
      firstPrize,
      secondPrize,
      thirdPrize,
      fourthPrize,
      fifthPrize,
      lastThreePrize,
    ],
    drawHistories: [
      ...fullTicketDraws,
      {
        id: "demo-draw-last-three",
        drawnNumber: "690",
        winnersCount: 3,
        announcedAt: "2026-01-01T10:30:00.000Z",
        prizeCategory: lastThreePrize,
        prizeResults: [
          { ticket: { number: "30690" } },
          { ticket: { number: "50690" } },
          { ticket: { number: "76690" } },
        ],
      },
    ].sort(
      (left, right) =>
        Date.parse(right.announcedAt ?? "") - Date.parse(left.announcedAt ?? ""),
    ),
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
