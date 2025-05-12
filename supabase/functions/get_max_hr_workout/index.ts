import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { data, error } = await supabase
    .from("heart_rate_workout_data")
    .select("workout_id, qty")
    .eq("type", "Max")
    .order("qty", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return new Response(JSON.stringify({ error: "Нет записей с типом Max" }), {
      status: 404,
    });
  }

  const top = data[0];
  const maxHr = parseFloat(top.qty);

  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .select("start, end, type")
    .eq("id", top.workout_id)
    .limit(1);

  if (wErr || !workout || workout.length === 0) {
    return new Response(JSON.stringify({ error: "Не найдена соответствующая тренировка" }), {
      status: 404,
    });
  }

  const result = {
    workout_id: top.workout_id,
    start: workout[0].start,
    end: workout[0].end,
    type: workout[0].type,
    max_heart_rate: maxHr
  };

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" }
  });
});
