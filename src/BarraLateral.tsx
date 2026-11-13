// Barra lateral de navegación, como la de Left: lista las notas abiertas y, bajo la nota
// visible, sus títulos (`#`, `##`, …) para saltar a ellos. Marca la nota activa, el título
// donde está el cursor y las notas con cambios sin guardar.

import { useMemo } from "react";
import { extraerMarcadores, marcadorActual } from "./marcadores";
import { nombreArchivo } from "./notas";

/** Lo que la barra necesita saber de cada nota abierta. */
export interface NotaResumen {
  id: string;
  ruta: string | null;
  texto: string;
  sucio: boolean;
}

interface Props {
  notas: NotaResumen[];
  activa: string;
  /** Posición del cursor en la nota activa. */
  cursor: number;
  onElegir(id: string): void;
  onCerrar(id: string): void;
  onSaltar(pos: number): void;
}

export function BarraLateral({ notas, activa, cursor, onElegir, onCerrar, onSaltar }: Props) {
  // Los títulos solo se recalculan cuando cambia el texto de la nota activa, no al mover el cursor.
  const textoActivo = notas.find((n) => n.id === activa)?.texto ?? "";
  const marcadores = useMemo(() => extraerMarcadores(textoActivo), [textoActivo]);
  const seleccionado = marcadorActual(marcadores, cursor);

  return (
    <nav className="barra">
      {notas.map((nota) => (
        <section key={nota.id}>
          <div className={`barra-nota${nota.id === activa ? " activa" : ""}`} onClick={() => onElegir(nota.id)}>
            <span className="barra-nombre">
              {nota.ruta ? nombreArchivo(nota.ruta) : "Sin título"}
              {nota.sucio && " *"}
            </span>
            {/* Botón para cerrar la nota; detiene el clic para no activarla al mismo tiempo. */}
            <button
              className="barra-cerrar"
              title="Cerrar nota"
              onClick={(e) => {
                e.stopPropagation();
                onCerrar(nota.id);
              }}
            >
              ×
            </button>
          </div>
          {nota.id === activa &&
            marcadores.map((m, i) => (
              <div
                key={`${m.pos}-${m.texto}`}
                className={`barra-marcador${i === seleccionado ? " actual" : ""}`}
                style={{ paddingLeft: 12 + (m.nivel - 1) * 10 }}
                onClick={() => onSaltar(m.pos)}
              >
                {m.texto}
              </div>
            ))}
        </section>
      ))}
    </nav>
  );
}
