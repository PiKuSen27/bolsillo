/**
 * NOVEDADES DE CADA VERSIÓN (se muestran una vez después de actualizar y en Ajustes → Acerca de).
 * Para una versión nueva: agregá un bloque ARRIBA de todo, con la misma versión que package.json,
 * y 2 o 3 frases cortas y simples.
 */
export const NOVEDADES: { version: string; items: string[] }[] = [
  {
    version: "1.3.5",
    items: [
      "Bolsillo ahora es software libre: el código está en GitHub",
      "Nueva dirección web: bolsillo.pikusen27.workers.dev",
    ],
  },
  {
    version: "1.3.4",
    items: [
      "Fijos, cuotas y deudas se guardan completos o no se guardan: ya no pueden quedar a medias",
      "Editar compras de dólares o deudas con pagos ya no descuadra los números",
      "Arreglos de seguridad y velocidad",
    ],
  },
  {
    version: "1.3.3",
    items: [
      "Ahorros y deudas en dólares, con la cotización del día",
      "Resumen del mes con topes por categoría y pagos parciales en deudas",
      "\"Podés gastar\" ahora descuenta fijos y cuotas que vienen, y podés apartar un ahorro",
    ],
  },
  {
    version: "1.3.2",
    items: [
      "Podés ocultar los montos con el ojo de Disponible",
      "Contraseña opcional con tus datos cifrados",
      "Tutorial corto para conocer la app",
    ],
  },
  {
    version: "1.3.1",
    items: ["La app avisa cuando hay una versión nueva", "Recordatorio para hacer backup"],
  },
];
