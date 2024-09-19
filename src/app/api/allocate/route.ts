import {
  errorResponse,
  successResponse,
} from "@/utils/api";
import { updateDailyTipAllowances } from "@/utils/allocations";
import { getISODateString } from "@/utils/date";
import { Allocation } from "@/types";

const SEASON_ID = 1;

let cacheData: {
  params: {
    date: string;
    totalDailyTokenAllowance: number;
    minSpaceBalance: number;
  };
  allocations: Allocation[];
  spaceHolders: { [address: string]: number };
  nogsHolders: { [address: string]: number };
} | null = null;

let cacheDate: string | null = null;

export async function GET() {
  const formattedDate = getISODateString();

  if (cacheDate === formattedDate) {
    return successResponse(cacheData);
  }

  try {
    const allowances = await updateDailyTipAllowances(formattedDate, SEASON_ID);
    cacheData = allowances;
    cacheDate = formattedDate;
    return successResponse(allowances);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
