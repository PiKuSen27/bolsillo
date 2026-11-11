# HISTORIAL TÉCNICO Y AUDITORÍA DE BOLSILLO

> **Documento de Auditoría y Registro Histórico de Decisiones Técnicas**  
> **Proyecto**: Bolsillo (v1.2.0 PRO • Edición Especial)  
> **Autor**: PiKuSen27  
> **Fecha de Consolidación**: Noviembre 2026  

---

## 1. Registro Cronológico de Construcción

### Fase 1: Arquitectura Base y Stack Tecnológico
* **Objetivo**: Crear una aplicación de finanzas personales ultrarrápida, offline, local-first y sin servidores externos para el entorno de escritorio Linux CachyOS.
* **Decisiones Clave**:
  * Selección de **Tauri v2** frente a Electron: reducción del consumo de memoria RAM de ~300 MB a < 40 MB y tamaño de binario reducido (< 15 MB).
  * **Dexie.js (IndexedDB)**: persistencia local inmediata y síncrona en el frontend, garantizando cero latencia en cada pulsación de la calculadora.
  * **Vitest**: adopción de tests unitarios rápidos para desacoplar completamente la lógica matemática y de fechas de la interfaz gráfica.

### Fase 2: Rediseño Visual y Experiencia 540 × 600 px
* **Problema Inicial**: La ventana de widget inicial (440x440 px con transparencia) causaba problemas de renderizado en Wayland y dejaba poco espacio para el registro simultáneo de gastos.
* **Evolución**:
  * Adopción de una ventana fija de **540 px de ancho por 600 px de alto**, con esquinas redondeadas de 24 px y fondo **100% sólido** (`transparent: false`).
  * Creación del diseño de **3 Columnas de Alta Productividad**:
    1. **Columna Izquierda**: Tira de días (`Hoy` + 3 días previos + botón `+ Días` para ver los últimos 14 días con indicadores visuales de registro).
    2. **Columna Central**: Pantalla principal con tarjeta Hero del Disponible y Teclado Numérico / Calculadora integrada.
    3. **Columna Derecha**: Widget de Próximos Vencimientos, accesos directos a Gastos Fijos, Deudas y Resumen Mensual.

### Fase 3: Motor Financiero — Sueldo Fijo vs Sueldo Variable
* **Problema**: Las apps tradicionales asumen que todo el mundo cobra un sueldo mensual fijo el día 1 o 5 del mes. En la práctica argentina, muchos ingresos son por honorarios, jornadas o changas variables entre dos fechas específicas.
* **Evolución**:
  * Se implementó un esquema de ingresos **mutuamente excluyente**:
    * **Modo Fijo**: Ingreso mensual fijo con corte el día elegido de cobro.
    * **Modo Variable**: Cálculo automático por rango de fechas (`variableStartDate` hasta `variableEndDate`) multiplicado por la tarifa diaria acordada (`dailyRate`), con cálculo del monto total esperado, días trabajados y días restantes del período.

### Fase 4: Gastos Fijos, Suscripciones y Compras en Cuotas
* **Evolución**:
  * Se modelaron dos tablas en IndexedDB: `fixed` y `installments`.
  * **Suscripciones con `autoAdd`**: Se incorporó un evaluador en el arranque (`recurring.ts`) que analiza si el servicio vence en el período actual y lo incorpora a los gastos sin duplicar registros.
  * **Control de Cuotas**: Seguimiento visual ("Cuota 4/12") con indicación automática de cuotas saldadas.

### Fase 5: Módulo de Deudas ("Debo plata" / "Me deben plata")
* **Evolución**:
  * Creación de la tabla `debts` en Dexie.
  * Panel dedicado (`DebtsPanel.tsx`) con segmentación nítida:
    * Deudas que tengo que pagar (en rojo carmesí con botón "Marcar como pagada").
    * Deudas que me tienen que pagar a mí (en verde esmeralda con botón "Cobrada").
  * Historial preservado sin eliminar registros para consultas futuras.

### Fase 6: Estabilización en Wayland / Niri / iNiR
* **Problemas Encontrados en CachyOS**:
  1. *Desbordamiento a pantalla completa*: Al reabrir la app, el compositor Niri maximizaba la ventana ocupando todo el ancho.
  2. *Crash del plugin window-state*: Tauri v2 fallaba con error de deserialización si se configuraba `"window-state": {}` en `tauri.conf.json`.
  3. *Clicks bloqueados en la cabecera*: La directiva `data-tauri-drag-region` bloqueaba el registro de clicks en los botones de minimizar y cerrar.
* **Soluciones Implementadas**:
  1. Creación de una regla nativa en `~/.config/niri/config.kdl` fijando el tamaño flotante en `540 600`.
  2. En Rust (`lib.rs`), configuración estricta de `.with_state_flags(StateFlags::POSITION)` para que solo recuerde la posición y **NUNCA** altere el tamaño.
  3. Adición de `onMouseDown={(e) => e.stopPropagation()}` en todos los botones del encabezado.
  4. Comando personalizado en Rust `minimize_window` para ocultar la ventana al tray en Wayland de forma limpia.

### Fase 7: Corrección de los 6 Puntos Críticos de Usuario
1. **Ingresos manuales sumando al Disponible**: En `balance.ts` se habilitó que todo movimiento con `kind === 'income'` sume siempre a la plata total y al disponible, considerando los movimientos de los últimos 14 días.
2. **Categoría exclusiva "Ingreso de plata"**: Se desacoplaron los ingresos de las categorías de gastos. Al pulsar `+ Ingreso`, se asigna de forma forzada `categoryId: 'income'` ("Ingreso de plata", `#16A34A`), y se ejecutó una migración retroactiva en Dexie.
3. **Hero transparente**: Se añadió el desglose explícito: `Plata total: $ X · Gastos: $ Y`.
4. **Edición libre de fechas variables**: Se incorporaron selectores de fecha nativos en `IncomePanel.tsx` para cambiar el rango sin reiniciar la configuración.
5. **Agrupación en acordeón colapsable**: En `MovementsPanel.tsx` y `DayDetailModal.tsx` los gastos e ingresos se agruparon por categoría con subtotales y conteo.
6. **Ampliación de la tira de días**: Se incluyó el modal "+ Días" para revisar y cargar registros en cualquiera de los últimos 14 días.

### Fase 8: Auditoría Extrema (QA) y Adaptación Móvil / PWA
* **Blindaje de la Calculadora**: Sanitización de operadores colgantes (ej. `20000 +` -> `20000`) y tope de 12 dígitos.
* **Validación de Fechas**: Intercambio automático si `fin < inicio` para erradicar números negativos espurios.
* **Scrolls y Estilos**: Limpieza total de barras de scroll (`scrollbar-none`) y verificación de contrastes en temas Blanco y Negro.
* **UX Pro**: Toast flotante con botón "Deshacer" (4 segundos) tras anotar cualquier gasto o ingreso, y barra multicolor horizontal de gastos.
* **Modo Celular y PWA**: Soporte responsive para `< 480px`, simulador interactivo de iPhone en escritorio (`📱`) y configuración de `vite-plugin-pwa` para uso offline sin servidor.

---

## 2. Matriz Exhaustiva de Bugs y Soluciones Técnicas

| ID | Síntoma / Bug | Causa Raíz | Archivo Modificado | Solución Aplicada |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | `+ Ingreso` manual no sumaba al Disponible en la pantalla principal. | En modo variable, el cálculo ignoraba los movimientos de ingreso o filtraba únicamente el rango estricto sin mirar los días de la tira. | `src/lib/balance.ts` | Se sumaron todos los movimientos con `kind === 'income'` al ingreso total y se amplió la ventana a los últimos 14 días. |
| **BUG-02** | Un ingreso de `$ 500.000` se guardó bajo la categoría "Comida". | La calculadora aplicaba la categoría de gasto activa al momento de guardar un ingreso. | `src/components/Calculator.tsx`, `src/App.tsx` | Al guardar ingreso (`kind === 'income'`), se asigna automáticamente `categoryId: 'income'` ("Ingreso de plata" en verde esmeralda). Migración en DB en el arranque. |
| **BUG-03** | Error en el arranque: `PluginInitialization("window-state", "invalid type: map, expected unit")`. | `tauri.conf.json` incluía `"window-state": {}`, incompatible con la deserialización de unit struct en Tauri v2. | `src-tauri/tauri.conf.json` | Se eliminó el objeto vacío del JSON y se configuró directamente en Rust vía builder. |
| **BUG-04** | Ventana se abría a pantalla completa al desminimizar en Niri (Wayland). | `tauri-plugin-window-state` intentaba restaurar `StateFlags::all()`, incluyendo el tamaño gestionado por el compositor. | `src-tauri/src/lib.rs` | Se limitó la persistencia a `.with_state_flags(StateFlags::POSITION)` y se añadió regla en `config.kdl`. |
| **BUG-05** | No se podía hacer click en `–` ni `×` en la cabecera. | La directiva `data-tauri-drag-region` capturaba los eventos del puntero antes que el botón. | `src/App.tsx` | Se agregó `onMouseDown={(e) => e.stopPropagation()}` a todos los botones del header. |
| **BUG-06** | Expresión incompleta `20000 +` generaba `NaN` o fallaba al guardar. | El parser de la calculadora intentaba evaluar la expresión con un operador binario al final sin segundo operando. | `src/lib/calc.ts` | Regex `/[\+\-\*\/]+$/` para recortar cualquier operador final suelto antes de evaluar. |
| **BUG-07** | Fechas invertidas en Sueldo Variable generaban `-5 días` y saldo erróneo. | No existía validación que asegurase que la fecha de fin sea posterior a la de inicio. | `src/lib/period.ts`, `src/panels/IncomePanel.tsx` | Se implementó ordenamiento automático `min(d1, d2)` y `max(d1, d2)` en el motor de cálculo y validación en la UI. |
| **BUG-08** | Error de compilación en Vite: `Failed to resolve import "workbox-window"`. | El plugin de PWA requería `workbox-window` en modo inyección manual sin estar instalada la dependencia. | `vite.config.ts`, `src/main.tsx` | Se configuró `injectRegister: "auto"` en el plugin de VitePWA, delegando el registro del Service Worker a Vite. |

---

## 3. Detalle de la Suite de Tests Unitarios (32 Tests en Vitest)

Todos los tests corren en Node sin interfaz gráfica mediante `pnpm test`:

### A. `src/lib/calc.test.ts` (8 tests)
1. Resuelve operaciones básicas de suma (`1000 + 500 = 1500`).
2. Resuelve multiplicaciones (`3500 * 4 = 14000`).
3. Respeta la precedencia de operadores matemáticos (`1000 + 500 * 2 = 2000`).
4. Ignora operadores finales sueltos al evaluar (`20000 +` -> `20000`).
5. Maneja números decimales correctamente si se ingresan.
6. Limita la longitud máxima de dígitos para evitar desbordes en el display.
7. Retorna `0` en expresiones vacías o no válidas sin lanzar excepciones.
8. Soporta secuencias complejas con múltiples sumas y restas sucesivas.

### B. `src/lib/balance.test.ts` (4 tests)
1. Calcula correctamente el disponible en modo Sueldo Fijo (`sueldo - gastos`).
2. Calcula correctamente el disponible en modo Sueldo Variable (`días × dailyRate + ingresos - gastos`).
3. Asegura que los `+ Ingreso` manuales sumen siempre al disponible independientemente del modo.
4. Calcula el ritmo de gasto diario sugerido (`disponible / días restantes`).

### C. `src/lib/period.test.ts` (7 tests)
1. Determina el rango de fechas para cobro a principio de mes (día 1 al último día).
2. Determina el rango de fechas para cobro a mitad de mes (ej. día 10 de un mes al 9 del siguiente).
3. Maneja correctamente meses con distinta cantidad de días (28, 30 y 31 días) y años bisiestos.
4. Calcula con precisión los días del rango en modo Variable.
5. Invierte y corrige automáticamente fechas desordenadas (`fin < inicio`).
6. Identifica si la fecha actual está dentro o fuera del período activo.
7. Calcula con exactitud los días restantes hasta la finalización del ciclo.

### D. `src/lib/recurring.test.ts` (4 tests)
1. Identifica servicios recurrentes fijos que vencen dentro del período actual.
2. Aplica gastos fijos con `autoAdd` sin duplicar transacciones existentes.
3. Progresa las cuotas de compras activas ("Cuota 4/12" -> "Cuota 5/12").
4. Marca como finalizadas las compras en cuotas cuando se alcanza la cuota total.

### E. `src/lib/reminders.test.ts` (6 tests)
1. Detecta días pasados en la tira sin transacciones anotadas.
2. Identifica vencimientos de gastos fijos para el día de hoy.
3. Identifica vencimientos próximos en los siguientes 3 días (alerta ámbar).
4. No genera falsas alarmas para días marcados explícitamente con "Hoy no gasté nada".
5. Valida el formato de hora de recordatorios diarios (ej. `21:00`).
6. Maneja correctamente el cambio de mes en el cálculo de alertas de vencimiento.

### F. `src/lib/format.test.ts` (3 tests)
1. Formatea montos en pesos argentinos con puntos de miles (`$ 20.000` y `$ 1.500.000`).
2. Formatea saldos negativos con el signo menos antes del símbolo (`-$ 5.000`).
3. Formatea fechas en español rioplatense (ej. `"Hoy"`, `"Ayer"`, `"Vie 08 Nov"`).

---

## 4. Estado de Salud del Proyecto

* **Tests**: 32 pasados de 32 (100% de éxito).
* **Compilación Rust**: `tauri-build` limpio, sin warnings críticos.
* **Empaquetado**: Binario nativo de Linux operativo en `~/.local/bin/bolsillo`.
* **Rendimiento**: Arranque en frío < 200 ms, uso de RAM < 40 MB.
