// Calendario del modo diario, arriba de la barra lateral (se activa en Ajustes → Diario).
// Muestra un mes con la semana empezando el lunes; al hacer clic en un día se abre la nota de ese
// día (`Daily/AAAA-MM-DD.md`) o se crea. Los días que ya tienen nota llevan un punto, hoy va con
// el color de acento y el día de la nota visible queda marcado.

import { useState } from "react";
import { claveDia } from "../diario";
import { useTextos } from "../idioma";

interface Props {
  /** Días que ya tienen nota, como `AAAA-MM-DD`. */
  diasConNota: Set<string>;
  /** Día de la nota visible (`AAAA-MM-DD`), o `null` si no es una nota diaria. */
  diaDeLaNotaVisible: string | null;
  alElegirDia(diaElegido: Date): void;
}

/** Primer día del mes de `fecha`. */
const primerDiaDelMes = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), 1);

/**
 * Días que se dibujan para el mes de `primerDia`: semanas completas de lunes a domingo, con `null`
 * en los huecos antes del día 1 y después del último.
 */
function casillasDelMes(primerDia: Date): (Date | null)[] {
  // getDay(): 0 = domingo; aquí 0 = lunes.
  const huecosAntesDelPrimerDia = (primerDia.getDay() + 6) % 7;
  const cantidadDeDias = new Date(primerDia.getFullYear(), primerDia.getMonth() + 1, 0).getDate();
  const casillas: (Date | null)[] = Array(huecosAntesDelPrimerDia).fill(null);
  for (let numeroDeDia = 1; numeroDeDia <= cantidadDeDias; numeroDeDia++) {
    casillas.push(new Date(primerDia.getFullYear(), primerDia.getMonth(), numeroDeDia));
  }
  while (casillas.length % 7) casillas.push(null);
  return casillas;
}

export function Calendario({ diasConNota, diaDeLaNotaVisible, alElegirDia }: Props) {
  const [mesVisible, setMesVisible] = useState(() => primerDiaDelMes(new Date()));
  const textosDeLaInterfaz = useTextos();
  const claveDeHoy = claveDia(new Date());

  /** Avanza (`paso` = 1) o retrocede (`paso` = -1) un mes. */
  const cambiarDeMes = (paso: 1 | -1) =>
    setMesVisible((mes) => new Date(mes.getFullYear(), mes.getMonth() + paso, 1));

  // «November 2026» o «noviembre 2026» (sin el «de» que pone el español).
  const nombreDelMes = mesVisible
    .toLocaleDateString(textosDeLaInterfaz.locale, { month: "long", year: "numeric" })
    .replace(" de ", " ");

  return (
    <section className="calendario">
      <div className="calendario-cabecera">
        <button className="calendario-flecha" title={textosDeLaInterfaz.mesAnterior} onClick={() => cambiarDeMes(-1)}>‹</button>
        {/* Clic en el mes: vuelve al mes de hoy. */}
        <span className="calendario-mes" title={textosDeLaInterfaz.irAHoy} onClick={() => setMesVisible(primerDiaDelMes(new Date()))}>
          {nombreDelMes}
        </span>
        <button className="calendario-flecha" title={textosDeLaInterfaz.mesSiguiente} onClick={() => cambiarDeMes(1)}>›</button>
      </div>
      <div className="calendario-grilla">
        {/* Iniciales de los días, de lunes a domingo. */}
        {textosDeLaInterfaz.diasSemana.map((inicialDelDia, i) => (
          <span key={`inicial-${i}`} className="calendario-semana">{inicialDelDia}</span>
        ))}
        {casillasDelMes(mesVisible).map((dia, i) => {
          if (!dia) return <span key={i} />;
          const claveDelDia = claveDia(dia);
          const clases = ["calendario-dia"];
          if (claveDelDia === claveDeHoy) clases.push("hoy");
          if (claveDelDia === diaDeLaNotaVisible) clases.push("activo");
          if (diasConNota.has(claveDelDia)) clases.push("con-nota");
          return (
            <button key={i} className={clases.join(" ")} title={claveDelDia} onClick={() => alElegirDia(dia)}>
              {dia.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
