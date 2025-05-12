import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { days } = await req.json().catch(() => ({ days: 7 }));

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("sleep_data")
    .select("start, end, duration_min")
    .gte("start", sinceDate)
    .order("start", { ascending: false });

  if (error || !data || data.length === 0) {
    return new Response(
      JSON.stringify({ error: "Нет данных о сне за указанный период" }),
      { status: 404 }
    );
  }

  const totalSleepMin = data.reduce((sum, entry) => sum + parseFloat(entry.duration_min), 0);
  const averageSleepHours = +(totalSleepMin / data.length / 60).toFixed(2);

  const lastNight = data[0];
  const lastSleepDate = new Date(lastNight.start).toISOString().split("T")[0];
  const lastSleepHours = +(parseFloat(lastNight.duration_min) / 60).toFixed(2);

  const nightsBelow6h = data.filter(entry => parseFloat(entry.duration_min) < 360).length;

  return new Response(
    JSON.stringify({
      average_sleep_hours: averageSleepHours,
      last_night: {
        date: lastSleepDate,
        duration_hours: lastSleepHours
      },
      nights_below_6h: nightsBelow6h
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
