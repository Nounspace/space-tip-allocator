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

export async function GET(req: Request) {
  const formattedDate = getISODateString();

  // Add CORS headers to the response
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*'); // Allow all origins
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS'); // Allow GET and OPTIONS methods
  headers.set('Access-Control-Allow-Headers', 'Content-Type'); // Specify allowed headers

  if (cache?.params.date === formattedDate) {
    return new Response(JSON.stringify(successResponse(cache)), {
      headers,
      status: 200,
    });
  }

  try {
    const allowances = await calculateDailyTipAllowances(formattedDate, SEASON_ID);
    cache = allowances;
    return new Response(JSON.stringify(successResponse(allowances)), {
      headers,
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify(errorResponse(error as Error)), {
      headers,
      status: 500,
    });
  }
}

// Handle OPTIONS preflight request for CORS
export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return new Response(null, { headers, status: 204 });
}

// disable vercel cache
export const fetchCache = 'force-no-store';
