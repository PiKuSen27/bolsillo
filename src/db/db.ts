import Dexie, { type Table } from "dexie";
import {
  DayLog,
  Debt,
  Installment,
  Movement,
  Recurring,
  ReminderSent,
  Settings,
  WorkDay,
} from "../types";
import type { VaultMeta } from "../lib/vault";

export class BolsilloDatabase extends Dexie {
  settings!: Table<Settings, string>;
  movements!: Table<Movement, string>;
  recurrings!: Table<Recurring, string>;
  installments!: Table<Installment, string>;
  workDays!: Table<WorkDay, string>;
  dayLogs!: Table<DayLog, string>;
  remindersSent!: Table<ReminderSent, string>;
  debts!: Table<Debt, string>;
  vault!: Table<VaultMeta, string>;

  constructor() {
    super("BolsilloDB");

    this.version(1).stores({
      settings: "id",
      movements: "id, date, kind, categoryId, source, createdAt",
      recurrings: "id, active, dueDay",
      installments: "id, active, firstDueDate",
      workDays: "date, worked",
      dayLogs: "date, logged, noExpenses",
      remindersSent: "key, sentAt",
    });

    this.version(2).stores({
      settings: "id",
      movements: "id, date, kind, categoryId, source, createdAt",
      recurrings: "id, active, dueDay",
      installments: "id, active, firstDueDate",
      workDays: "date, worked",
      dayLogs: "date, logged, noExpenses",
      remindersSent: "key, sentAt",
      debts: "id, kind, person, settled, dueDate, createdAt",
    });

    // v3: settings.dailyRateChanges ("cambiar tarifa desde X en adelante"). Sin cambio de índices.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((s: Settings) => {
            if (!Array.isArray(s.dailyRateChanges)) s.dailyRateChanges = [];
          });
      });

    // v4: se quitó el "objetivo opcional" del modo variable (dailyGoalName / dailyGoalAmount).
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            delete s.dailyGoalName;
            delete s.dailyGoalAmount;
          });
      });

    // v5: settings.windowZoom ("Tamaño de ventana", por defecto automático).
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((s: Settings) => {
            if (!s.windowZoom) s.windowZoom = "auto";
          });
      });

    // v6: ocultar montos (el ojo) y "Abrir siempre con los montos ocultos".
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((s: Settings) => {
            if (typeof s.hideAmounts !== "boolean") s.hideAmounts = false;
            if (typeof s.startHidden !== "boolean") s.startHidden = false;
          });
      });

    // v7: tabla "vault" con lo necesario para abrir los datos cifrados (sal, clave envuelta, intentos).
    // OJO futuras migraciones: si el cifrado está activo los registros son { clave, enc } y no se pueden
    // modificar acá; los valores por defecto nuevos los completa getSettings() al leer.
    this.version(7).stores({ vault: "id" });

    // v8: tutorial. Quien ya usaba la app no lo ve solo (lo puede abrir desde Ajustes).
    this.version(8)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            if (typeof s.enc === "string") return; // registro cifrado: no se puede tocar
            if (typeof s.tutorialDone !== "boolean") s.tutorialDone = true;
          });
      });
  }
}

export const db = new BolsilloDatabase();
