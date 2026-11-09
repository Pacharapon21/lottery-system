CREATE TYPE "DrawType" AS ENUM ('FULL_TICKET', 'LAST_3_DIGITS');
CREATE TYPE "DrawSessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');
CREATE TYPE "DrawStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ANNOUNCED');

CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrawSession" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "ticketCount" INTEGER NOT NULL DEFAULT 0,
    "status" "DrawSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DrawSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DrawSession_ticketCount_range_check" CHECK ("ticketCount" BETWEEN 0 AND 99999)
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "drawSessionId" TEXT NOT NULL,
    "number" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Ticket_number_format_check" CHECK ("number" ~ '^[0-9]{5}$' AND "number" <> '00000')
);

CREATE TABLE "PrizeCategory" (
    "id" TEXT NOT NULL,
    "drawSessionId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "drawType" "DrawType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrizeCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrawHistory" (
    "id" TEXT NOT NULL,
    "drawSessionId" TEXT NOT NULL,
    "prizeCategoryId" TEXT NOT NULL,
    "drawnNumber" VARCHAR(5) NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'PENDING',
    "winnersCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    CONSTRAINT "DrawHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DrawHistory_winnersCount_nonnegative_check" CHECK ("winnersCount" >= 0)
);

CREATE TABLE "PrizeResult" (
    "id" TEXT NOT NULL,
    "drawSessionId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "prizeCategoryId" TEXT NOT NULL,
    "drawHistoryId" TEXT NOT NULL,
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrizeResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "drawSessionId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX "Ticket_drawSessionId_number_key" ON "Ticket"("drawSessionId", "number");
CREATE UNIQUE INDEX "Ticket_id_drawSessionId_key" ON "Ticket"("id", "drawSessionId");
CREATE INDEX "PrizeCategory_drawSessionId_idx" ON "PrizeCategory"("drawSessionId");
CREATE UNIQUE INDEX "PrizeCategory_id_drawSessionId_key" ON "PrizeCategory"("id", "drawSessionId");
CREATE INDEX "DrawHistory_drawSessionId_startedAt_idx" ON "DrawHistory"("drawSessionId", "startedAt");
CREATE INDEX "DrawHistory_prizeCategoryId_startedAt_idx" ON "DrawHistory"("prizeCategoryId", "startedAt");
CREATE UNIQUE INDEX "DrawHistory_id_drawSessionId_key" ON "DrawHistory"("id", "drawSessionId");
CREATE INDEX "PrizeResult_drawSessionId_wonAt_idx" ON "PrizeResult"("drawSessionId", "wonAt");
CREATE INDEX "PrizeResult_prizeCategoryId_idx" ON "PrizeResult"("prizeCategoryId");
CREATE UNIQUE INDEX "PrizeResult_ticketId_drawSessionId_key" ON "PrizeResult"("ticketId", "drawSessionId");
CREATE INDEX "AuditLog_drawSessionId_createdAt_idx" ON "AuditLog"("drawSessionId", "createdAt");
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_drawSessionId_fkey"
    FOREIGN KEY ("drawSessionId") REFERENCES "DrawSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeCategory" ADD CONSTRAINT "PrizeCategory_drawSessionId_fkey"
    FOREIGN KEY ("drawSessionId") REFERENCES "DrawSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawHistory" ADD CONSTRAINT "DrawHistory_drawSessionId_fkey"
    FOREIGN KEY ("drawSessionId") REFERENCES "DrawSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawHistory" ADD CONSTRAINT "DrawHistory_prizeCategoryId_drawSessionId_fkey"
    FOREIGN KEY ("prizeCategoryId", "drawSessionId") REFERENCES "PrizeCategory"("id", "drawSessionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeResult" ADD CONSTRAINT "PrizeResult_drawSessionId_fkey"
    FOREIGN KEY ("drawSessionId") REFERENCES "DrawSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeResult" ADD CONSTRAINT "PrizeResult_ticketId_drawSessionId_fkey"
    FOREIGN KEY ("ticketId", "drawSessionId") REFERENCES "Ticket"("id", "drawSessionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeResult" ADD CONSTRAINT "PrizeResult_prizeCategoryId_drawSessionId_fkey"
    FOREIGN KEY ("prizeCategoryId", "drawSessionId") REFERENCES "PrizeCategory"("id", "drawSessionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrizeResult" ADD CONSTRAINT "PrizeResult_drawHistoryId_drawSessionId_fkey"
    FOREIGN KEY ("drawHistoryId", "drawSessionId") REFERENCES "DrawHistory"("id", "drawSessionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_drawSessionId_fkey"
    FOREIGN KEY ("drawSessionId") REFERENCES "DrawSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
