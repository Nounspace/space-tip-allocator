import type { NextRequest } from "next/server";
import {
  authenticate,
  unauthorized,
  errorResponse,
  successResponse,
} from "@/utils/api";
import { syncCastTips } from "@/utils/allocations";

export async function GET(request: NextRequest) {
  // @TODO: add retry logic

  if (!authenticate(request)) {
    return unauthorized();
  }

  try {
    await syncCastTips();
    return successResponse();
  } catch (error) {
    return errorResponse(error as Error);
  }
}
