import { describe, it, expect } from "vitest";
import { whatsNewToShow } from "./whatsNew";

const log = [
  { version: "1.4.0", items: ["Nuevo A", "Nuevo B"] },
  { version: "1.3.2", items: ["Viejo"] },
];

describe("whatsNew.ts - Cartel de novedades", () => {
  it("Después de actualizar muestra las novedades de la versión nueva una sola vez", () => {
    expect(whatsNewToShow({ lastSeenVersion: "1.3.2", onboardingDone: true }, "1.4.0", log)).toEqual(log[0]);
    expect(whatsNewToShow({ lastSeenVersion: "1.4.0", onboardingDone: true }, "1.4.0", log)).toBeNull();
  });
  it("Quien venía de antes de que existiera el cartel también lo ve", () => {
    expect(whatsNewToShow({ onboardingDone: true }, "1.4.0", log)).toEqual(log[0]);
  });
  it("Un usuario nuevo (todavía en la bienvenida) no lo ve", () => {
    expect(whatsNewToShow({ onboardingDone: false }, "1.4.0", log)).toBeNull();
  });
  it("Si la versión no tiene novedades escritas, no muestra nada", () => {
    expect(whatsNewToShow({ lastSeenVersion: "1.3.2", onboardingDone: true }, "9.9.9", log)).toBeNull();
  });
});
