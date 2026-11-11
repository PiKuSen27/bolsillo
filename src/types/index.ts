export type MovementKind = "expense" | "income";

export type MovementSource =
  | "manual"
  | "recurring"
  | "installment"
  | "salary"
  | "daily"
  | "debt";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export type IncomeMode = "salary" | "daily";

export interface Settings {
  id: string; // 'main'
  currency: "ARS";
  incomeMode: IncomeMode; // 'salary' | 'daily' (excluyente)
  fixedSalary: number; // e.g. 700000
  payday: number; // 1 - 31
  dailyRate: number; // e.g. 25000
  dailyRangeStart?: string; // YYYY-MM-DD
  dailyRangeEnd?: string; // YYYY-MM-DD
  dailyGoalName?: string; // e.g. "Pagar tele"
  dailyGoalAmount?: number; // e.g. 150000
  reminderTime: string; // "21:00"
  reminderEnabled: boolean;
  dueAlertDays: number; // e.g. 3
  theme: "dark" | "light";
  categories: Category[];
  onboardingDone: boolean;
  closeToTray: boolean;
  autostart: boolean;
  createdAt: string;
}

export interface Movement {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // Integer ARS
  kind: MovementKind;
  categoryId: string;
  note?: string;
  source: MovementSource;
  recurringId?: string;
  installmentId?: string;
  debtId?: string;
  createdAt: string; // ISO string
}

export type RecurringFrequency = "monthly" | "weekly" | "yearly";

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  frequency: RecurringFrequency;
  dueDay: number; // 1-31
  autoAdd: boolean;
  active: boolean;
  lastAppliedDate?: string; // YYYY-MM-DD
}

export interface Installment {
  id: string;
  name: string;
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  firstDueDate: string; // YYYY-MM-DD
  paidCount: number;
  categoryId: string;
  autoAdd: boolean;
  active: boolean;
  lastAppliedDate?: string; // YYYY-MM-DD
}

export interface WorkDay {
  date: string; // YYYY-MM-DD
  worked: boolean;
  amount: number;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  logged: boolean;
  noExpenses: boolean;
}

export interface ReminderSent {
  key: string; // e.g. "reminder:2026-11-10" or "due:netflix:2026-11-13"
  sentAt: string;
}

export interface PeriodInfo {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
  daysInPeriod: number;
  daysRemaining: number;
  isTodayInPeriod: boolean;
}

export interface UpcomingItem {
  id: string;
  type: "recurring" | "installment";
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  daysUntil: number; // 0 = today, negative = overdue, positive = in N days
  categoryId: string;
  progressText?: string; // e.g. "Cuota 4/12"
  autoAdd: boolean;
  active: boolean;
}

export type DebtKind = "i_owe" | "they_owe";

export interface Debt {
  id: string;
  kind: DebtKind; // 'i_owe': debo plata | 'they_owe': me deben plata
  person: string;
  amount: number;
  dueDate?: string; // YYYY-MM-DD
  note?: string;
  settled: boolean;
  settledAt?: string;
  createdAt: string;
}
