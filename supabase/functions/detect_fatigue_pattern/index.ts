import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const sinceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [rhr, hrv, sleep, steps] = await Promise.all([
    supabase.from("resting_heart_rate").select("timestamp, qty").gte("timestamp", sinceDate),
    supabase.from("heart_rate_variability").select("timestamp, qty").gte("timestamp", sinceDate),
    supabase.from("sleep_data").select("start, duration_min").gte("start", sinceDate),
    supabase.from("step_count").select("timestamp, qty").gte("timestamp", sinceDate)
  ]);

  if (rhr.error || hrv.error || sleep.error || steps.error) {
    return new Response(JSON.stringify({ error: "Ошибка при загрузке данных" }), { status: 500 });
  }

  // Обработка и усреднение значений
  const avgRHR = rhr.data.length
    ? rhr.data.map(d => parseFloat(d.qty)).reduce((a, b) => a + b, 0) / rhr.data.length
    : null;

  const avgHRV = hrv.data.length
    ? hrv.data.map(d => parseFloat(d.qty)).reduce((a, b) => a + b, 0) / hrv.data.length
    : null;

  const avgSleepHours = sleep.data.length
    ? sleep.data.map(d => parseFloat(d.duration_min)).reduce((a, b) => a + b, 0) / sleep.data.length / 60
    : null;

  const avgSteps = steps.data.length
    ? steps.data.map(d => parseFloat(d.qty)).reduce((a, b) => a + b, 0) / steps.data.length
    : null;

  // Простая логика оценки усталости
  const fatigueDetected =
    (avgRHR && avgRHR > 60) &&
    (avgHRV && avgHRV < 40) &&
    (avgSleepHours && avgSleepHours < 6.5) &&
    (avgSteps && avgSteps < 4000);

  const explanation = [];

  if (avgRHR && avgRHR > 60) explanation.push("пульс в покое выше нормы");
  if (avgHRV && avgHRV < 40) explanation.push("низкая вариабельность ЧСС");
  if (avgSleepHours && avgSleepHours < 6.5) explanation.push("недостаточный сон");
  if (avgSteps && avgSteps < 4000) explanation.push("низкая физическая активность");

  return new Response(
    JSON.stringify({
      avg_rhr: avgRHR ? +avgRHR.toFixed(1) : null,
      avg_hrv: avgHRV ? +avgHRV.toFixed(1) : null,
      avg_sleep_hours: avgSleepHours ? +avgSleepHours.toFixed(2) : null,
      avg_steps: avgSteps ? Math.round(avgSteps) : null,
      fatigue_detected: fatigueDetected,
      explanation
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
