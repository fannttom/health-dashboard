export const functions = [
  {
    name: "get_vo2_max_trend",
    description: "Возвращает усреднённые значения VO₂ max по дням за последние N дней",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Количество последних дней для анализа",
          default: 30
        }
      }
    }
  },
  {
    name: "get_sleep_summary",
    description: "Возвращает среднюю продолжительность сна и статистику за последние N дней",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Период в днях для анализа сна",
          default: 7
        }
      }
    }
  },
  {
    name: "get_rhr_trend",
    description: "Возвращает тренд пульса в покое (RHR) по дням за последние N дней",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Количество последних дней для анализа",
          default: 7
        }
      }
    }
  },
  {
    name: "get_hrv_trend",
    description: "Возвращает тренд вариабельности сердечного ритма (HRV) по дням за последние N дней",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Количество последних дней для анализа",
          default: 7
        }
      }
    }
  },
  {
    name: "get_max_hr_workout",
    description: "Возвращает тренировку с самым высоким зафиксированным пульсом (тип Max)",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_metric_average",
    description: "Возвращает среднее значение указанной метрики из Supabase за последние N дней",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Имя таблицы с метрикой, например: 'step_count', 'vo2_max', 'oxygen_saturation'"
        },
        days: {
          type: "integer",
          description: "Количество дней для усреднения",
          default: 7
        }
      },
      required: ["metric"]
    }
  },
  {
    name: "detect_fatigue_pattern",
    description: "Выполняет анализ усталости по HRV, RHR, шагам и сну за последние 3 дня и возвращает риски",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];
