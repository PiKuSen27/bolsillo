import { it, expect } from "vitest";
import { uid } from "./id";

it("uid (B-03): 10.000 ids seguidos no se repiten", () => {
  expect(new Set(Array.from({ length: 10000 }, uid)).size).toBe(10000);
});
