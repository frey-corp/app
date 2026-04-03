import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://nqhggfqdjxawvxchbqdu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uFul_JGxo6iQJ8bVWb3YwQ_kmbWDvrI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
