import { describe, it, expect } from "vitest";
import { backupStatus } from "./backupReminder";

const now = new Date(2026, 10, 12, 20, 0); // 12/11/2026 20:00 hora local

describe("backupReminder.ts - Último backup y recordatorio", () => {
  it("Backup de hoy, ayer y hace unos días: texto simple y sin recordatorio", () => {
    expect(backupStatus("2026-11-12T09:00:00", "2026-10-01T00:00:00", now)).toEqual({ label: "Último backup: hoy", overdue: false });
    expect(backupStatus("2026-11-11T23:00:00", "2026-10-01T00:00:00", now)).toEqual({ label: "Último backup: ayer", overdue: false });
    expect(backupStatus("2026-11-05T10:00:00", "2026-10-01T00:00:00", now)).toEqual({ label: "Último backup: hace 7 días", overdue: false });
  });

  it("Más de 7 días sin exportar → recordatorio", () => {
    expect(backupStatus("2026-11-04T10:00:00", "2026-10-01T00:00:00", now)).toEqual({ label: "Último backup: hace 8 días", overdue: true });
  });

  it("Nunca exportó: recuerda recién cuando la app tiene más de 7 días de uso", () => {
    expect(backupStatus(undefined, "2026-11-10T10:00:00", now)).toEqual({ label: "Todavía no hiciste ningún backup", overdue: false });
    expect(backupStatus(undefined, "2026-11-01T10:00:00", now)).toEqual({ label: "Todavía no hiciste ningún backup", overdue: true });
  });
});
