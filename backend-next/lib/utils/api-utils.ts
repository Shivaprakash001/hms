import { NextResponse } from "next/server";

export function apiError(message: string, code = "ERROR", status = 500, details?: any) {
  return NextResponse.json(
    { 
      error: { 
        message, 
        code,
        ...(details && { details })
      } 
    }, 
    { status }
  );
}

export function apiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
