import type { NextRequest } from "next/server";
import {
  authenticate,
  unauthorized,
  errorResponse,
  successResponse,
} from "@/utils/api";
import { calculateDailyTipAllowances, saveDailyTipAllowances } from "@/utils/allocations";
import { getISODateString } from "@/utils/date";
import supabase from "@/lib/supabase";

const SEASON_ID = 1;

export async function GET(request: NextRequest) {
  // @TODO: add retry logic

  if (!authenticate(request)) {
    return unauthorized();
  }

  const formattedDate = request.nextUrl.searchParams.get("date") ?? getISODateString();

  if (new Date(formattedDate) > new Date()) {
    return errorResponse("Date must be on or before today");
  }

  const { data: existingAllocations } = await supabase
    .from("daily_tip_allocation")
    .select("allocation_date")
    .eq("allocation_date", formattedDate)

  if (existingAllocations && existingAllocations.length > 0) {
    return errorResponse("Allocations already calculated for date");
  }

  try {
    const allowances = await calculateDailyTipAllowances(formattedDate, SEASON_ID);
    await saveDailyTipAllowances(formattedDate, allowances.allocations);
    return successResponse(allowances);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
