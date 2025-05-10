"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { addDays, format, subDays } from "date-fns";

export default function Home() {
  const [workouts, setWorkouts] = useState([]);
  const [sleepData, setSleepData] = useState([]);
  const [rhr, setRhr] = useState([]);
  const [hrv, setHrv] = useState([]);
  const [heartRateData, setHeartRateData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Константы для расчётов
  const HR_MAX = 205;
  const RHR = 55;
  const K_FACTOR = 1.92; // Для мужчин

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: workoutData } = await supabase
        .from('workouts')
        .select('id, start, duration_min, energy_kcal, type')
        .order('start', { ascending: true })
        .gte('start', format(subDays(new Date(), 90), 'yyyy-MM-dd'));
      const { data: sleep } = await supabase
        .from('sleep_data')
        .select('start, duration_min')
        .order('start', { ascending: true })
        .gte('start', format(subDays(new Date(), 90), 'yyyy-MM-dd'));
      const { data: rhrData } = await supabase
        .from('resting_heart_rate')
        .select('qty, timestamp')
        .order('timestamp', { ascending: false })
        .limit(7);
      const { data: hrvData } = await supabase
        .from('heart_rate_variability')
        .select('qty, timestamp')
        .order('timestamp', { ascending: false })
        .limit(7);
      const { data: hrData } = await supabase
        .from('heart_rate_workout_data')
        .select('qty, workout_id');

      setWorkouts(workoutData || []);
      setSleepData(sleep || []);
      setRhr(rhrData?.map((item) => item.qty) || []);
      setHrv(hrvData?.map((item) => item.qty) || []);
      setHeartRateData(hrData || []);
      setLoading(false);
    };
    loadData();
  }, []);

  // Расчёт TRIMP
  const calculateTRIMP = (workout, avgHR) => {
    if (!avgHR || !workout.duration_min) return 0;
    const hrRatio = (avgHR - RHR) / (HR_MAX - RHR);
    return workout.duration_min * hrRatio * K_FACTOR;
  };

  // Расчёт недельного TRIMP
  const weeklyTRIMP = useMemo(() => {
    return workouts.reduce((acc, workout) => {
      const date = new Date(workout.start);
      const onejan = new Date(date.getFullYear(), 0, 1);
      const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      const weekKey = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;

      const workoutHR = heartRateData
        .filter((hr) => hr.workout_id === workout.id)
        .reduce((sum, hr) => sum + hr.qty, 0) /
        (heartRateData.filter((hr) => hr.workout_id === workout.id).length || 1);

      const trimp = calculateTRIMP(workout, workoutHR);
      if (!acc[weekKey]) acc[weekKey] = 0;
      acc[weekKey] += trimp;
      return acc;
    }, {});
  }, [workouts, heartRateData]);

  const weeklyTRIMPData = useMemo(() => {
    return Object.keys(weeklyTRIMP).map((week) => ({
      week,
      trimp: Math.round(weeklyTRIMP[week]),
    }));
  }, [weeklyTRIMP]);

  // Расчёт CTL, ATL, TSB
  const { fitness, fatigue, form } = useMemo(() => {
    const fitness = [];
    const fatigue = [];
    const form = [];
    let ctl = 0;
    let atl = 0;

    weeklyTRIMPData.forEach((item) => {
      const ctlDecay = Math.exp(-1 / 42);
      const atlDecay = Math.exp(-1 / 7);
      ctl = ctl * ctlDecay + item.trimp * (1 - ctlDecay);
      atl = atl * atlDecay + item.trimp * (1 - atlDecay);

      fitness.push({ week: item.week, fitness: Math.round(ctl) });
      fatigue.push({ week: item.week, fatigue: Math.round(atl) });
      form.push({ week: item.week, form: Math.round(ctl - atl) });
    });

    return { fitness, fatigue, form };
  }, [weeklyTRIMPData]);

  // Расчёт калорий
  const dailyCalories = useMemo(() => {
    return workouts.reduce((acc, workout) => {
      const date = workout.start.split('T')[0];
      if (!acc[date]) acc[date] = 0;
      acc[date] += workout.energy_kcal || 0;
      return acc;
    }, {});
  }, [workouts]);

  const dailyCaloriesData = useMemo(() => {
    return Object.keys(dailyCalories).map((date) => ({
      date,
      calories: dailyCalories[date],
    }));
  }, [dailyCalories]);

  // Данные сна
  const sleepChartData = useMemo(() => {
    return sleepData.map((item) => ({
      date: item.start.split('T')[0],
      sleepDurationHours: item.duration_min / 60,
    }));
  }, [sleepData]);

  const lastNightSleep = sleepChartData.length > 0 ? sleepChartData[sleepChartData.length - 1].sleepDurationHours : 0;

  const sleepQuality = useMemo(() => {
    if (lastNightSleep >= 7) return { text: "Отличный сон", color: "bg-green-500" };
    if (lastNightSleep >= 6) return { text: "Нормальный сон", color: "bg-yellow-500" };
    return { text: "Плохой сон", color: "bg-red-500" };
  }, [lastNightSleep]);

  const latestFormValue = form.length > 0 ? form[form.length - 1].form : 0;

  // Расчёт индекса готовности
  const calculateReadinessScore = () => {
    let formScore = latestFormValue >= 10 ? 100 : latestFormValue >= 5 ? 80 : latestFormValue >= 0 ? 60 : latestFormValue >= -10 ? 40 : 20;
    let rhrScore = (rhr.length > 0 && rhr[0]) ? (rhr[0] < 60 ? 100 : rhr[0] < 65 ? 80 : rhr[0] < 70 ? 60 : 40) : 60;
    let hrvScore = (hrv.length > 0 && hrv[0]) ? (hrv[0] > 70 ? 100 : hrv[0] > 50 ? 80 : hrv[0] > 40 ? 60 : 40) : 60;
    let sleepScore = lastNightSleep >= 7 ? 100 : lastNightSleep >= 6 ? 80 : lastNightSleep >= 5 ? 50 : 20;
    return Math.round((formScore + rhrScore + hrvScore + sleepScore) / 4);
  };

  const readinessScore = calculateReadinessScore();

  // Прогноз восстановления
  const predictRecovery = () => {
    if (rhr.length < 3 || hrv.length < 3 || sleepData.length < 1 || form.length < 1) {
      return [];
    }

    const avgRHR = rhr.reduce((a, b) => a + b, 0) / rhr.length;
    const avgHRV = hrv.reduce((a, b) => a + b, 0) / hrv.length;
    const latestSleep = sleepData[sleepData.length - 1]?.duration_min / 60 || 6;
    const latestFormValue = form[form.length - 1]?.form || 0;
    const latestATL = fatigue[fatigue.length - 1]?.fatigue || 0;

    const hrvTrend = hrv.length >= 3 ? (hrv[0] > hrv[1] && hrv[1] > hrv[2] ? 10 : hrv[0] < hrv[1] && hrv[1] < hrv[2] ? -10 : 0) : 0;

    const predictions = [];
    for (let i = 1; i <= 3; i++) {
      let score = 70;

      const rhrDeviation = rhr[0] - 55;
      score -= rhrDeviation * 2;

      const hrvDeviation = hrv[0] - avgHRV;
      score += hrvDeviation * 0.5;
      score += hrvTrend;

      if (latestSleep >= 7.5) score += 15;
      else if (latestSleep >= 6.5) score += 5;
      else if (latestSleep < 5.5) score -= 15;
      else if (latestSleep < 6.5) score -= 5;

      score -= latestATL * 0.1 * (1 - (i - 1) * 0.3);

      score += latestFormValue * 0.5;

      score = Math.min(100, Math.max(0, Math.round(score)));

      predictions.push({
        date: format(addDays(new Date(), i), "yyyy-MM-dd"),
        recoveryScore: score,
      });
    }

    return predictions;
  };

  const recoveryPredictions = predictRecovery();

  const coachComment = useMemo(() => {
    if (readinessScore >= 80 && sleepQuality.text === "Отличный сон" && latestFormValue >= 10) {
      return "💪 Отличная форма и восстановление! Можно планировать тяжёлую тренировку или соревнование.";
    }
    if (readinessScore >= 60 && sleepQuality.text !== "Плохой сон") {
      return "✅ Форма нормальная. Рекомендую умеренные тренировки или лёгкую нагрузку.";
    }
    if (readinessScore < 60 || sleepQuality.text === "Плохой сон") {
      return "⚠️ Сниженная готовность или недостаток сна. Лучше сделать день восстановления или лёгкую активность.";
    }
    return "ℹ️ Недостаточно данных для оценки. Следите за восстановлением.";
  }, [readinessScore, sleepQuality, latestFormValue]);

  const recoveryIndicator = useMemo(() => {
    if (readinessScore >= 80 && sleepQuality.text === "Отличный сон") {
      return { text: "Идеальное восстановление", color: "bg-green-500" };
    }
    if (readinessScore >= 60 && sleepQuality.text !== "Плохой сон") {
      return { text: "Нормальное восстановление", color: "bg-yellow-500" };
    }
    return { text: "Признаки усталости", color: "bg-red-500" };
  }, [readinessScore, sleepQuality]);

  // Зоны ЧСС
  const zones = [
    { zone: 'Z1 (50–60%)', min: RHR + 0.5 * (HR_MAX - RHR), max: RHR + 0.6 * (HR_MAX - RHR) },
    { zone: 'Z2 (60–70%)', min: RHR + 0.6 * (HR_MAX - RHR), max: RHR + 0.7 * (HR_MAX - RHR) },
    { zone: 'Z3 (70–80%)', min: RHR + 0.7 * (HR_MAX - RHR), max: RHR + 0.8 * (HR_MAX - RHR) },
    { zone: 'Z4 (80–90%)', min: RHR + 0.8 * (HR_MAX - RHR), max: RHR + 0.9 * (HR_MAX - RHR) },
    { zone: 'Z5 (90–100%)', min: RHR + 0.9 * (HR_MAX - RHR), max: HR_MAX },
  ];

  const zonesData = useMemo(() => {
    return zones.map(({ zone, min, max }) => ({
      zone,
      value: heartRateData.filter((item) => item.qty >= min && item.qty < max).length,
    }));
  }, [heartRateData]);

  const colors = ['#82ca9d', '#8884d8', '#ffc658', '#ff8042', '#d0ed57'];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Индекс готовности */}
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

      {/* Индикатор восстановления */}
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

      {/* Прогноз восстановления */}
      {recoveryPredictions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-yellow-50 rounded-2xl shadow-lg">
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

      {/* Сон */}
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

      {/* График калорий */}
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

      {/* График TRIMP */}
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

      {/* График Фитнес-Фатиг-Форма */}
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

      {/* Зоны ЧСС */}
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
    </div>
  );
}