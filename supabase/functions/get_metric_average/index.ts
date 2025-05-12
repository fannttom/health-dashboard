import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { metric, days } = await req.json().catch(() => ({}));

  if (!metric) {
    return new Response(JSON.stringify({ error: "Не указано имя метрики" }), { status: 400 });
  }

  const tableWhitelist = [
    "step_count", "oxygen_saturation", "respiratory_rate",
    "walking_speed", "vo2_max", "active_energy",
    "resting_heart_rate", "heart_rate_variability",
    "cardio_recovery", "pulse_data_full"
  ];

  if (!tableWhitelist.includes(metric)) {
    return new Response(JSON.stringify({ error: "Недопустимая метрика" }), { status: 400 });
  }

  const sinceDate = new Date(Date.now() - (days || 7) * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(metric)
    .select("timestamp, qty")
    .gte("timestamp", sinceDate);

  if (error || !data || data.length === 0) {
    return new Response(JSON.stringify({ error: "Нет данных" }), { status: 404 });
  }

  const values = data.map(entry => parseFloat(entry.qty)).filter(v => !isNaN(v));
  const avg = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);

  return new Response(
    JSON.stringify({
      metric,
      average_value: avg,
      days: days || 7,
      records_used: values.length
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
