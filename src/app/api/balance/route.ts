import type { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
} from "@/utils/api";
import { getISODateString } from "@/utils/date";
import supabase from "@/lib/supabase";


export async function GET(request: NextRequest) {
  const formattedDate = request.nextUrl.searchParams.get("date") ?? getISODateString();
  const fid = request.nextUrl.searchParams.get("fid");

  if (new Date(formattedDate) > new Date()) {
    return errorResponse("Date must be on or before today");
  }

  try {
    const { data } = await supabase.rpc('allocation_date_summary', {
      input_date: formattedDate,
      input_fid: fid ? Number(fid) : null,
    });
    return successResponse(data);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
