import { createClient } from "@supabase/supabase-js";
import { Database } from '@/types/database';

const supabaseClient = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export default supabaseClient;
