import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminCredentials } from "@/lib/auth";
import { errorResponse, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin, readJsonObject } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const email = body.email;
    const password = body.password;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 255 ||
      password.length > 1024
    ) {
      throw new ApiError("กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง", 400);
    }

    const admin = await verifyAdminCredentials(email, password);
    if (!admin) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับชั่วคราว" },
        { status: 401 },
      );
    }

    await prisma.auditLog.create({
      data: { adminId: admin.id, action: "ADMIN_LOGIN" },
    });
    await createAdminSession(admin.id);
    return NextResponse.json({ admin });
  } catch (error) {
    return errorResponse(error, "Admin login failed");
  }
}
