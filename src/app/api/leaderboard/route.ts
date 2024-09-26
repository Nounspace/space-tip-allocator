import type { NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
} from "@/utils/api";
import supabase from "@/lib/supabase";
import { formatAsCsv, DataObject } from "@/utils/csv";


const DEFAULT_CSV_COLUMNS: [column: string, label: string][] = [
  ["username", "Username"],
  ["amount_received", "Tips Received"],
]

const VALID_CSV_COLUMNS = [
  "fid",
  "username",
  "display_name",
  "amount_received",
  "num_received",
  "pfp_url",
]

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format"); // csv or json (default)
  const columns = (request.nextUrl.searchParams.get("columns")); // col1:optionalLabel,col2

  try {
    const { data } = await supabase.rpc('leaderboard');

    if (format === "csv") {
      const csvColumns: typeof DEFAULT_CSV_COLUMNS = columns?.split(",").map(c => {
        const [column, label] = c.split(":");

        if (!VALID_CSV_COLUMNS.includes(column)) {
          throw new Error(`Invalid column: ${column}. Valid columns are: ${VALID_CSV_COLUMNS.join(", ")}`);
        }

        return [column, label ?? column]; 
      }) ?? DEFAULT_CSV_COLUMNS;

      return new Response(formatAsCsv(data as DataObject[], csvColumns));
    }

    return successResponse(data);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
