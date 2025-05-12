// src/components/RecoveryAdvice.tsx
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"  // ✅ нужна framer-motion (мы сейчас её подключим)

interface RecoveryAdviceProps {
  formValue: number;
}

export function RecoveryAdvice({ formValue }: RecoveryAdviceProps) {
  let advice = "";
  let emoji = "";
  let backgroundColor = "";

  if (formValue > 15) {
    advice = "Отличное восстановление! Можно запланировать тяжёлую тренировку.";
    emoji = "🚀";
    backgroundColor = "bg-green-100";
  } else if (formValue > 5) {
    advice = "Форма хорошая. Подойдут средние или тяжёлые тренировки.";
    emoji = "✅";
    backgroundColor = "bg-green-50";
  } else if (formValue > -5) {
    advice = "Баланс. Можно провести лёгкую тренировку или день восстановления.";
    emoji = "🌿";
    backgroundColor = "bg-yellow-50";
  } else if (formValue > -15) {
    advice = "Форма ухудшилась. Лучше выбрать лёгкую активность или отдых.";
    emoji = "⚡";
    backgroundColor = "bg-yellow-100";
  } else {
    advice = "Высокая усталость! Рекомендуется восстановление и отдых.";
    emoji = "🛌";
    backgroundColor = "bg-red-100";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`mt-4 ${backgroundColor}`}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">{emoji}</span>
            <div className="text-2xl font-bold">Комментарий тренера</div>
          </div>
          <p className="text-lg leading-relaxed">{advice}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
