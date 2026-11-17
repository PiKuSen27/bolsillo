import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { __resetMemoryForTests, disableEncryption, enableEncryption, store, wipeEverything } from "./store";
import { generateRecoveryCode } from "../lib/vault";

const prefs = { lockAfterMs: 5000, wipeAfter10: false, theme: "light" as const };
const mv = (i: number) => ({ id: `m${i}`, date: "2026-11-10", amount: i, kind: "expense" as const, categoryId: "x", source: "manual" as const, createdAt: "x" });
const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([p, new Promise<never>((_, bad) => setTimeout(() => bad(new Error("se colgó (deadlock)")), ms))]);

describe("C-01: candado interno con operaciones exclusivas que coinciden", () => {
  beforeEach(async () => {
    __resetMemoryForTests();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("Dos o más exclusivas a la vez con lecturas y escrituras en curso: todo termina, nada se cuelga", async () => {
    for (let round = 0; round < 20; round++) {
      const ops: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) ops.push(store.movements.put(mv(round * 100 + i)), store.movements.toArray());
      ops.push(wipeEverything(), wipeEverything()); // dos exclusivas mientras hay compartidas en vuelo
      for (let i = 10; i < 20; i++) ops.push(store.movements.put(mv(round * 100 + i)));
      ops.push(wipeEverything());
      await withTimeout(Promise.allSettled(ops));
    }
  });

  it("Activar y desactivar el cifrado con escrituras en paralelo tampoco se cuelga ni deja datos en claro", async () => {
    const ops: Promise<unknown>[] = [];
    for (let i = 0; i < 15; i++) ops.push(store.movements.put(mv(i)));
    ops.push(enableEncryption("caballo bateria grapa", generateRecoveryCode(), prefs));
    for (let i = 15; i < 30; i++) ops.push(store.movements.put(mv(i)));
    ops.push(wipeEverything());
    await withTimeout(Promise.allSettled(ops));
    await enableEncryption("caballo bateria grapa", generateRecoveryCode(), prefs);
    const more: Promise<unknown>[] = [];
    for (let i = 0; i < 10; i++) more.push(store.movements.put(mv(100 + i)));
    more.push(disableEncryption("caballo bateria grapa"));
    await withTimeout(Promise.allSettled(more));
    expect((await store.movements.toArray()).length).toBe(10);
  });
});
