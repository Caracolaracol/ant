// Calendario del modo diario, arriba de la barra lateral (se activa en Ajustes → Diario).
// Muestra un mes con la semana empezando el lunes; al hacer clic en un día, App abre la nota de
// ese día (`Daily/AAAA-MM-DD.md`) o la crea. Los días que ya tienen nota llevan un punto, hoy
// va con el color de acento y el día de la nota visible queda marcado.

import { useState } from "react";
import { claveDia } from "./diario";
import { useTextos } from "./idioma";

interface Props {
  /** Días con nota, como `AAAA-MM-DD`. */
  conNota: Set<string>;
  /** Día de la nota visible (`AAAA-MM-DD`), o `null` si no es una nota diaria. */
  activo: string | null;
  onElegir(fecha: Date): void;
}

/** Primer día del mes de `fecha`. */
const inicioMes = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), 1);

/**
 * Días que se dibujan para el mes de `mes`: semanas completas de lunes a domingo, con `null` en
 * los huecos antes del día 1 y después del último.
 */
function celdas(mes: Date): (Date | null)[] {
  const desfase = (mes.getDay() + 6) % 7; // getDay(): 0 = domingo; aquí 0 = lunes.
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const lista: (Date | null)[] = Array(desfase).fill(null);
  for (let d = 1; d <= total; d++) lista.push(new Date(mes.getFullYear(), mes.getMonth(), d));
  while (lista.length % 7) lista.push(null);
  return lista;
}

export function Calendario({ conNota, activo, onElegir }: Props) {
  const [mes, setMes] = useState(() => inicioMes(new Date()));
  const tx = useTextos();
  const hoy = claveDia(new Date());

  /** Avanza (`paso` = 1) o retrocede (`paso` = -1) un mes. */
  const mover = (paso: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + paso, 1));

  // «November 2026» o «noviembre 2026» (sin el «de» que pone el español).
  const titulo = mes.toLocaleDateString(tx.locale, { month: "long", year: "numeric" }).replace(" de ", " ");

  return (
    <section className="calendario">
      <div className="calendario-cabecera">
        <button className="calendario-flecha" title={tx.mesAnterior} onClick={() => mover(-1)}>‹</button>
        {/* Clic en el mes: vuelve al mes de hoy. */}
        <span className="calendario-mes" title={tx.irAHoy} onClick={() => setMes(inicioMes(new Date()))}>
          {titulo}
        </span>
        <button className="calendario-flecha" title={tx.mesSiguiente} onClick={() => mover(1)}>›</button>
      </div>
      <div className="calendario-grilla">
        {/* Iniciales de los días, de lunes a domingo. */}
        {tx.diasSemana.map((d, i) => (
          <span key={`s${i}`} className="calendario-semana">{d}</span>
        ))}
        {celdas(mes).map((dia, i) => {
          if (!dia) return <span key={i} />;
          const clave = claveDia(dia);
          const clases = ["calendario-dia"];
          if (clave === hoy) clases.push("hoy");
          if (clave === activo) clases.push("activo");
          if (conNota.has(clave)) clases.push("con-nota");
          return (
            <button key={i} className={clases.join(" ")} title={clave} onClick={() => onElegir(dia)}>
              {dia.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
