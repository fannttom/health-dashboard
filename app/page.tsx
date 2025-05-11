"use client"
const useAllMetrics = () => {
  const [metrics, setMetrics] = useState({})

  useEffect(() => {
    const load = async () => {
      const tables = [
        'resting_heart_rate', 'heart_rate_variability', 'blood_oxygen_saturation',
        'respiratory_rate', 'vo2_max', 'step_count', 'walking_speed',
        'walking_step_length', 'walking_running_distance', 'walking_heart_rate_average',
        'six_minute_walking_test_distance', 'oxygen_saturation',
        'cardio_recovery', 'environmental_audio_exposure', 'flights_climbed',
        'active_energy', 'basal_energy_burned', 'apple_exercise_time',
        'apple_stand_hour', 'apple_stand_time', 'physical_effort',
        'time_in_daylight'
      ]

      const result = {}
      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select('qty')
          .order('timestamp', { ascending: false })
          .limit(7)

        if (data && data.length > 0) {
          const avg = data.reduce((sum, item) => sum + (item.qty || 0), 0) / data.length
          result[table] = Number(avg.toFixed(2))
        }
      }

      setMetrics(result)
    }

    load()
  }, [])

  return metrics
}


import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { addDays, format } from "date-fns"

export default function Home() {
  const [workouts, setWorkouts] = useState([])
  const [sleepData, setSleepData] = useState([])
  const [rhr, setRhr] = useState([])
  const [hrv, setHrv] = useState([])
  const [heartRateData, setHeartRateData] = useState([])
  const [question, setQuestion] = useState("")
  const [history, setHistory] = useState([])
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const allMetrics = useAllMetrics()
const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState("")
useEffect(() => {
  const isAuth = localStorage.getItem("authorized")
  if (isAuth === "true") {
    setAuthorized(true)
  }
}, [])

  useEffect(() => {
    const loadData = async () => {
      const { data: workoutData } = await supabase.from('workouts').select('*').order('start', { ascending: true })
      const { data: sleep } = await supabase.from('sleep_data').select('*').order('start', { ascending: true })
      const { data: rhrData } = await supabase.from('resting_heart_rate').select('qty, timestamp').order('timestamp', { ascending: false }).limit(7)
      const { data: hrvData } = await supabase.from('heart_rate_variability').select('qty, timestamp').order('timestamp', { ascending: false }).limit(7)
      const { data: hrData } = await supabase.from('heart_rate_workout_data').select('*')

      if (workoutData) setWorkouts(workoutData)
      if (sleep) setSleepData(sleep)
      if (rhrData) setRhr(rhrData.map(item => item.qty))
      if (hrvData) setHrv(hrvData.map(item => item.qty))
      if (hrData) setHeartRateData(hrData)
    }
    loadData()
  }, [])

  const dailyCalories = workouts.reduce((acc, workout) => {
    const date = workout.start.split('T')[0]
    if (!acc[date]) acc[date] = 0
    acc[date] += workout.energy_kcal || 0
    return acc
  }, {})

  const weeklyTRIMP = workouts.reduce((acc, workout) => {
    const date = new Date(workout.start)
    const onejan = new Date(date.getFullYear(), 0, 1)
    const week = Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
    const weekKey = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
    const intensity = workout.type === 'Boxing' ? 1.2 : workout.type === 'Outdoor Walk' ? 0.7 : 1.0
    if (!acc[weekKey]) acc[weekKey] = 0
    acc[weekKey] += workout.duration_min * intensity
    return acc
  }, {})

  const dailyCaloriesData = Object.keys(dailyCalories).map(date => ({ date, calories: dailyCalories[date] }))
  const weeklyTRIMPData = Object.keys(weeklyTRIMP).map(week => ({ week, trimp: Math.round(weeklyTRIMP[week]) }))

  const { fitness, fatigue, form } = (() => {
    const fitness = [], fatigue = [], form = []
    weeklyTRIMPData.forEach((item, i) => {
      const fitnessAvg = weeklyTRIMPData.slice(Math.max(0, i - 2), i + 1).reduce((acc, w) => acc + w.trimp, 0) / Math.min(3, i + 1)
      const fatigueAvg = weeklyTRIMPData.slice(i, i + 1).reduce((acc, w) => acc + w.trimp, 0) / 1
      fitness.push({ week: item.week, fitness: Math.round(fitnessAvg) })
      fatigue.push({ week: item.week, fatigue: Math.round(fatigueAvg) })
      form.push({ week: item.week, form: Math.round(fitnessAvg - fatigueAvg) })
    })
    return { fitness, fatigue, form }
  })()

  const sleepChartData = sleepData.map(item => ({
    date: item.start.split('T')[0],
    sleepDurationHours: item.duration_min / 60
  }))

  const lastNightSleep = sleepChartData.length > 0 ? sleepChartData[sleepChartData.length - 1].sleepDurationHours : 0

  const sleepQuality = (() => {
    if (lastNightSleep >= 7) return { text: "Отличный сон", color: "bg-green-500" }
    if (lastNightSleep >= 6) return { text: "Нормальный сон", color: "bg-yellow-500" }
    return { text: "Плохой сон", color: "bg-red-500" }
  })()

  const latestFormValue = form.length > 0 ? form[form.length - 1].form : 0

  const calculateReadinessScore = () => {
    let formScore = latestFormValue >= 10 ? 100 : latestFormValue >= 5 ? 80 : latestFormValue >= 0 ? 60 : latestFormValue >= -10 ? 40 : 20
    let rhrScore = (rhr.length > 0 && rhr[0]) ? (rhr[0] < 60 ? 100 : rhr[0] < 65 ? 80 : rhr[0] < 70 ? 60 : 40) : 60
    let hrvScore = (hrv.length > 0 && hrv[0]) ? (hrv[0] > 70 ? 100 : hrv[0] > 50 ? 80 : hrv[0] > 40 ? 60 : 40) : 60
    let sleepScore = lastNightSleep >= 7 ? 100 : lastNightSleep >= 6 ? 80 : lastNightSleep >= 5 ? 50 : 20
    return Math.round((formScore + rhrScore + hrvScore + sleepScore) / 4)
  }

  const readinessScore = calculateReadinessScore()
const prepareHealthMetrics = () => {
  if (!allMetrics || Object.keys(allMetrics).length === 0)
    return "Нет данных по дополнительным метрикам."

  return Object.entries(allMetrics)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join("\n")
}


  const coachComment = (() => {
    if (readinessScore >= 80 && sleepQuality.text === "Отличный сон" && latestFormValue >= 10) {
      return "💪 Отличная форма и восстановление! Можно планировать тяжёлую тренировку или соревнование."
    }
    if (readinessScore >= 60 && sleepQuality.text !== "Плохой сон") {
      return "✅ Форма нормальная. Рекомендую умеренные тренировки или лёгкую нагрузку."
    }
    if (readinessScore < 60 || sleepQuality.text === "Плохой сон") {
      return "⚠️ Сниженная готовность или недостаток сна. Лучше сделать день восстановления или лёгкую активность."
    }
    return "ℹ️ Недостаточно данных для оценки. Следите за восстановлением."
  })()

  const recoveryIndicator = (() => {
    if (readinessScore >= 80 && sleepQuality.text === "Отличный сон") {
      return { text: "Идеальное восстановление", color: "bg-green-500" }
    }
    if (readinessScore >= 60 && sleepQuality.text !== "Плохой сон") {
      return { text: "Нормальное восстановление", color: "bg-yellow-500" }
    }
    return { text: "Признаки усталости", color: "bg-red-500" }
  })()

  const maxHR = heartRateData.length > 0 ? Math.max(...heartRateData.map(item => item.qty)) : 200

  const zones = [
    { zone: 'Z1 (50–60%)', min: 0.5 * maxHR, max: 0.6 * maxHR },
    { zone: 'Z2 (60–70%)', min: 0.6 * maxHR, max: 0.7 * maxHR },
    { zone: 'Z3 (70–80%)', min: 0.7 * maxHR, max: 0.8 * maxHR },
    { zone: 'Z4 (80–90%)', min: 0.8 * maxHR, max: 0.9 * maxHR },
    { zone: 'Z5 (90–100%)', min: 0.9 * maxHR, max: 1.0 * maxHR },
  ]

  const zonesData = zones.map(({ zone, min, max }) => ({
    zone,
    value: heartRateData.filter(item => item.qty >= min && item.qty < max).length,
  }))

  const colors = ['#82ca9d', '#8884d8', '#ffc658', '#ff8042', '#d0ed57']

  const askConsultant = async () => {
    if (!question.trim()) return
    setLoadingAnswer(true)

    const prompt = `
Вот мои данные по здоровью и активности:

- readinessScore: ${readinessScore}
- form (TSB): ${latestFormValue}
- sleepQuality: ${sleepQuality.text}
- fitness: ${fitness[fitness.length - 1]?.fitness}
- fatigue: ${fatigue[fatigue.length - 1]?.fatigue}
- зоны ЧСС: ${JSON.stringify(zonesData, null, 2)}

Дополнительные метрики:
${prepareHealthMetrics()}

Вопрос пользователя: ${question}

Ответь развёрнуто, как консультант по здоровью и тренировкам. Сделай выводы, сопоставь метрики, и предложи рекомендации.
`


    const res = await fetch('/api/consultant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    const data = await res.json()
    setHistory(prev => [...prev, { q: question, a: data.result }])
    setQuestion("")
    setLoadingAnswer(false)
  }
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white shadow-md rounded-2xl p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4">🔐 Доступ к дашборду</h2>
          <p className="mb-2 text-gray-600">Введите пароль:</p>
          <input
            type="password"
            className="border px-4 py-2 rounded w-full mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setAuthorized(password === "kirill123")}
          >
            Войти
          </button>
          {password && password !== "kirill123" && (
            <p className="text-red-500 mt-2">Неверный пароль</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative bg-blue-50 rounded-2xl shadow-lg">
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-white text-sm font-semibold ${
            readinessScore >= 80 ? "bg-green-500" : readinessScore >= 60 ? "bg-yellow-500" : "bg-red-500"
          }`}>
            {readinessScore >= 80 ? "Готов к нагрузке" : readinessScore >= 60 ? "Умеренная нагрузка" : "Нужен отдых"}
          </div>
          <CardContent className="p-6 text-center">
            <h2 className="text-3xl font-bold mb-4">🔋 Индекс готовности дня</h2>
            <div className="text-5xl font-bold mb-4">{readinessScore} / 100</div>
            <div className="text-lg font-medium">{coachComment}</div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-green-50 rounded-2xl shadow-lg">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">🛡️ Индикатор восстановления</h2>
            <div className={`inline-block px-6 py-2 rounded-full text-white text-lg font-semibold ${recoveryIndicator.color}`}>
              {recoveryIndicator.text}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {form.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-yellow-50 rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-center">📈 Прогноз восстановления</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={[
                  { date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), recoveryScore: readinessScore },
                  { date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), recoveryScore: readinessScore - 5 },
                  { date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), recoveryScore: readinessScore - 10 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="recoveryScore" stroke="#4CAF50" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative bg-indigo-50 rounded-2xl shadow-lg">
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-white text-sm font-semibold ${sleepQuality.color}`}>
            {sleepQuality.text}
          </div>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">💤 График сна</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sleepChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: "Часы сна", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Line type="monotone" dataKey="sleepDurationHours" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-red-50 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">🔥 График калорий</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyCaloriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="calories" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-pink-50 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">📊 График TRIMP</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyTRIMPData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="trimp" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-green-50 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">⚡ Фитнес-Фатиг-Форма</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" type="category" allowDuplicatedCategory={false} interval={0} />
                <YAxis />
                <Tooltip />
                <Line dataKey="fitness" data={fitness} name="Фитнес (CTL)" stroke="#4CAF50" strokeWidth={2} />
                <Line dataKey="fatigue" data={fatigue} name="Усталость (ATL)" stroke="#F44336" strokeWidth={2} />
                <Line dataKey="form" data={form} name="Форма (TSB)" stroke="#2196F3" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-purple-50 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">❤️‍🔥 Распределение времени по зонам ЧСС</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={zonesData} dataKey="value" nameKey="zone" cx="50%" cy="50%" outerRadius={100} label>
                  {zonesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* (сюда я вставлю все твои карточки из предыдущего кода — чтобы не обрезать их) */}

      {/* 👉 и внизу ИИ-консультант */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-white rounded-2xl shadow-lg">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">🧠 Вопрос ИИ-консультанту</h2>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Задай вопрос по своим данным..."
              className="w-full px-3 py-2 rounded border"
            />
            <button
              onClick={askConsultant}
              disabled={loadingAnswer}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              {loadingAnswer ? "Ожидайте..." : "Спросить"}
            </button>
            <div className="space-y-3">
              {history.slice().reverse().map((item, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded shadow">
                  <p className="text-gray-600"><strong>Вопрос:</strong> {item.q}</p>
                  <p className="text-gray-800"><strong>Ответ:</strong> {item.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
