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
        const validSleepEntries = (metric.data || [])
          .filter((entry: any) => entry.inBedStart && entry.sleepEnd)
          .map((entry: any) => ({
            start: new Date(entry.inBedStart).toISOString(),
            end: new Date(entry.sleepEnd).toISOString(),
            duration_min:
              (new Date(entry.sleepEnd).getTime() -
                new Date(entry.inBedStart).getTime()) /
              60000,
            source: entry.source ?? null,
          }));

        for (const entry of validSleepEntries) {
          const { data: existing } = await supabase
            .from("sleep_data")
            .select("id")
            .eq("start", entry.start)
            .eq("end", entry.end)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase
              .from("sleep_data")
              .insert(entry);
            if (error) console.error(`Sleep insert error:`, error);
          }
        }

        continue;
      }

      // Обработка остальных health-метрик
      const validEntries = (metric.data || [])
        .filter((entry: any) => entry.qty && entry.date)
        .map((entry: any) => ({
          timestamp: new Date(entry.date).toISOString(),
          qty:
            typeof entry.qty === "string"
              ? parseFloat(entry.qty)
              : entry.qty,
          source: entry.source ?? null,
        }));

      for (const entry of validEntries) {
        const { data: existing } = await supabase
          .from(tableName)
          .select("id")
          .eq("timestamp", entry.timestamp)
          .eq("source", entry.source)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from(tableName).insert(entry);
          if (error) console.error(`Insert error in ${tableName}:`, error);
        }
      }
    }

    // 2. Workouts
    for (const workout of data.workouts || []) {
      const start = workout.start ? new Date(workout.start) : null;
      const end = workout.end ? new Date(workout.end) : null;
      if (!start || !end) continue;

      const duration_min = (end.getTime() - start.getTime()) / 60000;

      const type = workout.name ?? "Unknown";
      const source = workout.source ?? null;

      const energy_kcal = workout.activeEnergyBurned?.qty ?? null;
      const distance_km = workout.distance?.qty ?? null;
      const steps = workout.steps ?? null;

      const { data: existingWorkout } = await supabase
        .from("workouts")
        .select("id")
        .eq("start", start.toISOString())
        .eq("end", end.toISOString())
        .eq("type", type)
        .eq("source", source)
        .maybeSingle();

      let workout_id: number | null = null;

      if (existingWorkout) {
        workout_id = existingWorkout.id;
      } else {
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

        workout_id = insertedWorkout[0].id;
      }

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

        for (const entry of entries) {
          const { data: existing } = await supabase
            .from("heart_rate_workout_data")
            .select("id")
            .eq("workout_id", entry.workout_id)
            .eq("timestamp", entry.timestamp)
            .eq("type", entry.type)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase
              .from("heart_rate_workout_data")
              .insert(entry);
            if (error) console.error("Heart rate insert error:", error);
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
