import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { data } = await req.json();

    // 1. Health метрики
    for (const metric of data.metrics || []) {
      const tableName = metric.name;

      if (tableName === "sleep_analysis") {
        // Специальная обработка сна
        const validSleepEntries = (metric.data || [])
          .filter((entry: any) => entry.inBedStart && entry.sleepEnd)
          .map((entry: any) => ({
            start: new Date(entry.inBedStart).toISOString(),
            end: new Date(entry.sleepEnd).toISOString(),
            duration_min: (new Date(entry.sleepEnd).getTime() - new Date(entry.inBedStart).getTime()) / 60000, // Минуты
            source: entry.source ?? null,
          }));

        if (validSleepEntries.length > 0) {
          const { error: sleepError } = await supabase
            .from("sleep_data")
            .insert(validSleepEntries);
          if (sleepError) console.error(`Sleep insert error:`, sleepError);
        }

        continue; // Уже обработали sleep_analysis, идём дальше
      }

      // Обычная обработка health-метрик
      const validEntries = (metric.data || [])
        .filter((entry: any) => entry.qty && entry.date)
        .map((entry: any) => ({
          timestamp: new Date(entry.date).toISOString(),
          qty: typeof entry.qty === "string" ? parseFloat(entry.qty) : entry.qty,
          source: entry.source ?? null,
        }));

      if (validEntries.length === 0) continue;

      const { error } = await supabase.from(tableName).insert(validEntries);
      if (error) console.error(`Insert error in ${tableName}:`, error);
    }

    // 2. Workouts
    for (const workout of data.workouts || []) {
      const start = workout.start ? new Date(workout.start) : null;
      const end = workout.end ? new Date(workout.end) : null;
      if (!start || !end) continue;

      const duration_min = (end.getTime() - start.getTime()) / 1000 / 60;

      const type = workout.name ?? "Unknown";
      const source = workout.source ?? null;

      const energy_kcal = workout.activeEnergyBurned?.qty ?? null;
      const distance_km = workout.distance?.qty ?? null;
      const steps = workout.steps ?? null;

      const { data: insertedWorkout, error: insertError } = await supabase
        .from("workouts")
        .insert([
          {
            start: start.toISOString(),
            end: end.toISOString(),
            duration_min,
            type,
            source,
            energy_kcal,
            distance_km,
            steps,
          },
        ])
        .select("id");

      if (insertError || !insertedWorkout || insertedWorkout.length === 0) {
        console.error("Workout insert error:", insertError);
        continue;
      }

      const workout_id = insertedWorkout[0].id;

      // 3. Heart rate data (Min, Avg, Max)
      for (const hr of workout.heartRateData || []) {
        const timestamp = hr.date ? new Date(hr.date).toISOString() : null;
        if (!timestamp) continue;

        const entries = [];

        if (hr.Min !== undefined) {
          entries.push({ workout_id, timestamp, qty: hr.Min, type: "Min" });
        }
        if (hr.Avg !== undefined) {
          entries.push({ workout_id, timestamp, qty: hr.Avg, type: "Avg" });
        }
        if (hr.Max !== undefined) {
          entries.push({ workout_id, timestamp, qty: hr.Max, type: "Max" });
        }

        if (entries.length > 0) {
          const { error: hrError } = await supabase
            .from("heart_rate_workout_data")
            .insert(entries);

          if (hrError) {
            console.error("Heart rate insert error:", hrError);
          }
        }
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
