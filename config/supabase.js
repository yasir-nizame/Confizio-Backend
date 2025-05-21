import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_API_KEY;

const supabaseUrl = "https://xdfqydvtgxcnmiylydvk.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZnF5ZHZ0Z3hjbm1peWx5ZHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzNjIyOTAsImV4cCI6MjA0NDkzODI5MH0.HdvJ1V6gokilwkb2mkGsgtp_syNZmnREAChCQFyROps";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and API Key must be provided");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
