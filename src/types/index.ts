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

/** Automático = según el monitor; chico 1,0 · mediano 1,25 · grande 1,5 */
export type WindowZoom = "auto" | "small" | "medium" | "large";
export const WINDOW_ZOOM_VALUES: Record<Exclude<WindowZoom, "auto">, number> = { small: 1.0, medium: 1.25, large: 1.5 };

export interface DailyRateChange {
  fromDate: string; // YYYY-MM-DD (inclusive)
  rate: number;
}

export interface Settings {
  id: string; // 'main'
  currency: "ARS";
  incomeMode: IncomeMode; // 'salary' | 'daily' (excluyente)
  fixedSalary: number; // e.g. 700000
  payday: number; // 1 - 31
  dailyRate: number; // tarifa base por día, e.g. 40000
  dailyRateChanges?: DailyRateChange[]; // "cambiar tarifa desde X en adelante"
  dailyRangeStart?: string; // YYYY-MM-DD
  dailyRangeEnd?: string; // YYYY-MM-DD
  dailyPreviousRange?: { startDate: string; endDate: string }; // rango anterior, para el cartel "Empezaste con…"
  reminderTime: string; // "21:00"
  reminderEnabled: boolean;
  dueAlertDays: number; // e.g. 3
  theme: "dark" | "light";
  categories: Category[];
  onboardingDone: boolean;
  closeToTray: boolean;
  autostart: boolean;
  windowZoom: WindowZoom; // Tamaño de ventana (solo escritorio)
  hideAmounts: boolean; // el ojo de "Disponible": montos tapados con $ ••••••
  startHidden: boolean; // "Abrir siempre con los montos ocultos"
  tutorialDone: boolean; // ya vio (o salteó) el recorrido de después de la bienvenida
  lastSeenVersion?: string; // última versión cuyas novedades ya vio
  lastBackupAt?: string; // ISO: última vez que se exportó un backup (para el recordatorio)
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

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  dueDay: number; // 1-31, siempre mensual
  autoAdd: boolean;
  active: boolean;
  lastAppliedDate?: string; // YYYY-MM-DD
  createdAt?: string; // YYYY-MM-DD: no se cobran vencimientos anteriores a este día
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

/** Día tocado a mano en modo variable. Si no hay registro, el día vale la tarifa (o $0 si es domingo). */
export interface WorkDay {
  date: string; // YYYY-MM-DD
  worked: boolean; // false = "Día libre"
  amount: number; // monto propio de ese día (0 si libre)
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
