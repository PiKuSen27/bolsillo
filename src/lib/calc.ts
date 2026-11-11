import { MAX_AMOUNT } from "./constants";

/**
 * Pure calculator evaluator for expressions like "3500 * 4", "20.000 + 5.000", "3.500 × 4", "20000 +"
 */

export function sanitizeCalcExpression(expr: string): string {
  return expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\./g, "") // Strip thousand separator dots (e.g. 20.000 -> 20000)
    .replace(/,/g, ".") // Comma is decimal
    .replace(/\s+/g, "");
}

export function evaluateCalcExpression(rawExpr: string): number {
  let sanitized = sanitizeCalcExpression(rawExpr);
  if (!sanitized) return 0;

  // Validate characters: only digits, decimal point, +, -, *, /
  if (!/^[-+*/.\d]+$/.test(sanitized)) {
    throw new Error("Expresión inválida");
  }

  // Tokenize
  const tokens: (number | string)[] = [];
  let currentNum = "";

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];

    if ("+-*/".includes(char)) {
      // Check for unary minus at beginning or right after another operator
      if (char === "-" && (i === 0 || "+-*/".includes(sanitized[i - 1]))) {
        currentNum += char;
        continue;
      }
      if (currentNum !== "") {
        tokens.push(parseFloat(currentNum));
        currentNum = "";
      }
      tokens.push(char);
    } else {
      currentNum += char;
    }
  }

  if (currentNum !== "") {
    tokens.push(parseFloat(currentNum));
  }

  // Strip all trailing operators so expressions like "20000 +" or "20000 + -" safely evaluate to 20000
  while (tokens.length > 0 && typeof tokens[tokens.length - 1] === "string") {
    tokens.pop();
  }

  if (tokens.length === 0) return 0;

  // Pass 1: Multiplication and Division
  const pass1: (number | string)[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === "*" || token === "/") {
      const prev = pass1.pop();
      const next = tokens[i + 1];
      if (typeof prev !== "number" || typeof next !== "number") {
        throw new Error("Sintaxis inválida");
      }
      if (token === "/" && next === 0) {
        throw new Error("División por cero");
      }
      const res = token === "*" ? prev * next : prev / next;
      pass1.push(res);
      i += 2;
    } else {
      pass1.push(token);
      i++;
    }
  }

  // Pass 2: Addition and Subtraction
  let result = pass1[0];
  if (typeof result !== "number") throw new Error("Expresión inválida");

  let j = 1;
  while (j < pass1.length) {
    const op = pass1[j];
    const next = pass1[j + 1];
    if (typeof next !== "number") break;

    if (op === "+") {
      result += next;
    } else if (op === "-") {
      result -= next;
    }
    j += 2;
  }

  if (isNaN(result) || !isFinite(result)) {
    throw new Error("Resultado no numérico");
  }

  if (Math.abs(result) > MAX_AMOUNT) {
    throw new Error("Monto demasiado grande");
  }

  // Return integer as per business requirements (amounts are whole pesos)
  return Math.round(result);
}
