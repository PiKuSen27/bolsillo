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
import { DEFAULT_SETTINGS } from "../lib/constants";

export class BolsilloDatabase extends Dexie {
  settings!: Table<Settings, string>;
  movements!: Table<Movement, string>;
  recurrings!: Table<Recurring, string>;
  installments!: Table<Installment, string>;
  workDays!: Table<WorkDay, string>;
  dayLogs!: Table<DayLog, string>;
  remindersSent!: Table<ReminderSent, string>;
  debts!: Table<Debt, string>;

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
  }

  async initDefaults(): Promise<Settings> {
    const existing = await this.settings.get("main");
    if (!existing) {
      await this.settings.put(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    // Ensure incomeMode is set for existing records
    if (!existing.incomeMode) {
      existing.incomeMode = "salary";
      await this.settings.put(existing);
    }
    return existing;
  }
}

export const db = new BolsilloDatabase();
