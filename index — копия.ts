// supabase/functions/parse_pulse/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { data } = await req.json();

    for (const metric of data.metrics || []) {
      const tableName = metric.name;

      const validEntries = (metric.data || [])
        .filter((entry: any) => entry.qty && entry.date)
        .map((entry: any) => ({
          timestamp: new Date(entry.date).toISOString(),
          qty: typeof entry.qty === "string" ? parseFloat(entry.qty) : entry.qty,
          source: entry.source ?? null,
        }));

      if (validEntries.length === 0) continue;

      const { error } = await supabase.from(tableName).insert(validEntries);

      if (error) {
        console.error(`Insert error in ${tableName}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Parse error:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }
});
