import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(context, error);
  return NextResponse.json(
    { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
    { status: 500 },
  );
}

export function requireAdminResponse(): NextResponse {
  return NextResponse.json({ error: "กรุณาเข้าสู่ระบบผู้ดูแล" }, { status: 401 });
}
