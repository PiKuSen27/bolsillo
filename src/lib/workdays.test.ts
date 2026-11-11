import { describe, it, expect } from "vitest";
import {
  getRateForDate,
  getDefaultDayValue,
  getDayValue,
  isDayModified,
  calculateVariableIncome,
  listRangeDays,
} from "./workdays";
import { Settings, WorkDay } from "../types";
import { DEFAULT_SETTINGS } from "./constants";

// Rango: lunes 02/11/2026 al domingo 08/11/2026 (7 días), tarifa $40.000
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  incomeMode: "daily",
  dailyRate: 40000,
  dailyRangeStart: "2026-11-02",
  dailyRangeEnd: "2026-11-08",
  dailyRateChanges: [],
};

describe("workdays.ts - Sueldo por día", () => {
  it("Lunes a sábado valen la tarifa; el domingo arranca como día libre ($0)", () => {
    expect(getDefaultDayValue("2026-11-02", settings)).toBe(40000); // lunes
    expect(getDefaultDayValue("2026-11-07", settings)).toBe(40000); // sábado
    expect(getDefaultDayValue("2026-11-08", settings)).toBe(0); // domingo
  });

  it("Sin tocar nada, el ingreso del rango es 6 días × tarifa", () => {
    expect(calculateVariableIncome(settings, [])).toBe(240000);
  });

  it("Un día con monto propio usa ese monto; un día libre suma 0", () => {
    const overrides: WorkDay[] = [
      { date: "2026-11-03", worked: true, amount: 55000 }, // martes: más plata
      { date: "2026-11-04", worked: false, amount: 0 }, // miércoles: feriado
    ];
    expect(getDayValue("2026-11-03", settings, overrides)).toBe(55000);
    expect(getDayValue("2026-11-04", settings, overrides)).toBe(0);
    // 4 días × 40.000 + 55.000 + 0
    expect(calculateVariableIncome(settings, overrides)).toBe(215000);
  });

  it("Un domingo se puede volver a día trabajado", () => {
    const overrides: WorkDay[] = [{ date: "2026-11-08", worked: true, amount: 40000 }];
    expect(getDayValue("2026-11-08", settings, overrides)).toBe(40000);
    expect(calculateVariableIncome(settings, overrides)).toBe(280000);
  });

  it("Naranja SOLO si el monto quedó distinto de la tarifa; día libre no es naranja", () => {
    expect(isDayModified("2026-11-03", settings, { date: "2026-11-03", worked: true, amount: 55000 })).toBe(true);
    expect(isDayModified("2026-11-03", settings, { date: "2026-11-03", worked: true, amount: 40000 })).toBe(false);
    expect(isDayModified("2026-11-04", settings, { date: "2026-11-04", worked: false, amount: 0 })).toBe(false);
    expect(isDayModified("2026-11-03", settings, undefined)).toBe(false);
  });

  it("Cambiar la tarifa desde una fecha: los días anteriores quedan, los siguientes usan la nueva", () => {
    const withChange: Settings = {
      ...settings,
      dailyRateChanges: [{ fromDate: "2026-11-05", rate: 50000 }],
    };
    expect(getRateForDate("2026-11-04", withChange)).toBe(40000);
    expect(getRateForDate("2026-11-05", withChange)).toBe(50000);
    expect(getRateForDate("2026-11-07", withChange)).toBe(50000);
    // lun, mar, mié a 40.000 + jue, vie, sáb a 50.000
    expect(calculateVariableIncome(withChange, [])).toBe(120000 + 150000);
  });

  it("Con tarifa nueva, los días modificados a mano conservan su monto y no son naranja respecto a su tarifa", () => {
    const withChange: Settings = {
      ...settings,
      dailyRateChanges: [{ fromDate: "2026-11-05", rate: 50000 }],
    };
    const overrides: WorkDay[] = [{ date: "2026-11-06", worked: true, amount: 45000 }];
    expect(getDayValue("2026-11-06", withChange, overrides)).toBe(45000);
    expect(isDayModified("2026-11-06", withChange, overrides[0])).toBe(true);
    // Un día que coincide con la tarifa nueva no es naranja
    expect(isDayModified("2026-11-07", withChange, { date: "2026-11-07", worked: true, amount: 50000 })).toBe(false);
  });

  it("Varios cambios de tarifa: gana el último cuya fecha ya pasó", () => {
    const withChanges: Settings = {
      ...settings,
      dailyRateChanges: [
        { fromDate: "2026-11-06", rate: 60000 },
        { fromDate: "2026-11-04", rate: 50000 },
      ],
    };
    expect(getRateForDate("2026-11-03", withChanges)).toBe(40000);
    expect(getRateForDate("2026-11-05", withChanges)).toBe(50000);
    expect(getRateForDate("2026-11-06", withChanges)).toBe(60000);
  });

  it("Lista los días del rango con su valor y estado", () => {
    const days = listRangeDays(settings, [{ date: "2026-11-04", worked: false, amount: 0 }]);
    expect(days.length).toBe(7);
    expect(days[0]).toMatchObject({ date: "2026-11-02", value: 40000, free: false, modified: false });
    expect(days[2]).toMatchObject({ date: "2026-11-04", value: 0, free: true, modified: false });
    expect(days[6]).toMatchObject({ date: "2026-11-08", value: 0, free: true });
  });

  it("Sin rango configurado, el ingreso es 0 y la lista está vacía", () => {
    const noRange: Settings = { ...settings, dailyRangeStart: undefined, dailyRangeEnd: undefined };
    expect(calculateVariableIncome(noRange, [])).toBe(0);
    expect(listRangeDays(noRange, [])).toEqual([]);
  });
});
