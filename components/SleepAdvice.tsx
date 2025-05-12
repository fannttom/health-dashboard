'use client'

import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

interface SleepAdviceProps {
  lastNightSleep: number
  avgSleep: number
}

export function SleepAdvice({ lastNightSleep, avgSleep }: SleepAdviceProps) {
  let advice = "";
  let bgColor = "";

  if (lastNightSleep >= 7) {
    advice = "Отличный сон! Ты хорошо восстановился.";
    bgColor = "bg-green-100";
  } else if (lastNightSleep >= 6) {
    advice = "Сон нормальный, но можно улучшить.";
    bgColor = "bg-yellow-100";
  } else if (lastNightSleep >= 5) {
    advice = "Мало сна! Постарайся отдохнуть сегодня.";
    bgColor = "bg-orange-100";
  } else {
    advice = "Очень мало сна! Рекомендуется лёгкий режим.";
    bgColor = "bg-red-100";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className={bgColor}>
        <CardContent className="p-4 text-center space-y-2">
          <h2 className="text-xl font-bold">🛌 Комментарий тренера по сну</h2>
          <div className="text-2xl">{advice}</div>
          <div className="text-sm text-gray-600">
            Последний сон: {lastNightSleep.toFixed(1)} ч • Средний: {avgSleep.toFixed(1)} ч
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
