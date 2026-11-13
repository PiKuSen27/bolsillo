# Historial técnico y auditoría de Bolsillo

> **Proyecto**: Bolsillo v1.3.0 · **Autor**: PiKuSen27 · **Última revisión**: 11 de noviembre de 2026.
> Este documento cuenta cómo se construyó la app, qué bugs se encontraron y qué prueba cada test. Solo contiene cosas verificadas en el código.

---

## 1. Cronología

### Fase 1 — Base (noviembre 2026)
Tauri 2 + React 19 + TypeScript + Tailwind 4 + Dexie (IndexedDB) + Vitest. Objetivo: app de finanzas personales offline, sin servidor, para CachyOS/Niri.

### Fase 2 — Ventana 540 × 600
Se descartó un widget inicial de 440×440 translúcido (artefactos en Wayland) por una ventana fija de 540×600, sólida, con tres columnas: tira de días, calculadora y próximos vencimientos/deudas, y el Hero del Disponible arriba.

### Fase 3 — Sueldo fijo vs variable
Modos excluyentes: sueldo mensual con día de cobro, o tarifa diaria por rango de fechas.

### Fase 4 — Fijos y cuotas
Tablas `recurrings` e `installments`, aplicación automática sin duplicados (`recurring.ts`), próximos vencimientos.

### Fase 5 — Deudas
Tabla `debts`, panel "Debo plata" / "Me deben plata".

### Fase 6 — Wayland / Niri
Problemas y soluciones: `window-state: {}` en `tauri.conf.json` rompía el arranque (se configura en Rust); `StateFlags::SIZE` abría a pantalla completa (solo `POSITION`); el arrastre del header tapaba los botones (`stopPropagation`); regla de ventana en `config.kdl`.

### Fase 7 — Auditoría externa (10–11 de noviembre de 2026)
Revisión completa con Claude: seguridad del sistema, código, tests y documentación. Resultado en la sección 2.

### Fase 8 — v1.3.0 (11 de noviembre de 2026)
- Sueldo por día rehecho: lunes a sábado a la tarifa, domingos libres, edición por día, cambio de tarifa desde una fecha (`workdays.ts`, `WorkDaysPanel`).
- Cartel del período anterior en el Hero (`carryover.ts`).
- Buscador de movimientos y panel acotado al período (`search.ts`).
- Logo nuevo (bolsillo de jean con moneda), íconos de escritorio, tray, PWA y favicon regenerados.
- Ajustes: créditos nuevos, versión real inyectada desde `package.json`, sin guía de celular/Windows.
- Pulido visual: resortes unificados, asa en los sheets, foco visible, "reducir movimiento".
- Backup con validación completa y confirmación.
- CSP estricta, permisos y paquetes sin uso eliminados.
- Fijos creados tarde, cerrar-al-tray real, recordatorio que no se pierde, fechas locales, redondeo de cuotas.

---

## 2. Bugs encontrados en la auditoría y cómo se arreglaron

| ID | Problema | Causa | Arreglo |
| :--- | :--- | :--- | :--- |
| **A-01** | `.git`, `target/`, `dist/` y `node_modules/` con permisos 777 (cualquier usuario de la máquina podía modificarlos). | La herramienta anterior creó los archivos sin respetar el `umask`. | `chmod -R go-w` en el proyecto, en VECTARIS y en `~/.cargo/.crates*`. |
| **B-01** | Los gastos del período anterior se restaban del sueldo nuevo. | "Ventana de 14 días" en `balance.ts` que miraba antes de `periodStart`. | Solo cuentan movimientos del período (tests `Bug #1`). Regla D del CLAUDE.md. |
| **B-02** | Con el rango variable vencido, los gastos nuevos no bajaban el Disponible. | Filtro cortaba en `periodEnd`. | La ventana se estira hasta hoy (test `Bug #2`). |
| **B-03** | Fijos y cuotas quedaban siempre en la primera categoría. | `useState` sin setter y sin selector. | Selector de categoría en ambos formularios. |
| **B-04** | Con un panel abierto, `Enter` guardaba un gasto. | Listener global de teclado sin condición. | `keyboard.ts` + `role="dialog"` en todos los overlays. |
| **B-05** | Montos sin tope (`999999999999 × 999999999999`). | Sin límite en `calc.ts` ni en los formularios. | `MAX_AMOUNT = 1e12` en calculadora, formularios y backup, con aviso en pantalla. |
| **B-06** | Un fijo creado después de su vencimiento se cobraba en el acto. | No se guardaba cuándo se creó. | `Recurring.createdAt`; arranca el mes siguiente. |
| **B-07** | "Cerrar al tray" no hacía nada. | Rust siempre escondía la ventana. | Comando `set_close_to_tray` y estado compartido en Rust. |
| **B-08** | El recordatorio diario solo saltaba si el chequeo caía en el minuto exacto. | `currentHHMM === reminderTime`. | `>=` + "ya enviado hoy". |
| **B-09** | La primera cuota usaba fecha UTC (después de las 21 h era "mañana"). | `toISOString()`. | `formatLocalDate(new Date())`. |
| **B-10** | Pasada la medianoche el día seleccionado seguía en ayer. | No se actualizaba al cambiar `todayStr`. | Se mueve junto con "hoy". |
| **B-11** | El panel "Movimientos del Período" mostraba todo el historial. | Sin filtro. | Solo el período; con búsqueda, todo el historial. |
| **B-12** | `IncomePanel` y `UpcomingWidget` eran código muerto. | Nada los abría. | Borrados (`WorkDaysPanel` los reemplaza). |
| **B-13** | Deshacer dejaba el día como "anotado"; cuotas que no sumaban el total; ícono de notificación inexistente. | Detalles. | Arreglados (`getInstallmentAmount`, `/icons/icon-192.png`). |
| **B-14** | `frequency: weekly/yearly` existía en el tipo pero se ignoraba. | Nunca se implementó. | Campo eliminado; los fijos son mensuales. |
| **S-01** | Sin CSP; permisos `opener`, `window-state` y `allow-show` sin uso; paquetes npm sin uso. | Configuración por defecto. | CSP estricta probada; permisos y paquetes podados. |
| **S-02** | El import de backup metía cualquier JSON en la base. | Solo chequeaba dos campos. | `validateBackup` + confirmación + todo-o-nada. |
| **C-01** | El workflow de Windows no generaba `.exe`. | Bundles `deb/rpm` y sin permiso de release. | `--bundles nsis` y `permissions: contents: write` (no probado: requiere GitHub). |
| **D-01** | Documentación con datos falsos (versiones, tablas, "Dexie síncrona", 440×440, KDE, tests mal descritos). | Desactualizada. | Reescrita en v1.3.0. |

---

## 3. Tests (101, en `src/lib/*.test.ts` y `src/db/*.test.ts`, `pnpm test`)

| Archivo | Qué prueba |
| :--- | :--- |
| `calc.test.ts` (10) | Suma, resta, multiplicación, división, precedencia, puntos de miles, operadores colgantes, coma decimal, negativos, división por cero, expresión inválida, tope `MAX_AMOUNT`. |
| `balance.test.ts` (6) | Sueldo fijo − gastos; modo variable con `variableIncome` e ingresos del rango (los de fuera no cuentan); variable sin rango = 0; **Bug #1** (período anterior no resta); **Bug #2** (rango vencido); saldo negativo y `dailySuggested = 0`. |
| `period.test.ts` (8) | Período 1→fin de mes, cobro el 15, rango variable, fechas invertidas, día 31 en febrero (bisiesto y no), diciembre→enero, `isTodayInPeriod` y `daysRemaining ≥ 1`. |
| `workdays.test.ts` (10) | Tarifa L–S, domingo libre, suma del rango, monto propio, día libre, domingo trabajado, naranja solo si difiere, cambio de tarifa desde fecha, varios cambios, lista de días, sin rango. |
| `carryover.test.ts` (6) | Período anterior en modo fijo (a favor y abajo), sin movimientos → null, app nueva → null, modo variable con rango anterior, sin rango anterior → null. |
| `recurring.test.ts` (10) | Fijo se cobra una vez; meses atrasados con fecha real (1 y 3 meses); cuotas avanzan y terminan; próximos ordenados; **fijo creado tarde**; fijo creado el día que vence; redondeo de la última cuota; `getNextMonthlyDueDate` (dic→ene, día 31); cuotas del 31 en meses cortos. |
| `reminders.test.ts` (7) | "Hoy no gasté nada", movimientos manuales, días faltantes, banner, recordatorio a la hora (no si anotó, no repite), **recordatorio tardío**, alertas N días antes y el mismo día. |
| `search.test.ts` (6) | Solo período sin búsqueda; por nota, categoría (acentos), monto con/sin puntos; orden; `normalizeText`. |
| `backup.test.ts` (10) | Backup válido; JSON roto/versión desconocida; movimientos inválidos (fecha, negativo, tope, decimal, kind, source); ids repetidos; campos desconocidos y defaults; settings (tema, modo, día, hora, tarifa, cambios); fijos/cuotas/días/deudas; versión 1 sin deudas; archivo > 10 MB; resumen. |
| `keyboard.test.ts` (3) | Bloqueo con diálogo abierto, con foco en campos, y caso normal. |
| `format.test.ts` (6) | Moneda, negativos, texto relativo de vencimiento, inicial del día, `formatAmountInput`, zona horaria. |

**Lo que no tiene test automático** (es interfaz o depende de Dexie/Tauri): paneles de React, `repo.ts`, migraciones de Dexie, comandos de Rust, service worker.

---

## 4. Estado verificado al 11/11/2026

- `pnpm test`: 101 de 101 (al 12/11/2026). `tsc --noEmit`: sin errores. `cargo check --release`: sin warnings del proyecto.
- Binario de producción: 7,6 MB, instalado en `~/.local/bin/bolsillo`, abierto y verificado con captura de pantalla sobre los datos reales (migración Dexie v3 aplicada sin pérdida).
- PWA: 42 archivos de `dist/` precacheados por el service worker, manifest y registro servidos correctamente, fallback a `index.html`. Probado en localhost; no se probó sin conexión en un celular real.
- CSP probada sobre el build web con Firefox sin interfaz: renderiza igual que sin CSP.
- No medido: consumo de RAM y tiempo de arranque.
