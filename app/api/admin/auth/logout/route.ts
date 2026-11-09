import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { assertSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Admin logout failed");
  }
}
