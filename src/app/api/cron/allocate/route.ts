import type { NextRequest } from "next/server";
import {
  authenticate,
  unauthorized,
  errorResponse,
  successResponse,
} from "@/utils/api";
import { calculateDailyTipAllowances, saveDailyTipAllowances } from "@/utils/allocations";
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
    const allowances = await calculateDailyTipAllowances(formattedDate, SEASON_ID);
    await saveDailyTipAllowances(formattedDate, allowances.allocations);
    return successResponse(allowances);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
