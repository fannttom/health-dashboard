"use client"

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
    const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7)
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
      const fatigueAvg = weeklyTRIMPData.slice(Math.max(0, i - 0), i + 1).reduce((acc, w) => acc + w.trimp, 0) / 1
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
  const latestFormValue = form.length > 0 ? form[form.length - 1].form : 0

  const calculateReadinessScore = () => {
    let formScore = latestFormValue >= 10 ? 100 : latestFormValue >= 5 ? 80 : latestFormValue >= 0 ? 60 : latestFormValue >= -10 ? 40 : 20
    let rhrScore = (rhr.length > 0 && rhr[0]) ? (rhr[0] < 60 ? 100 : rhr[0] < 65 ? 80 : rhr[0] < 70 ? 60 : 40) : 60
    let hrvScore = (hrv.length > 0 && hrv[0]) ? (hrv[0] > 70 ? 100 : hrv[0] > 50 ? 80 : hrv[0] > 40 ? 60 : 40) : 60
    let sleepScore = lastNightSleep >= 7 ? 100 : lastNightSleep >= 6 ? 80 : lastNightSleep >= 5 ? 50 : 20
    return Math.round((formScore + rhrScore + hrvScore + sleepScore) / 4)
  }

  const readinessScore = calculateReadinessScore()

  const predictRecovery = () => {
    if (rhr.length < 5 || hrv.length < 5 || sleepData.length < 5) return []
    const avgRHR = rhr.reduce((a, b) => a + b, 0) / rhr.length
    const avgHRV = hrv.reduce((a, b) => a + b, 0) / hrv.length
    const avgSleep = sleepData.slice(-7).reduce((a, s) => a + s.duration_min, 0) / 7 / 60
    const predictions = []
    for (let i = 1; i <= 3; i++) {
      let score = 70
      if (rhr[0] < avgRHR) score += 10
      else score -= 10
      if (hrv[0] > avgHRV) score += 10
      else score -= 10
      if (avgSleep >= 7) score += 10
      else if (avgSleep < 6) score -= 10
      if (latestFormValue < 0) score -= 10
      score = Math.min(100, Math.max(0, score))
      predictions.push({ date: format(addDays(new Date(), i), "yyyy-MM-dd"), recoveryScore: score })
    }
    return predictions
  }

  const recoveryPredictions = predictRecovery()
  // Расчёт зон ЧСС
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Индекс готовности */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative bg-blue-50">
          {/* Цветной бейдж */}
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-white text-sm font-semibold ${
            readinessScore >= 80 ? "bg-green-500" : readinessScore >= 60 ? "bg-yellow-500" : "bg-red-500"
          }`}>
            {readinessScore >= 80
              ? "Готов к нагрузке"
              : readinessScore >= 60
              ? "Умеренная нагрузка"
              : "Нужен отдых"}
          </div>

          <CardContent className="p-6 text-center">
            <h2 className="text-3xl font-bold mb-4">🔋 Индекс готовности дня</h2>
            <div className="text-5xl font-bold mb-4">{readinessScore} / 100</div>

            {/* Комментарий тренера */}
            {readinessScore >= 80 ? (
              <div className="text-green-700 text-lg font-semibold">Отличная форма! Можно тренироваться активно.</div>
            ) : readinessScore >= 60 ? (
              <div className="text-yellow-700 text-lg font-semibold">Форма средняя. Рекомендую контролировать нагрузку.</div>
            ) : (
              <div className="text-red-700 text-lg font-semibold">Форма снижена. Лучше запланировать восстановление.</div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      {/* Прогноз восстановления */}
      {recoveryPredictions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-green-50">
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-center">📈 Прогноз восстановления</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={recoveryPredictions}>
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
      {/* Распределение по зонам ЧСС */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="bg-purple-50">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">❤️‍🔥 Распределение времени по зонам ЧСС</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={zonesData}
                  dataKey="value"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
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
      {/* Графики сна, калорий, TRIMP, фитнес-фатиг */}
      <div className="space-y-10">

        {/* Сон */}
        <Card className="relative">
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

        {/* Калории */}
        <Card>
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

        {/* TRIMP */}
        <Card>
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

        {/* Фитнес-Фатиг-Форма */}
        <Card>
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

      </div>
    </div> // <-- Закрываем главный контейнер
  )
}
