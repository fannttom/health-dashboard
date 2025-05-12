import { functions } from "@/lib/functions"

export async function POST(req) {
  const { prompt } = await req.json()

  console.log("🚀 Получен prompt от пользователя:", prompt)

  // Первый запрос в OpenAI с function calling
  const initialResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-1106-preview",
      messages: [{ role: "user", content: prompt }],
      functions,
      function_call: "auto"
    })
  })

  const result = await initialResponse.json()
  const choice = result.choices[0]

  console.log("🧠 Ответ GPT (первый):", JSON.stringify(choice, null, 2))

  // Если GPT хочет вызвать функцию
  if (choice.finish_reason === "function_call") {
    const { name, arguments: argsJson } = choice.message.function_call
    const args = JSON.parse(argsJson)

    console.log(`📡 Вызов Supabase функции: ${name} с аргументами:`, args)

    const supabaseResp = await fetch(`https://bhxpstuyrdmocaxhjbiw.functions.supabase.co/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(args)
    })

    const functionResult = await supabaseResp.json()

    console.log("📦 Ответ от Supabase:", functionResult)

    // Второй запрос в OpenAI: GPT использует данные функции
    const followUp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-1106-preview",
        messages: [
          { role: "user", content: prompt },
          choice.message,
          {
            role: "function",
            name,
            content: JSON.stringify(functionResult)
          }
        ]
      })
    })

    const final = await followUp.json()

    console.log("🎯 Финальный ответ GPT:", final.choices[0].message.content)

    return new Response(JSON.stringify({ result: final.choices[0].message.content }), {
      status: 200
    })
  }

  // Если GPT не вызвал функцию
  console.log("📭 GPT не вызвал функцию. Ответ как есть.")

  return new Response(JSON.stringify({ result: choice.message.content }), {
    status: 200
  })
}
