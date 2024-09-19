import type { NextRequest } from "next/server";
import {
  authenticate,
  unauthorized,
  errorResponse,
  successResponse,
} from "@/utils/api";
import { updateDailyTipAllowances } from "@/utils/allocations";
import { getISODateString } from "@/utils/date";

const SEASON_ID = 1;

export async function GET(request: NextRequest) {
  // @TODO: add retry logic
  // @TODO: persist data to db

  if (!authenticate(request)) {
    return unauthorized();
  }

  const formattedDate = getISODateString();

  try {
    const allowances = await updateDailyTipAllowances(formattedDate, SEASON_ID);
    return successResponse(allowances);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
