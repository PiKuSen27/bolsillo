# CLAUDE.md — Guía Técnica y Arquitectura de Bolsillo

> **Bolsillo v1.2.0 PRO • Edición Especial**  
> **Autor y Dueño**: PiKuSen27  
> **Moneda y Formato**: Pesos Argentinos (`ARS`), números enteros sin centavos, con separador de miles por punto (`$ 20.000`). Español rioplatense en toda la interfaz.

---

## 1. Entorno del Usuario y Sistema Operativo

* **Sistema Operativo**: **CachyOS** (distribución Arch Linux optimizada para rendimiento y CPU scheduler de baja latencia).
* **Entorno Gráfico**: Compositor Wayland **Niri** (tiling con scroll horizontal infinito), acompañado de la barra/shell **iNiR**.
  * **IMPORTANTE**: El usuario **NO utiliza KDE Plasma ni GNOME**. Todas las reglas de ventanas y comportamiento de atajos dependen de Wayland y la configuración de Niri.
* **Shell**: **Fish shell** (`/usr/bin/fish`). Recordar que la sintaxis de variables y exportación difiere de Bash (`set -gx VAR val`).
* **Ubicación del binario en producción**: `~/.local/bin/bolsillo` (agregado al `PATH`).
* **Acceso directo de escritorio**: `~/.local/share/applications/bolsillo.desktop`.
* **Regla de ventana en Niri** (`~/.config/niri/config.kdl`):
  ```kdl
  window-rule {
      match app-id="^bolsillo$"
      open-floating true
      default-floating-size 540 600
  }
  ```

---

## 2. Stack Tecnológico

| Capa | Tecnología | Rol |
| :--- | :--- | :--- |
| **Desktop Framework** | **Tauri v2** (`@tauri-apps/api`, Rust 2021) | Wrapper de escritorio ligero sobre WebKitGTK / Wayland. |
| **Frontend Framework** | **React 19** (`react`, `react-dom`) | UI reactiva declarativa. |
| **Lenguaje** | **TypeScript 5.6** (Strict mode) | Tipado estático total de datos financieros. |
| **Estilos** | **Tailwind CSS v4** (`@tailwindcss/vite`) | Diseño utilitario sin clases CSS externas innecesarias. |
| **Animaciones** | **Motion** (`motion/react` v12) | Animaciones fluidas a 60fps en modales, sheets y toasts. |
| **Base de Datos Local** | **Dexie.js v4** (IndexedDB wrapper) | Almacenamiento 100% offline, local y sin servidor en el navegador/WebKit. |
| **Manejo de Fechas** | **date-fns v4** | Aritmética de fechas, rangos, formato en español y zonas horarias. |
| **PWA / Móvil** | **vite-plugin-pwa** (Workbox) | Manifiesto e instalación como PWA offline en iPhone y Android. |
| **Testing** | **Vitest 5.1** | Suite de 32 tests unitarios de lógica pura financiera. |

---

## 3. Mapa Completo de Archivos

```
Bolsillo/
├── src/
│   ├── components/            # Componentes visuales principales de la UI
│   │   ├── AnimatedNumber.tsx      # Contador animado de montos numéricos con easing suave
│   │   ├── BannerMissingDays.tsx   # Aviso amarillo cuando hay días sin registrar en la tira
│   │   ├── Calculator.tsx          # Teclado numérico, display, categoría y notas (blindado)
│   │   ├── DayDetailModal.tsx      # Modal de detalle de un día específico con acordeón de categorías
│   │   ├── DayStrip.tsx            # Tira horizontal de días (Hoy + 3 días previos + botón "+ Días")
│   │   ├── Hero.tsx                # Tarjeta principal: Disponible grande, Plata Total y Gastos
│   │   ├── MobileDayStrip.tsx      # Tira de días optimizada para layout móvil y responsive (< 480px)
│   │   ├── RightColumnWidget.tsx   # Columna derecha: accesos rápidos a fijos, deudas y resumen
│   │   ├── Sheet.tsx               # Modal lateral/bottom-sheet animado reutilizable
│   │   └── UpcomingWidget.tsx      # Widget de próximos vencimientos de fijos y cuotas
│   ├── db/                    # Acceso y persistencia con Dexie.js
│   │   ├── db.ts                   # Definición del esquema Dexie (tablas: movements, fixed, installments, debts, settings)
│   │   └── repo.ts                 # Repositorio de consultas CRUD tipadas para movimientos, deudas y fijos
│   ├── lib/                   # Lógica de negocio pura (100% testeable sin DOM)
│   │   ├── balance.ts              # Cálculo del saldo disponible, plata total, gastos y proyección diaria
│   │   ├── balance.test.ts         # Tests de balance en modo Fijo y Variable
│   │   ├── calc.ts                 # Evaluador de expresiones aritméticas con strip de operadores sueltos
│   │   ├── calc.test.ts            # Tests de la calculadora (prioridad de operadores, errores, límites)
│   │   ├── constants.ts            # Lista de categorías predeterminadas de gastos y categoría fija de ingreso
│   │   ├── format.ts               # Formateadores de moneda ARS ($ 20.000) y fechas en español
│   │   ├── format.test.ts          # Tests de formateo
│   │   ├── period.ts               # Lógica de cálculo de períodos (mensual fijo vs rango variable de fechas)
│   │   ├── period.test.ts          # Tests de cálculo de períodos y prevención de fechas invertidas
│   │   ├── recurring.ts            # Lógica para auto-aplicar servicios recurrentes (`autoAdd`) y cuotas
│   │   ├── recurring.test.ts       # Tests de recurrencias sin duplicación
│   │   ├── reminders.ts            # Gestión de alertas de días sin registrar y vencimientos cercanos
│   │   └── reminders.test.ts       # Tests de recordatorios
│   ├── panels/                # Modales / Vistas de pantalla completa en overlay
│   │   ├── CalendarPanel.tsx       # Calendario mensual completo para navegar y ver totales históricos
│   │   ├── DebtsPanel.tsx          # Panel de gestión de Deudas ("Debo plata" y "Me deben plata")
│   │   ├── FixedAndInstallmentsPanel.tsx # Panel de gestión de Gastos Fijos, Suscripciones y Cuotas
│   │   ├── IncomePanel.tsx         # Configuración de Ingresos (Sueldo Fijo vs Sueldo Variable)
│   │   ├── MovementsPanel.tsx      # Historial de movimientos del período con barra multicolor y acordeón
│   │   ├── OnboardingPanel.tsx     # Asistente de bienvenida y configuración inicial de primer uso
│   │   └── SettingsPanel.tsx       # Ajustes: Tema Blanco/Negro, Notificaciones, Backup JSON, PWA Móvil
│   ├── platform/              # Abstracción de entorno (Tauri Desktop vs Web / Mobile PWA)
│   │   └── index.ts                # Detección de `isTauri()`, métodos de ventana, notificaciones nativas y tray
│   ├── types/                 # Definiciones TypeScript de entidades
│   │   └── index.ts                # Tipos de Movimiento, Categoría, Deuda, Fijo, Cuota, Ajustes y Período
│   ├── App.css                # Ajustes globales de CSS
│   ├── App.tsx                # Componente raíz: orquestador de estado, layout responsivo y simulación móvil
│   ├── index.css              # Importación de Tailwind CSS v4 y scrollbar-none utilities
│   ├── main.tsx               # Punto de entrada de React con registro condicional de Service Worker
│   └── vite-env.d.ts          # Tipos globales de Vite
├── src-tauri/                 # Backend nativo de Rust y Tauri v2
│   ├── src/
│   │   ├── lib.rs                  # Configuración de plugins, System Tray, comandos IPC y tamaño fijo
│   │   └── main.rs                 # Punto de entrada de Rust
│   ├── capabilities/          # Permisos de Tauri v2 (core, notification, window-state)
│   ├── tauri.conf.json        # Configuración de ventana (540x600, no resizable, no transparente, título)
│   └── Cargo.toml             # Dependencias de crates Rust (tauri, tauri-plugin-window-state, etc.)
├── bolsillo.desktop           # Archivo desktop launcher para el menú de aplicaciones de Linux
├── package.json               # Scripts de desarrollo y dependencias npm
├── tsconfig.json              # Configuración de TypeScript
├── vite.config.ts             # Configuración de Vite con Tailwind v4 y VitePWA
└── vitest.config.ts           # Configuración de Vitest para correr tests en Node
```

---

## 4. Reglas de Negocio y Decisiones de Diseño Críticas (PROHIBIDO ROMPER)

Cualquier cambio futuro debe respetar religiosamente estas decisiones:

### A. Ventana y Comportamiento de Escritorio (540 × 600 px)
1. **Dimensiones Fijas**: La ventana de escritorio mide exactamente **540 px de ancho por 600 px de alto**.
2. **Propiedades de Ventana**: `resizable: false`, `maximizable: false`, `fullscreen: false`, `transparent: false` (fondo 100% sólido, sin artefactos translúcidos en Wayland).
3. **Restauración de Posición Segura**:
   * En `tauri.conf.json`, `plugins` **NO debe contener `window-state: {}`** (eso provoca pánico por incompatibilidad de tipos en Tauri v2).
   * En Rust (`src-tauri/src/lib.rs`), se utiliza `StateFlags::POSITION` exclusivamente (`.with_state_flags(tauri_plugin_window_state::StateFlags::POSITION)`). **NUNCA agregar `StateFlags::SIZE`** porque causaría que Wayland/Niri maximice la ventana a pantalla completa al reabrirla.
4. **Header y Región Arrastrable**:
   * La barra superior tiene `data-tauri-drag-region`.
   * **TODOS los botones del header** (pin `📌`, minimizar `–`, cerrar `×`, simulador `📱`) DEBEN tener `onMouseDown={(e) => e.stopPropagation()}` y `onClick` explícito para que el click no sea interceptado por el drag de Wayland.
5. **Minimizar y Tray**:
   * El botón `–` invoca el comando Tauri `minimize_window`, el cual minimiza la ventana y la oculta (`app.hide()` / `win.hide()`). Al hacer click en el icono del Tray o ejecutar el binario nuevamente, la ventana se restaura (`win.show()`, `win.unminimize()`, `win.set_focus()`).

### B. Paleta y Temas Estrictos
1. Solo existen dos temas: **"Blanco"** (`#FFFFFF` con fondo `#F4F4F5`) y **"Negro"** (`#000000` con tarjetas `#0A0A0A` / `#121212`).
2. Prohibidos los colores fosforescentes o neón.
3. Contrastes obligatorios:
   * **Verde Esmeralda**: `#16A34A` / `#22C55E` para ingresos y balances positivos.
   * **Carmesí Suave**: `#DC2626` / `#EF4444` para gastos y deudas por pagar.
   * **Bordes**: Finos de 1px (`border-zinc-200` en Blanco, `border-zinc-800` en Negro).
   * **Tipografía**: Gruesa, moderna y legible (`font-bold`, `font-extrabold`).

### C. Modos de Ingreso (Excluyentes)
1. **Sueldo Fijo**:
   * El usuario define un monto mensual fijo y un día de cobro (1 al 31).
   * El período abarca desde el último día de cobro hasta el día anterior al próximo cobro.
2. **Sueldo Variable por Rango de Fechas**:
   * El usuario define una tarifa diaria (`dailyRate`), una fecha de inicio (`variableStartDate`) y una fecha de fin (`variableEndDate`).
   * El ingreso base proyectado es estrictamente: **`(días del rango) × dailyRate`**.
   * Hay una meta opcional (`variableIncomeGoal`).
   * **Validación de fechas invertidas**: Si por error `variableEndDate < variableStartDate`, el sistema las intercambia automáticamente para garantizar que los días nunca den números negativos.
3. **Hero del Saldo**:
   * Muestra en grande el **Disponible actual**.
   * Muestra explícitamente el desglose: **`Plata total: $ X · Gastos: $ Y`**.
   * Si el Disponible es negativo, se muestra en rojo con alerta.

### D. Reglas de los "+ Ingreso" Manuales
1. Al tocar `+ Ingreso` (o presionar `Shift + Enter` en la calculadora), **se ignoran por completo los chips de categorías de gasto seleccionados**.
2. Todo ingreso se guarda obligatoriamente con `categoryId: 'income'`, nombre **"Ingreso de plata"** y color verde esmeralda (`#16A34A`).
3. **Impacto Inmediato en el Saldo**: Tanto en modo fijo como variable, cualquier movimiento con `kind === 'income'` suma siempre al Ingreso Total y al Disponible.
4. **Ventana de 14 días**: El cálculo de balance incluye el período activo más cualquier movimiento de los últimos 14 días (o desde el inicio del mes) para garantizar que si se anota un movimiento en cualquier día visible de la tira, el Disponible se actualice en el acto.

### E. Despliegue en Acordeón por Categoría
* Tanto en `MovementsPanel.tsx` como en `DayDetailModal.tsx`, los movimientos se agrupan por categoría con un resumen colapsable que muestra:
  * Icono y nombre de categoría.
  * Cantidad de operaciones (ej. `(3)`).
  * Subtotal gastado/ingresado.
  * Flecha de despliegue `ChevronDown` interactiva para ver el desglose individual con hora y notas.

### F. Calculadora Blindada
* Longitud máxima de 12 dígitos para evitar roturas de layout.
* Limpieza automática de operadores colgantes: si se escribe `20000 +` y se presiona directamente `- Gasto`, se descarta el `+` final y se procesa `20.000` limpiamente sin `NaN`.
* Atajos de teclado: `Backspace` borra 1 dígito, `Escape` limpia todo, soporte completo de `Numpad`.

### G. Módulo de Deudas
* Dos listas separadas: **"Debo plata"** (a quién le debo) y **"Me deben plata"** (quién me debe).
* Tabla dedicada `debts` en Dexie.
* Permite marcar una deuda como saldada (sin eliminar el historial) o borrarla con confirmación.

### H. Modo Celular y Simulación
* Si el ancho de pantalla es `< 480px` (o cuando se activa el botón `📱` en escritorio), la app pasa al layout vertical responsivo.
* En móvil, la barra de títulos de escritorio se oculta automáticamente.
* La tira de días cambia a `MobileDayStrip` con botones de fácil toque con el pulgar.
* La app cuenta con Service Worker (`registerSW.js`) para funcionar como PWA offline en iPhone y Android.

---

## 5. Comandos de Desarrollo y Compilación

Ejecutar siempre con `pnpm` desde el directorio `/home/pikusen27/Proyectos/Bolsillo`:

### Tests Unitarios
```bash
pnpm test
```
*Corre la suite completa de 32 tests en Vitest sin interfaz gráfica.*

### Desarrollo de Escritorio (Hot-Reload)
```bash
pnpm tauri dev
```

### Compilación de Producción Desktop
```bash
pnpm tauri build
```
*Genera el ejecutable optimizado en `src-tauri/target/release/bolsillo`.*

### Actualización del Binario en CachyOS (Fish Shell)
Para compilar y dejar el binario listo en el lanzador del usuario:
```fish
pnpm tauri build
cp src-tauri/target/release/bolsillo ~/.local/bin/bolsillo
chmod +x ~/.local/bin/bolsillo
```

### Servidor Local para Pruebas en Móvil / iPhone
```bash
pnpm mobile
```
*Levanta el servidor Vite en el puerto `5173` escuchando en todas las interfaces de red (`--host 0.0.0.0`). Cuando el usuario termine las pruebas, detener el proceso para liberar el puerto.*
