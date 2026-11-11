import { describe, it, expect } from "vitest";
import { validateBackup, summarizeBackup } from "./backup";
import { DEFAULT_SETTINGS, MAX_AMOUNT } from "./constants";

const base = () => ({
  version: 2,
  exportedAt: "2026-11-11T10:00:00Z",
  settings: { ...DEFAULT_SETTINGS, fixedSalary: 900000, theme: "light" },
  movements: [
    { id: "m1", date: "2026-11-10", amount: 20000, kind: "expense", categoryId: "comida", note: "Pizza", source: "manual", createdAt: "2026-11-10T10:00:00Z" },
  ],
  recurrings: [
    { id: "r1", name: "Netflix", amount: 5000, categoryId: "suscripciones", dueDay: 10, autoAdd: true, active: true },
  ],
  installments: [
    { id: "i1", name: "Tele", totalAmount: 120000, installmentsCount: 12, installmentAmount: 10000, firstDueDate: "2026-10-05", paidCount: 2, categoryId: "otros", autoAdd: true, active: true },
  ],
  workDays: [{ date: "2026-11-04", worked: false, amount: 0 }],
  dayLogs: [{ date: "2026-11-09", logged: true, noExpenses: true }],
  debts: [{ id: "d1", kind: "i_owe", person: "Juan", amount: 15000, settled: false, createdAt: "2026-11-01T10:00:00Z" }],
});

describe("backup.ts - Validación real del archivo de respaldo", () => {
  it("Acepta un backup válido y devuelve los datos limpios", () => {
    const r = validateBackup(JSON.stringify(base()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.movements.length).toBe(1);
    expect(r.data.settings.fixedSalary).toBe(900000);
    expect(r.data.settings.theme).toBe("light");
    expect(r.data.debts.length).toBe(1);
  });

  it("Rechaza JSON roto, cosas que no son un backup y versiones desconocidas", () => {
    expect(validateBackup("{no json").ok).toBe(false);
    expect(validateBackup("[]").ok).toBe(false);
    expect(validateBackup(JSON.stringify({ ...base(), version: 99 })).ok).toBe(false);
    expect(validateBackup(JSON.stringify({ version: 2 })).ok).toBe(false);
  });

  it("Rechaza movimientos con fecha inválida, monto negativo, mayor al tope o kind desconocido, diciendo cuál", () => {
    const bad = (patch: object) => {
      const b = base();
      b.movements[0] = { ...b.movements[0], ...patch } as typeof b.movements[0];
      return validateBackup(JSON.stringify(b));
    };
    expect(bad({ date: "10/11/2026" })).toMatchObject({ ok: false, error: expect.stringContaining("m1") });
    expect(bad({ date: "2026-02-30" }).ok).toBe(false);
    expect(bad({ amount: -5 }).ok).toBe(false);
    expect(bad({ amount: MAX_AMOUNT + 1 }).ok).toBe(false);
    expect(bad({ amount: 12.5 }).ok).toBe(false);
    expect(bad({ kind: "transfer" }).ok).toBe(false);
    expect(bad({ source: "hack" }).ok).toBe(false);
  });

  it("Rechaza ids repetidos", () => {
    const b = base();
    b.movements.push({ ...b.movements[0] });
    expect(validateBackup(JSON.stringify(b))).toMatchObject({ ok: false, error: expect.stringContaining("repetido") });
  });

  it("Descarta campos desconocidos y completa settings con los valores por defecto", () => {
    const b = base();
    (b.movements[0] as Record<string, unknown>).hacker = "<script>";
    const s = b.settings as Record<string, unknown>;
    delete s.reminderTime;
    s.extra = 1;
    const r = validateBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("hacker" in r.data.movements[0]).toBe(false);
    expect("extra" in r.data.settings).toBe(false);
    expect(r.data.settings.reminderTime).toBe("21:00");
  });

  it("Valida settings: tema, modo, día de cobro, hora y tarifa", () => {
    const bad = (patch: object) =>
      validateBackup(JSON.stringify({ ...base(), settings: { ...base().settings, ...patch } })).ok;
    expect(bad({ theme: "blue" })).toBe(false);
    expect(bad({ incomeMode: "weekly" })).toBe(false);
    expect(bad({ payday: 32 })).toBe(false);
    expect(bad({ reminderTime: "9pm" })).toBe(false);
    expect(bad({ dailyRate: -1 })).toBe(false);
    expect(bad({ dailyRateChanges: [{ fromDate: "2026-11-01", rate: 50000 }] })).toBe(true);
    expect(bad({ dailyRateChanges: [{ fromDate: "ayer", rate: 50000 }] })).toBe(false);
  });

  it("Valida fijos, cuotas, días y deudas", () => {
    const b1 = base(); b1.recurrings[0].dueDay = 0;
    expect(validateBackup(JSON.stringify(b1)).ok).toBe(false);
    const b2 = base(); b2.installments[0].paidCount = 13;
    expect(validateBackup(JSON.stringify(b2)).ok).toBe(false);
    const b3 = base(); (b3.workDays[0] as { date: string }).date = "nope";
    expect(validateBackup(JSON.stringify(b3)).ok).toBe(false);
    const b4 = base(); (b4.debts[0] as { kind: string }).kind = "maybe";
    expect(validateBackup(JSON.stringify(b4)).ok).toBe(false);
  });

  it("Acepta un backup de versión 1 sin deudas (campo opcional)", () => {
    const b = base() as Record<string, unknown>;
    b.version = 1;
    delete b.debts;
    const r = validateBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.debts).toEqual([]);
  });

  it("Rechaza archivos de más de 10 MB", () => {
    const huge = JSON.stringify(base()).padEnd(10 * 1024 * 1024 + 1, " ");
    expect(validateBackup(huge)).toMatchObject({ ok: false, error: expect.stringContaining("grande") });
  });

  it("summarizeBackup cuenta registros para el cartel de confirmación", () => {
    const r = validateBackup(JSON.stringify(base()));
    if (!r.ok) throw new Error(r.error);
    expect(summarizeBackup(r.data)).toContain("1 movimiento");
    expect(summarizeBackup(r.data)).toContain("1 deuda");
  });
});
