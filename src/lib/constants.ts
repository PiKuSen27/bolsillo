import { Category, Settings } from "../types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "comida", name: "Comida", icon: "Utensils", color: "#F97316" }, // Naranja
  { id: "transporte", name: "Transporte", icon: "Car", color: "#3B82F6" }, // Azul
  { id: "super", name: "Súper", icon: "ShoppingCart", color: "#10B981" }, // Verde esmeralda
  { id: "suscripciones", name: "Suscripciones", icon: "Tv", color: "#8B5CF6" }, // Violeta
  { id: "servicios", name: "Servicios", icon: "Zap", color: "#D97706" }, // Ámbar
  { id: "salud", name: "Salud", icon: "HeartPulse", color: "#06B6D4" }, // Celeste
  { id: "ocio", name: "Ocio", icon: "Gamepad2", color: "#EC4899" }, // Rosa
  { id: "otros", name: "Otros", icon: "MoreHorizontal", color: "#6B7280" }, // Pizarra
];

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  currency: "ARS",
  incomeMode: "salary",
  fixedSalary: 700000,
  payday: 1,
  dailyRate: 25000,
  reminderTime: "21:00",
  reminderEnabled: true,
  dueAlertDays: 3,
  theme: "dark",
  categories: DEFAULT_CATEGORIES,
  onboardingDone: false,
  closeToTray: true,
  autostart: false,
  createdAt: new Date().toISOString(),
};
