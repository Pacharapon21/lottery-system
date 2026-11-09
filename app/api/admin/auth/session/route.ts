import { connection, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-data";
import { errorResponse } from "@/lib/http";

export async function GET() {
  await connection();
  try {
    const admin = await getCurrentAdmin();
    return NextResponse.json({ admin, demo: isDemoMode() });
  } catch (error) {
    return errorResponse(error, "Admin session lookup failed");
  }
}
