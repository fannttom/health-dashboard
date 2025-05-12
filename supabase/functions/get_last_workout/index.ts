import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )

  try {
    const { data: workouts, error: wErr } = await supabase
      .from('workouts')
      .select('id, start, end, type')
      .order('end', { ascending: false })
      .limit(1)

    if (wErr || !workouts || workouts.length === 0) {
      return new Response(JSON.stringify({ error: 'Нет тренировок' }), { status: 404 })
    }

    const workout = workouts[0]

    const { data: hr, error: hrErr } = await supabase
      .from('heart_rate_workout_data')
      .select('min, avg, max')
      .eq('workout_id', workout.id)
      .limit(1)

    const response = {
      id: workout.id,
      start: workout.start,
      end: workout.end,
      type: workout.type,
      ...(hr && hr[0] ? {
        heart_rate: {
          min: hr[0].min,
          avg: hr[0].avg,
          max: hr[0].max
        }
      } : {})
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Ошибка выполнения', details: e }), {
      status: 500
    })
  }
})
