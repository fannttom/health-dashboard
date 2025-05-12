import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Запуск функции
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )

  // Получаем параметр days из тела запроса или по умолчанию 30
  const { days } = await req.json().catch(() => ({ days: 30 }))

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('vo2_max')
    .select('timestamp, qty')
    .gte('timestamp', sinceDate)

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  // Группируем по дате и усредняем
  const grouped: Record<string, number[]> = {}

  data.forEach(entry => {
    const date = entry.timestamp.split('T')[0]
    const value = parseFloat(entry.qty)
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(value)
  })

  const result = Object.entries(grouped).map(([date, values]) => ({
    date,
    avg_vo2_max: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
  }))

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
})
