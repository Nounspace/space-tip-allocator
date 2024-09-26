import {
  errorResponse,
  successResponse,
} from "@/utils/api";
import { calculateDailyTipAllowances } from "@/utils/allocations";
import { getISODateString } from "@/utils/date";
import { Allocation } from "@/types";
import { NextResponse } from "next/server"; // Use NextResponse for Next.js specific response handling

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

  // Add CORS headers to the response
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  if (cache?.params.date === formattedDate) {
    return NextResponse.json(successResponse(cache), { headers });
  }

  try {
    const allowances = await calculateDailyTipAllowances(formattedDate, SEASON_ID);
    cache = allowances;
    return NextResponse.json(successResponse(allowances), { headers });
  } catch (error) {
    return NextResponse.json(errorResponse(error as Error), {
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

// Disable Vercel cache
export const fetchCache = 'force-no-store';
