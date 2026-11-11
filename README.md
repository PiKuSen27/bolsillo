# Bolsillo 🪙 — Control de Gastos Personal

App de escritorio moderna, minimalista y ultra rápida para registrar gastos e ingresos, pensada para el día a día sin la complejidad de una planilla de Excel. Desarrollada con **Tauri v2**, **React 19**, **TypeScript**, **Tailwind CSS** y **Dexie.js (IndexedDB local)**.

---

## Características Principales

- **Ventana estilo widget (Dark Glass)**: Tamaño compacto cuadrado (440 × 440 px), esquinas muy redondeadas (32 px), fondo translúcido, sin bordes del sistema y arrastrable desde cualquier zona vacía.
- **Hero de Saldo en tiempo real**: Contador animado del disponible, barra de progreso del % del mes gastado y métrica clave: *"Podés gastar $X/día · Y días restantes"*.
- **Tira de 7 días y Calendario mensual**: Indicadores visuales de días registrados (● verde), días olvidados sin anotar (○ con ! en coral) y botón directo *"Hoy no gasté nada"*.
- **Calculadora integrada con teclado físico**:
  - Resuelve expresiones como `3500 × 4` al instante.
  - Atajos: `Enter` para guardar gasto, `Shift + Enter` para guardar ingreso, `Esc` para limpiar.
  - Chips de categorías deslizables y campo opcional para notas.
- **Gestión de Fijos y Cuotas**:
  - Suscripciones y servicios con `autoAdd` (se cargan automáticamente en gastos el día del vencimiento sin duplicar).
  - Control de compras en cuotas con barra de progreso ("Cuota 4/12") y aviso de cuota terminada.
  - Columna de próximos vencimientos con alertas de color (ámbar ≤ 3 días, coral hoy o vencido).
- **Ingresos flexibles**: Sueldo mensual fijo + tarifa por día trabajado (ideal para ingresos variables).
- **Recordatorios automáticos**: Aviso diario a la hora configurada (ej. 21:00) si aún no anotaste tus gastos de hoy, y alertas de vencimientos próximos.
- **Bandeja del sistema (Tray) y Autostart**: Se puede ocultar al tray al cerrar para seguir recibiendo notificaciones en segundo plano, con opción de iniciar con el sistema.
- **Copia de seguridad en JSON**: Exportar e importar todos tus datos para backup o para migrar al iPhone.
- **Modo Claro y Oscuro**.

---

## Requisitos y Dependencias del Sistema (CachyOS / Arch Linux)

Si usás CachyOS o Arch Linux, las dependencias del sistema requeridas son:

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module librsvg xdotool nodejs pnpm rustup
rustup default stable
```

---

## Cómo Ejecutar en Desarrollo

Instalar dependencias de Node:
```bash
pnpm install
```

Ejecutar la app de escritorio en modo desarrollo con recarga en vivo:
```bash
pnpm tauri dev
```

### Solución de problemas en Wayland / NVIDIA
En entornos Wayland con controladores NVIDIA, si la ventana llegara a verse en blanco o la transparencia presentara artefactos visuales, ejecutá la app desactivando el renderizador DMABuf de WebKit:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 pnpm tauri dev
```

---

## Tests Unitarios

Toda la lógica de cálculo (período según día de cobro, años bisiestos, saldos negativos, aplicación no duplicada de recurrentes, cuotas y calculadora) está respaldada por una suite exhaustiva de tests en **Vitest**:

```bash
pnpm test
```

---

## Compilación para Producción (Linux Desktop)

Para generar el ejecutable binario de producción:

```bash
pnpm tauri build
```

El binario compilado optimizado se generará en:
`src-tauri/target/release/bolsillo`

### Integración en el menú de KDE Plasma / CachyOS
Podés habilitar el lanzador en el menú de tu escritorio copiando el archivo de acceso directo:

```bash
cp bolsillo.desktop ~/.local/share/applications/
```

---

## Instalación en iPhone (iOS)

### Opción 1: Como PWA (Recomendada, sin Mac)
La app está configurada como **Progressive Web App (PWA)** offline gracias a `vite-plugin-pwa` con service worker local:
1. Subí la carpeta `dist/` a cualquier hosting estático (como Vercel, Netlify o Cloudflare Pages).
2. Abrí el enlace en **Safari** desde tu iPhone.
3. Tocá el botón de **Compartir** (icono con la flecha hacia arriba).
4. Seleccioná **"Agregar a inicio"** (Add to Home Screen).
5. La app se abrirá a pantalla completa como una app nativa, con soporte offline gracias a IndexedDB (Dexie). Podés usar la función de **Exportar/Importar JSON** en Ajustes para transferir tus datos.

> [!NOTE]
> **Limitación conocida en iOS PWA**: Safari limita el envío de notificaciones programadas en segundo plano cuando la app está cerrada sin un servidor push web. Por eso, en iPhone la app se apoya principalmente en los banners visuales de *"Te falta anotar"* que aparecen inmediatamente al abrirla.

### Opción 2: Compilación nativa con Tauri iOS
Para compilar la versión nativa de iOS empaquetada:
```bash
pnpm tauri ios init
pnpm tauri ios build
```
*(Nota: este proceso requiere obligatoriamente una computadora con **macOS**, **Xcode** y el toolchain de iOS configurado).*

---

## Atajos de Teclado (Escritorio)

| Tecla | Acción |
| :--- | :--- |
| `0` - `9` | Ingresar números en la calculadora |
| `+`, `-`, `*`, `/` | Operaciones aritméticas |
| `Backspace` | Borrar último dígito |
| `Escape` | Limpiar display / nota |
| `Enter` | Guardar como **Gasto** |
| `Shift + Enter` | Guardar como **Ingreso** |
