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

      // === Обработка heart_rate_workout_data ===
      if (tableName === "heart_rate_workout_data") {
        for (const workout of metric.data || []) {
          const { workout_id, type, hr_data } = workout;
          if (!workout_id || !hr_data || !Array.isArray(hr_data)) continue;

          for (const e of hr_data) {
            if (!e.hr || !e.date) continue;
            const entry = {
              workout_id,
              type: type ?? null,
              hr: typeof e.hr === "string" ? parseInt(e.hr) : e.hr,
              timestamp: new Date(e.date).toISOString(),
            };
            const { error } = await supabase.from("heart_rate_workout_data").insert([entry]);
            if (error) {
              console.error("Insert error (HR workout):", error);
            }
          }
        }
        continue;
      }

      // === Обработка workouts ===
      if (tableName === "workouts") {
        for (const workout of metric.data || []) {
          const entry = {
            start: new Date(workout.start).toISOString(),
            end: new Date(workout.end).toISOString(),
            type: workout.type ?? null,
            source: workout.source ?? null,
            duration_min: workout.duration_min ?? null,
            energy_kcal: workout.energy_kcal ?? null,
            steps: workout.steps ?? null,
          };
          const { error } = await supabase.from("workouts").insert([entry]);
          if (error) {
            console.error("Insert error (workouts):", error);
          }
        }
        continue;
      }

      // === Стандартная логика Health-метрик ===
      for (const entry of metric.data || []) {
        if (!entry.qty || !entry.date) continue;
        const newEntry = {
          timestamp: new Date(entry.date).toISOString(),
          qty: typeof entry.qty === "string" ? parseFloat(entry.qty) : entry.qty,
          source: entry.source ?? null,
        };
        const { error } = await supabase.from(tableName).insert([newEntry]);
        if (error) {
          console.error(`Insert error in ${tableName}:`, error);
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
