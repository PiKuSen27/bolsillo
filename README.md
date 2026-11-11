# Bolsillo

App chiquita para saber, cada día, cuánta plata te queda. Anotás gastos e ingresos con una calculadora, y Bolsillo te dice cuánto podés gastar por día hasta el próximo cobro. Todo se guarda en tu dispositivo: no hay cuentas, nube ni internet de por medio.

Hecha con **Tauri 2** (escritorio Linux), **React 19**, **TypeScript**, **Tailwind CSS 4** y **Dexie** (base de datos local). También funciona como **PWA** en el celular.

## Qué hace

- **Disponible en grande**: ingreso del período − gastos del período, con "podés gastar $ X por día".
- **Dos modos de ingreso** (se elige uno):
  - **Sueldo fijo**: monto mensual y día de cobro.
  - **Sueldo por día**: tarifa diaria y un rango de fechas. De lunes a sábado cada día ya vale la tarifa; los domingos son libres. Podés tocar cualquier día para cambiarle el monto, marcarlo libre, o cambiar la tarifa "de tal fecha en adelante".
- **Cartel del período anterior**: "Empezaste con $ X a favor" o "Cerraste $ X abajo" (solo informativo).
- **Calculadora** con teclado físico: `3500 × 4`, `Enter` guarda gasto, `Shift + Enter` ingreso, `Esc` limpia.
- **Tira de días** con indicador de días sin anotar y botón "Hoy no gasté nada".
- **Fijos y cuotas** que se anotan solos el día que vencen (sin duplicar), con próximos vencimientos.
- **Deudas**: lo que debés y lo que te deben.
- **Movimientos** del período con buscador por nota, categoría o monto en todo el historial.
- **Recordatorio diario** si no anotaste nada, y alertas de vencimientos.
- **Backup** en JSON (exportar / importar con validación y confirmación).
- Temas **Blanco** y **Negro**. Respeta "reducir movimiento" del sistema.

## Requisitos (CachyOS / Arch)

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl librsvg nodejs pnpm rustup
rustup default stable
```

## Desarrollo

```bash
pnpm install      # instala las dependencias de Node
pnpm tauri dev    # abre la app de escritorio con recarga automática
pnpm test         # corre los 82 tests de lógica
```

## Compilar e instalar en Linux

```bash
pnpm tauri build
# Binario: src-tauri/target/release/bolsillo  (también .deb y .rpm en src-tauri/target/release/bundle/)
cp src-tauri/target/release/bolsillo ~/.local/bin/bolsillo
chmod 755 ~/.local/bin/bolsillo
cp bolsillo.desktop ~/.local/share/applications/   # entrada en el menú de aplicaciones
```

Antes de instalar una versión nueva, copiá la carpeta de datos: `~/.local/share/com.bolsillo.desktop/`.

Este proyecto se usa en **Niri (Wayland)**. La regla de ventana que deja la app flotante de 540×600 está en `CLAUDE.md`.

## Usarla en el celular (PWA)

1. `pnpm build` genera la carpeta `dist/`.
2. Subí `dist/` a un hosting estático (por ejemplo Cloudflare Pages; `public/_headers` ya trae las cabeceras de seguridad).
3. Abrí la dirección en Safari (iPhone) o Chrome (Android) y elegí **Agregar a inicio**. Funciona sin conexión.
4. Para pasar tus datos de la PC al celular: Ajustes → Exportar JSON en la PC, Importar JSON en el celular.

> En iPhone, Safari no permite notificaciones programadas sin un servidor; la app se apoya en el aviso "Te falta anotar" al abrirla.

Para probarla en el celular sin subirla a ningún lado: `pnpm build && pnpm mobile` y abrí `http://IP-de-tu-PC:5173` desde el celular (misma red Wi-Fi). Apagá el comando al terminar.

## Atajos de teclado (escritorio)

| Tecla | Acción |
| :--- | :--- |
| `0`–`9`, `,` | Escribir el monto |
| `+` `-` `*` `/` | Operaciones |
| `Backspace` | Borrar el último dígito |
| `Escape` | Limpiar (o cerrar el panel abierto) |
| `Enter` | Guardar como **gasto** |
| `Shift + Enter` | Guardar como **ingreso** |

Con un panel abierto la calculadora no reacciona al teclado.

## Créditos

Creado por **PiKuSen27**, a cuatro manos con Claude.
