import { describe, it, expect } from "vitest";
import {
  isDayLogged,
  getMissingDays,
  formatMissingDaysBanner,
  shouldTriggerDailyReminder,
  getDueAlertsToNotify,
} from "./reminders";
import { DayLog, Movement, UpcomingItem } from "../types";

describe("reminders.ts - Recordatorios, días faltantes y alertas", () => {
  it("Criterio: 'Hoy no gasté nada' marca el día como registrado", () => {
    const dayLogs: DayLog[] = [
      { date: "2026-11-10", logged: true, noExpenses: true },
    ];
    const isLogged = isDayLogged("2026-11-10", [], dayLogs);
    expect(isLogged).toBe(true);
  });

  it("Detecta movimientos manuales como día registrado", () => {
    const movements: Movement[] = [
      {
        id: "m1",
        date: "2026-11-09",
        amount: 3500,
        kind: "expense",
        categoryId: "comida",
        source: "manual",
        createdAt: "2026-11-09T12:00:00Z",
      },
    ];
    expect(isDayLogged("2026-11-09", movements, [])).toBe(true);
    expect(isDayLogged("2026-11-08", movements, [])).toBe(false);
  });

  it("Calcula días sin registrar desde el primer uso hasta ayer", () => {
    // Supongamos que la app arrancó el 2026-11-01 y hoy es 2026-11-04
    // Se anotó el 1 y el 2, falta el 3
    const dayLogs: DayLog[] = [
      { date: "2026-11-01", logged: true, noExpenses: true },
      { date: "2026-11-02", logged: true, noExpenses: false },
    ];

    const missing = getMissingDays({
      appStartDateStr: "2026-11-01",
      todayStr: "2026-11-04",
      movements: [],
      dayLogs,
    });

    expect(missing).toEqual(["2026-11-03"]);
  });

  it("Formatea banner de días faltantes en español", () => {
    const banner = formatMissingDaysBanner(["2026-11-03", "2026-11-04"]);
    expect(banner).toContain("Te falta anotar");
    expect(banner).toContain("noviembre");
  });

  it("Criterio: Aviso diario a la hora configurada si no se anotó nada", () => {
    // Si la hora actual es 21:00 y no anotó hoy
    const shouldNotify = shouldTriggerDailyReminder({
      currentHHMM: "21:00",
      reminderTime: "21:00",
      reminderEnabled: true,
      isTodayLogged: false,
      alreadySentToday: false,
    });
    expect(shouldNotify).toBe(true);

    // Si ya anotó hoy, no avisa
    const shouldNotNotifyIfLogged = shouldTriggerDailyReminder({
      currentHHMM: "21:00",
      reminderTime: "21:00",
      reminderEnabled: true,
      isTodayLogged: true,
      alreadySentToday: false,
    });
    expect(shouldNotNotifyIfLogged).toBe(false);

    // Si ya se mandó hoy, no repite
    const shouldNotDuplicate = shouldTriggerDailyReminder({
      currentHHMM: "21:00",
      reminderTime: "21:00",
      reminderEnabled: true,
      isTodayLogged: false,
      alreadySentToday: true,
    });
    expect(shouldNotDuplicate).toBe(false);
  });

  it("Criterio: Alertas de vencimientos N días antes y el mismo día", () => {
    const upcoming: UpcomingItem[] = [
      {
        id: "netflix",
        type: "recurring",
        name: "Netflix",
        amount: 22000,
        dueDate: "2026-11-13",
        daysUntil: 3,
        categoryId: "suscripciones",
        autoAdd: true,
        active: true,
      },
      {
        id: "luz",
        type: "recurring",
        name: "Luz",
        amount: 18000,
        dueDate: "2026-11-10",
        daysUntil: 0,
        categoryId: "servicios",
        autoAdd: true,
        active: true,
      },
      {
        id: "gym",
        type: "recurring",
        name: "Gym",
        amount: 15000,
        dueDate: "2026-11-20",
        daysUntil: 10,
        categoryId: "salud",
        autoAdd: true,
        active: true,
      },
    ];

    const alerts = getDueAlertsToNotify({
      upcomingItems: upcoming,
      dueAlertDays: 3,
      alreadySentKeys: new Set(),
    });

    expect(alerts.length).toBe(2);
    expect(alerts[0].body).toContain("Netflix vence en 3 días");
    expect(alerts[1].body).toContain("Luz vence hoy");
  });
});
