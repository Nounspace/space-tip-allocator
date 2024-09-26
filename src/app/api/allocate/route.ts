import {
  errorResponse,
  successResponse,
} from "@/utils/api";
import { calculateDailyTipAllowances } from "@/utils/allocations";
import { getISODateString } from "@/utils/date";
import { Allocation } from "@/types";

const SEASON_ID = 1;

let cache: {
  params: {
    date: string;
    totalDailyTokenAllowance: number;
    minSpaceBalance: number;
  };
  allocations: Allocation[];
  spaceHolders: { [address: string]: number };
  nogsHolders: { [address: string]: number };
} | null = null;

export async function GET() {
  const formattedDate = getISODateString();

  if (cache?.params.date === formattedDate) {
    return successResponse(cache);
  }

  try {
    const allowances = await calculateDailyTipAllowances(formattedDate, SEASON_ID);
    cache = allowances;
    return successResponse(allowances);
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// disable vercel cache
export const fetchCache = 'force-no-store';