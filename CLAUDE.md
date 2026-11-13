# CLAUDE.md — Guía técnica de Bolsillo

> **El usuario es principiante. Explicá todo en palabras simples, sin dar por sabido ningún término técnico, y decí qué hace cada comando antes de correrlo.**

> **Bolsillo v1.3.1** (la versión real vive en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`; los tres tienen que coincidir).
> **Autor y dueño**: PiKuSen27.
> **Moneda**: pesos argentinos, números enteros sin centavos, con punto de miles (`$ 20.000`). Toda la interfaz en español rioplatense.

---

## 1. Entorno del usuario

* **Sistema operativo**: CachyOS (Arch Linux).
* **Escritorio**: compositor Wayland **Niri** con la barra **iNiR**. **No usa KDE ni GNOME.**
* **Shell**: Fish (`/usr/bin/fish`). Para variables de entorno se usa `set -gx VAR valor`, no `export`.
* **Binario instalado**: `~/.local/bin/bolsillo` (está en el `PATH`).
* **Lanzador**: `~/.local/share/applications/bolsillo.desktop` (apunta al binario y al ícono `public/icons/icon-512.png` del proyecto).
* **Datos de la app** (IndexedDB de WebKit): `~/.local/share/com.bolsillo.desktop/`. Antes de instalar un binario nuevo, copiar esa carpeta.
* **Regla de ventana en Niri** (`~/.config/niri/config.kdl`, tal cual está instalada):
  ```kdl
  window-rule {
      match app-id=r#"(?i)bolsillo"#
      match title=r#"(?i)bolsillo"#
      open-floating true
      default-column-width { fixed 810; }
      default-window-height { fixed 900; }
      focus-ring { off }
      border { off }
      shadow { off }
  }
  ```

---

## 2. Stack (versiones de `package.json` / `Cargo.toml`)

| Capa | Tecnología | Para qué |
| :--- | :--- | :--- |
| Escritorio | **Tauri 2** (Rust 2021) con plugins `notification`, `window-state`, `single-instance` | Ventana nativa sobre WebKitGTK/Wayland, tray, notificaciones |
| UI | **React 19** + **TypeScript 6** (strict) | Interfaz |
| Estilos | **Tailwind CSS 4** (`@tailwindcss/vite`) | Clases utilitarias |
| Animaciones | **Motion 14** (`motion/react`) | Sheets, toasts, números animados |
| Datos | **Dexie 4** (IndexedDB) | Todo se guarda local, sin servidor. Es **asíncrona** (todo con `await`) |
| Fechas | **date-fns 4** | Períodos, meses cortos, formato en español |
| PWA | **vite-plugin-pwa 2** (Workbox) | Instalable y offline en celular |
| Íconos | **lucide-react** | Iconos de la UI |
| Tests | **Vitest 5** | 101 tests (lógica pura + backup y saldado de deudas sobre IndexedDB simulada con `fake-indexeddb`) |
| Build | **Vite 8**, pnpm | |

---

## 3. Mapa de archivos

```
Bolsillo/
├── src/
│   ├── App.tsx                 # Raíz: carga datos, calcula período/balance, layout PC y celular, sheets
│   ├── main.tsx                # Arranque de React + MotionConfig (respeta "reducir movimiento")
│   ├── index.css               # Tailwind, fuente Plus Jakarta Sans, foco visible, zona segura, scrollbars
│   ├── components/
│   │   ├── AnimatedNumber.tsx      # Monto que "cuenta" hasta el valor (sin animar si el sistema lo pide)
│   │   ├── BannerMissingDays.tsx   # Aviso "Te falta anotar…"
│   │   ├── Calculator.tsx          # Teclado, display, chips de categorías (HScroll), nota, fecha (DateField); tope de monto
│   │   ├── DateField.tsx           # Selector de fecha propio (calendario con el estilo del tema)
│   │   ├── DayDetailModal.tsx      # Detalle de un día por categoría, con editar y borrar movimientos
│   │   ├── DayStrip.tsx            # Columna izquierda PC: Hoy + 3 días + "+ Días" (14 días)
│   │   ├── Hero.tsx                # Disponible, Plata total · Gastos, cartel del período anterior, "Días trabajados" (sin efecto al tocar)
│   │   ├── HScroll.tsx             # Fila de chips con rueda del mouse, arrastre y degradado en el borde
│   │   ├── Popover.tsx             # Base de los desplegables propios (Select y DateField)
│   │   ├── MobileDayStrip.tsx      # Tira de días para celular
│   │   ├── RightColumnWidget.tsx   # Próximos vencimientos y deudas (columna derecha PC)
│   │   ├── Select.tsx              # Desplegable propio (reemplaza al <select> nativo)
│   │   └── Sheet.tsx               # Panel deslizante con asa (role="dialog")
│   ├── panels/
│   │   ├── CalendarPanel.tsx       # Calendario mensual
│   │   ├── DebtsPanel.tsx          # "Debo plata" / "Me deben plata"
│   │   ├── FixedAndInstallmentsPanel.tsx # Fijos (mensuales) y cuotas, con categoría
│   │   ├── MovementsPanel.tsx      # Movimientos del período + buscador en todo el historial
│   │   ├── OnboardingPanel.tsx     # Primer uso
│   │   ├── SettingsPanel.tsx       # Tema, ingresos, recordatorios, categorías, backup, créditos
│   │   └── WorkDaysPanel.tsx       # Modo variable: días del rango, montos, días libres, cambio de tarifa
│   ├── lib/                    # Lógica pura, cada archivo tiene su .test.ts (salary-flow.test.ts: sueldo fijo de punta a punta)
│   │   ├── balance.ts              # Disponible = ingreso base + ingresos del período − gastos del período
│   │   ├── backup.ts               # Validación completa del JSON de respaldo
│   │   ├── calc.ts                 # Evaluador de la calculadora (sin eval), tope MAX_AMOUNT
│   │   ├── carryover.ts            # Saldo con el que cerró el período anterior (informativo)
│   │   ├── constants.ts            # Categorías, DEFAULT_SETTINGS, MAX_AMOUNT (1e12), APP_VERSION
│   │   ├── format.ts               # $ 20.000, fechas locales sin corrimiento de zona horaria
│   │   ├── keyboard.ts             # Cuándo la calculadora debe ignorar el teclado
│   │   ├── period.ts               # Período por día de cobro / rango variable
│   │   ├── recurring.ts            # Fijos y cuotas automáticos, próximos vencimientos
│   │   ├── reminders.ts            # Días sin anotar, recordatorio diario, alertas de vencimiento
│   │   ├── search.ts               # Buscador de movimientos
│   │   └── workdays.ts             # Modo variable: tarifa por fecha, valor de cada día, suma del rango
│   ├── db/
│   │   ├── db.ts                   # Esquema Dexie (versiones 1→5) y tablas
│   │   ├── repo.ts                 # Ajustes, días, deudas, exportar/importar
│   │   └── backup-roundtrip.test.ts # Exportar → base vacía → importar = idéntica; archivo roto no toca nada
│   ├── platform/index.ts       # isTauri(), ventana, tray, notificaciones, cerrar-al-tray
│   └── types/index.ts          # Tipos de datos
├── src-tauri/
│   ├── src/lib.rs              # Plugins, tray, comandos: minimize_window, set_autostart, set_close_to_tray
│   ├── capabilities/default.json # Permisos (solo los que el frontend usa)
│   ├── tauri.conf.json         # Ventana 810×900 fija (interfaz a 540×600 con zoom 1,5), CSP, íconos
│   └── icons/                  # Generados con `pnpm tauri icon` desde public/icons/bolsillo.svg
├── public/icons/               # bolsillo.svg (logo fuente), PWA, favicon, apple-touch-icon
├── public/_headers             # Cabeceras (CSP) para Cloudflare Pages; Tauri lo ignora
├── .github/workflows/build-windows.yml # Compila el .exe en GitHub (no corre acá)
├── CLAUDE.md · README.md · HISTORIAL_AUDITORIA.md
└── package.json · vite.config.ts · vitest.config.ts · tsconfig*.json
```

**Tablas de Dexie** (`BolsilloDB`, versión 5): `settings`, `movements`, `recurrings`, `installments`, `workDays`, `dayLogs`, `remindersSent`, `debts`. Cualquier cambio de esquema va con una `this.version(n)` nueva en `db.ts`.

---

## 4. Reglas de negocio (PROHIBIDO ROMPER)

### A. Ventana de escritorio (810 × 900 px)
1. **La interfaz está diseñada a 540 × 600 px lógicos** y la ventana es `540×zoom` por `600×zoom`, no redimensionable (`resizable: false`, `maximizable: false`, `transparent: false`, `decorations: false`). El zoom lo aplica `apply_zoom` en `lib.rs` (webview `set_zoom` + `set_min_size`/`set_max_size`/`set_size` + `center`):
   * **Automático** (por defecto): el mayor entre 1,0 y 1,5 con el que la ventana ocupa como máximo el 85 % del alto y del ancho del monitor (`auto_zoom`). En 2560×1440 da 1,5 (810 × 900); en 1366×768 da 1,08. Si no se puede leer el monitor, 1,0.
   * Ajustes → "Tamaño de ventana": Automático / Chico (1,0) / Mediano (1,25) / Grande (1,5) (`settings.windowZoom`, comando `set_window_zoom`). El frontend lo reaplica al cargar.
   * `tauri.conf.json` trae 810 × 900 solo como tamaño inicial; en la PC del dueño la regla de Niri también fija 810 × 900, en otras máquinas no hace falta ninguna regla.
2. `tauri.conf.json` **no** debe tener `plugins.window-state` (rompe el arranque). En Rust se usa solo `StateFlags::POSITION`; **nunca** `SIZE` (en Niri abría a pantalla completa).
3. El header tiene `data-tauri-drag-region`. **Todos los botones del header** (pin, –, ×) llevan `onMouseDown={(e) => e.stopPropagation()}` para que el arrastre no se coma el click.
4. `–` llama al comando `minimize_window` (minimiza y esconde). El tray (click izquierdo o "Abrir Bolsillo") y volver a ejecutar el binario (`single-instance`) hacen `show()` + `set_focus()`.
5. `×` respeta el ajuste **"Cerrar al tray"** (`set_close_to_tray` → estado en Rust): encendido esconde la ventana y siguen los recordatorios; apagado cierra la app. **Antes de esconder, Rust consulta por D-Bus (`zbus`) si hay una bandeja registrada** (`org.kde.StatusNotifierWatcher` → `IsStatusNotifierHostRegistered`); si no la hay, cierra de verdad para no dejar una app fantasma, y Ajustes muestra un aviso (`tray_host_available`). Si el ícono no se ve en la barra, volver a ejecutar el binario muestra la ventana (`single-instance`).
6. **No usar `<select>` ni `<input type="date">` nativos**: en WebKitGTK salen con el tema del sistema (negro sobre el tema Blanco). Usar `Select` y `DateField` de `src/components/`.
7. **Sin `whileHover`/`whileTap` con escala en tarjetas grandes** (Hero): en WebKitGTK el transform deja el texto borroso.

### B. Temas y colores
1. Solo dos temas: **Blanco** (`#FFFFFF`, tarjetas `#F4F4F5`) y **Negro** (`#000000`, tarjetas `#0A0A0C`/`#0D0D0E`). El manifest de la PWA usa `#000000`.
2. Sin colores neón. Verde `#16A34A`/`#22C55E` para ingresos, rojo `#DC2626`/`#EF4444` para gastos, ámbar `#D97706` solo para "monto distinto a la tarifa" y barras de avance.
3. Bordes de 1 px, tipografía gruesa (`font-bold`/`font-extrabold`), radios 16 px en tarjetas.
4. Se respeta "reducir movimiento" del sistema (`MotionConfig reducedMotion="user"` + media query en `index.css`).

### C. Modos de ingreso (excluyentes)
1. **Sueldo Fijo** (lo usan los padres del dueño, no tocar su comportamiento):
   * `fixedSalary` y día de cobro `payday` (1 a 31).
   * El período va desde el último día de cobro hasta el día anterior al próximo (`calculatePeriod`). Si el mes no tiene ese día, se usa el último día del mes.
2. **Sueldo Variable por día** (`incomeMode: "daily"`, lógica en `src/lib/workdays.ts`, UI en `WorkDaysPanel.tsx`):
   * Campos en `Settings`: `dailyRate` (tarifa base), `dailyRangeStart`/`dailyRangeEnd`, `dailyRateChanges[]` (`{ fromDate, rate }`), `dailyPreviousRange` (rango anterior, para el cartel del Hero). Ya no existe el "objetivo opcional".
   * **Todos los días del rango de lunes a sábado valen la tarifa automáticamente.** **Los domingos arrancan como "Día libre" ($ 0).**
   * El usuario puede tocar cualquier día: ponerle un monto propio, marcarlo "Día libre" o volver un día libre (domingo incluido) a trabajado. Eso se guarda en `workDays` (`{ date, worked, amount }`); **solo hay registros para los días tocados a mano**.
   * **Naranja SOLO si el monto quedó distinto de la tarifa de ese día.** Si se edita y queda igual, se borra el registro y no cuenta como modificado. El día libre se ve tachado/punteado, nunca naranja.
   * **"Cambiar tarifa desde una fecha"**: agrega `{ fromDate, rate }`. Los días anteriores conservan la tarifa vieja; los editados a mano conservan su monto (`getRateForDate`).
   * **Ingreso base = suma del valor de cada día del rango** (`calculateVariableIncome`; los libres suman 0). Se cuenta el rango completo desde el primer día (decisión del dueño).
   * Si `dailyRangeEnd < dailyRangeStart` se intercambian solos.
   * `calculateBalance` recibe `variableIncome` ya calculado; **no** multiplica días × tarifa.
3. **Hero**: Disponible grande; `Plata total: $ X · Gastos: $ Y`; rojo si es negativo; en modo variable, pastilla **"Días trabajados"** que abre `WorkDaysPanel` (también desde Ajustes).
4. **Cartel del período anterior** (`carryover.ts`): "Empezaste con $ X a favor" (verde) o "Cerraste el período anterior $ X abajo" (rojo). **Solo informativo, no toca el Disponible.** No se muestra si es 0, si no hubo movimientos en ese período o si la app se empezó a usar después. En modo variable usa `dailyPreviousRange`, que se guarda al cambiar el rango en Ajustes **solo si el rango viejo terminó antes de que empiece el nuevo** (`shouldStorePreviousRange`); además el cartel exige que ese rango haya terminado antes de hoy. Editar las fechas del rango actual nunca crea un "período anterior" (Bug E, tests en `carryover.test.ts`).

### D. "+ Ingreso" y el Disponible
1. `+ Ingreso` (o `Shift + Enter`) ignora los chips de categoría: siempre `categoryId: 'income'`, "Ingreso de plata", verde.
2. **Solo cuenta el período actual (decisión del dueño, 2026-11-10)**: `Disponible = ingreso base + ingresos manuales del período − gastos del período`, con fecha entre `periodStart` y `periodEnd`. Un movimiento del período anterior se guarda en el historial pero **no** toca el Disponible.
   * **PROHIBIDO** volver a agregar una "ventana de 14 días", "desde inicio de mes" o cualquier mirada hacia atrás de `periodStart`: restaba los gastos del período anterior del sueldo nuevo (tests `Bug #1` en `balance.test.ts`).
   * **Rango variable vencido**: si hoy es posterior a `periodEnd`, la ventana se estira hasta hoy (`max(periodEnd, hoy)`) para que los gastos nuevos sigan bajando el Disponible (test `Bug #2`).

### E. Movimientos
* El encabezado del panel muestra el período como `11 nov – 1 dic` (`formatShortDate`), nunca `2026-11-11`.
* Desde el detalle de un día (tira de días y calendario del celular) se puede **editar (monto y nota) y borrar** cada movimiento, igual que en el panel.
* El estado "Registrado" del detalle usa el mismo criterio que la tira (`isDayLogged`): algo anotado a mano o "no gasté nada". Un día con solo cargos automáticos figura "Sin registrar · solo cargos automáticos".
* En modo variable, la tira de días muestra "Libre" (tachado) o el monto en naranja cuando el día está editado, con los mismos datos que "Días trabajados" (`getDayValue` / `isDayModified`).
* `MovementsPanel` muestra **solo el período actual**; con texto en el buscador recorre **todo el historial** por nota, nombre de categoría o monto (con o sin puntos), sin distinguir mayúsculas ni acentos (`search.ts`).
* En `MovementsPanel` y `DayDetailModal` se agrupa por categoría con acordeón: ícono, nombre, cantidad, subtotal y flecha.

### F. Calculadora
* Máximo 12 dígitos por número y resultado ≤ `MAX_AMOUNT` (1e12); si se pasa o divide por cero, muestra el aviso en rojo y no guarda.
* Operadores colgantes se descartan (`20000 +` → 20.000). La coma es el decimal y se redondea a pesos enteros.
* Teclado: números, `+ - * /`, `Backspace`, `Escape`, `Enter` = gasto, `Shift+Enter` = ingreso.
* **Con un panel o modal abierto (`role="dialog"`) o el foco en un campo, la calculadora ignora el teclado** (`keyboard.ts`).
* Todos los campos de monto de la app pasan por `formatAmountInput` (solo dígitos, puntos de miles, tope `MAX_AMOUNT`).

### G. Fijos, cuotas y deudas
* Fijos son **siempre mensuales** (`dueDay` 1–31, en meses cortos cae el último día). Tienen `createdAt`: **un fijo creado después de su vencimiento arranca el mes siguiente**. Si la app estuvo cerrada, se cobra una vez por cada mes atrasado con su fecha real. Ids deterministas (`rec_<id>_<fecha>`) evitan duplicados.
* Cuotas: `installmentAmount = round(total / cuotas)`; **la última cuota absorbe el redondeo** (`getInstallmentAmount`) para que la suma dé el total exacto.
* Formularios de fijos y cuotas tienen selector de categoría.
* Deudas (`lib/debts.ts`, tests en `debts.test.ts`): **agrupadas por persona** por defecto (interruptor "Agrupar por persona"); el nombre se compara sin mayúsculas, acentos ni espacios de más (`personKey`). La tarjeta muestra nombre, cantidad y el **neto** ("Rocio te debe $ X" / "Le debés $ X"). Al escribir el nombre en "+ Nueva" se sugieren los ya usados (`suggestPersonNames`). Cualquier deuda se puede editar (nombre, monto, nota, fecha y tipo). "Saldar" por deuda y "Saldar todo" por persona, con confirmación; `settleDebts` en `repo.ts` es todo o nada y devuelve la función para deshacer (tests en `db/debts-settle.test.ts`).
* Pestañas "Todas / Debo plata / Me deben", cada una muestra solo sus deudas (pendientes y saldadas). Al tocar "+ Nueva" parado en una pestaña, la deuda toma ese tipo sin preguntar; el selector "Debo / Me deben" aparece solo en "Todas". Saldar (opcionalmente creando el movimiento) o borrar.

### H. Recordatorios
* Recordatorio diario: dispara a `reminderTime` **o en el primer chequeo posterior** del mismo día (si la app estaba cerrada), una sola vez (`remindersSent`). No avisa si ya se anotó algo ese día.
* Alertas de vencimiento: `dueAlertDays` días antes y el mismo día.

### I. Backup
* Exportar genera JSON `version: 2` con todas las tablas menos `remindersSent`. **En Tauri el `<a download>` no hace nada**: se usa el comando Rust `save_backup`, que escribe en la carpeta de Descargas (`~/Descargas`, sin pisar archivos) y la app muestra la ruta. En el navegador/PWA sí se descarga. No hace falta ningún permiso extra.
* **Borrar nunca es de un solo toque**: movimientos, fijos, cuotas y deudas pasan por `confirmDelete` en `App.tsx`, que abre `ConfirmDialog` ("¿Borrar…?" con el detalle, botones "Borrar" / "Cancelar", portal sobre `document.body`, `z-[100]`) y después muestra el aviso con "Deshacer" (6 s) que vuelve a guardar lo borrado. "Borrar todos los datos" usa el mismo cuadro, sin Deshacer.
* El aviso "Deshacer" es uno solo para toda la app (`showUndo(mensaje, deshacer)`): guardar un movimiento, saldar deudas y borrar.
* Importar pasa por `validateBackup` (versión 1 o 2, máximo 10 MB, fechas `AAAA-MM-DD` reales, montos enteros 0..`MAX_AMOUNT`, enums, ids únicos, campos desconocidos descartados, ajustes completados con los valores por defecto). Antes de reemplazar muestra un resumen y pide confirmación; es todo o nada.

### J. Celular y PWA
* Ancho `< 480 px` (celular real; ya no hay simulador en el escritorio) → layout vertical con `MobileDayStrip` y barra inferior.
* **Zonas seguras**: `viewport-fit=cover` en `index.html`; variables `--safe-top` / `--safe-bottom` en `index.css` (`env(safe-area-inset-*)`, 0 en escritorio). Usar `pt-safe`, `pb-safe` o `calc(... + var(--safe-*))`; nunca pegar contenido al borde de arriba o de abajo. La barra de estado usa `apple-mobile-web-app-status-bar-style: default` y `theme-color`, que `App.tsx` cambia según el tema (solo en la PWA).
* La calculadora en celular usa `fill`: el teclado crece para llenar el alto (filas `minmax(2rem,1fr)`), anclada abajo. En pantallas bajas (≤ 700 px de alto y < 480 de ancho) el Hero se compacta con variantes `[@media(max-width:479px)_and_(max-height:700px)]` (no afectan al escritorio, que mide 540 de ancho).
* Los `Sheet` se cierran arrastrando hacia abajo desde el asa o el título (`useDragControls`); al enfocar un campo se hace `scrollIntoView` para que el teclado no lo tape.
* En Ajustes, "Minimizar a la bandeja", "Iniciar con la PC" y "Tamaño de ventana" solo aparecen en escritorio (`isTauri()`).
* Bienvenida: los montos arrancan vacíos con un `$` de guía (no seleccionable) y "Siguiente" queda bloqueado hasta escribirlos.
* `vite-plugin-pwa` precachea todo `dist/` (manifest, service worker `sw.js`, fallback a `index.html`). Ícono maskable para Android.

### K. Seguridad
* CSP en `tauri.conf.json` (`default-src 'self'`, `worker-src blob:` para el confetti, `connect-src ipc:` para Tauri) y la misma en `public/_headers` para Cloudflare Pages.
* Permisos de Tauri: solo `core:default`, ventana (minimize, close, hide, always-on-top, start-dragging) y `notification:default`.
* Nada sale de la máquina: no hay red, analytics ni cuentas.

---

## 5. Comandos (correr con `pnpm` desde `/home/pikusen27/Proyectos/Bolsillo`)

| Comando | Qué hace |
| :--- | :--- |
| `pnpm test` | Corre los 101 tests (sin abrir ventanas). |
| `npx tsc --noEmit -p .` | Revisa los tipos de TypeScript sin generar archivos. |
| `pnpm tauri dev` | Abre la app de escritorio en modo desarrollo (se recarga sola al editar). |
| `pnpm tauri build` | Compila la app de producción: `src-tauri/target/release/bolsillo` (+ .deb y .rpm en `bundle/`). |
| `pnpm build` | Solo la parte web, a `dist/` (para probar; **no** sube la versión). |
| `pnpm release` | **Para publicar la PWA**: sube la versión (1.3.1 → 1.3.2) en los tres archivos y arma `dist/`. Después se sube `dist/` a Cloudflare. |
| `pnpm release:desktop` | Igual, pero compila la app de escritorio. |
| `pnpm preview` | Sirve `dist/` en `http://localhost:4173` para probar la PWA en esta PC. |
| `pnpm mobile` | Sirve `dist/` en el puerto 5173 **abierto a toda la red local** (hay que correr `pnpm build` antes). Apagarlo al terminar. |
| `pnpm tauri icon public/icons/bolsillo.svg` | Regenera los íconos de escritorio desde el logo. |

### Instalar el binario nuevo (Fish)
```fish
# 1. Cerrar la app si está abierta (tray → "Salir de Bolsillo" o: pkill -x bolsillo)
# 2. Copia de seguridad de los datos
cp -a ~/.local/share/com.bolsillo.desktop ~/.local/share/com.bolsillo.desktop.backup-(date +%Y%m%d)
# 3. Compilar e instalar
pnpm tauri build
cp src-tauri/target/release/bolsillo ~/.local/bin/bolsillo
chmod 755 ~/.local/bin/bolsillo
```
