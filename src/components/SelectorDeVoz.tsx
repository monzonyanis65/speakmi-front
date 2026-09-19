import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { decir, elegirVoz, hayVoz, listarVoces, vozElegida, type VozDisponible } from '@/lib/voz';

/** Lo que se dice al probar una voz. Corto, y con sonidos que delatan lo malo. */
const FRASE_DE_PRUEBA = 'Hello! This is how I sound. Nice to meet you.';

/**
 * Elegir con qué voz se escucha el inglés.
 *
 * Hace falta porque la calidad cambia muchísimo de un equipo a otro, y de una
 * voz a otra dentro del mismo equipo. La que trae Windows de serie suena a
 * robot; las que sintetiza el navegador por su cuenta suenan a persona. Se
 * ofrecen todas, ordenadas de la que mejor suena a la que peor, y se pueden
 * oír antes de decidir: describir una voz con palabras no sirve de nada.
 */
export function SelectorDeVoz() {
  const [voces, setVoces] = useState<VozDisponible[]>([]);
  const [elegida, setElegida] = useState<string | null>(vozElegida());
  const [sonando, setSonando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(true);

  useEffect(() => {
    void (async () => {
      const lista = await listarVoces();
      setVoces(lista);
      setBuscando(false);
    })();
  }, []);

  async function probar(voz: VozDisponible) {
    setSonando(voz.id);
    setElegida(voz.id);
    elegirVoz(voz.id);
    await decir(FRASE_DE_PRUEBA, { vozId: voz.id });
    setSonando(null);
  }

  if (!hayVoz()) return null;

  // Mientras se buscan no se dice nada: tardan unos segundos en aparecer y un
  // aviso que sale y desaparece solo asusta para nada.
  if (buscando) return null;

  /*
    Sin ninguna voz inglesa no hay nada que elegir, y callarse sería lo peor:
    los dictados y las frases clave se quedarían mudos sin explicación. Se dice
    qué pasa y cómo se arregla, que son tres toques en Windows.
  */
  if (voces.length === 0) {
    return (
      <section className="rounded-2xl border-2 border-dashed border-[var(--color-aviso)] bg-[var(--superficie)] p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden>🔇</span>
          No hay ninguna voz en inglés en este equipo
        </p>
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Sin ella no se puede escuchar el inglés. No lo reproducimos con una voz española a
          propósito: leería «beach» como otra palabra y aprenderías mal.
        </p>
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          En Windows: Configuración → Hora e idioma → Voz → Agregar voces, y elige una de inglés.
          Luego cierra y vuelve a abrir el navegador.
        </p>
      </section>
    );
  }

  const actual = voces.find((voz) => voz.id === elegida) ?? voces[0];

  return (
    <section className="rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 text-left"
      >
        <span aria-hidden className="text-xl">
          🗣️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Voz del inglés</span>
          <span className="block truncate text-xs text-[var(--texto-suave)]">
            {actual?.nombre ?? 'automática'}
            {actual?.natural ? ' · suena natural' : ''}
          </span>
        </span>
        <span aria-hidden className="text-[var(--texto-suave)]">
          {abierto ? '▴' : '▾'}
        </span>
      </button>

      {abierto && (
        <div className="mt-4 grid gap-2">
          <p className="text-xs text-[var(--texto-suave)]">
            Toca una para oírla. La que elijas se usa en los dictados y en las frases clave.
          </p>

          {voces.map((voz, indice) => (
            <button
              key={voz.id}
              type="button"
              onClick={() => void probar(voz)}
              disabled={sonando !== null}
              aria-pressed={elegida === voz.id}
              style={{ animationDelay: `${indice * 40}ms`, animationFillMode: 'backwards' }}
              className={cn(
                'flex animate-entrada items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-60',
                elegida === voz.id
                  ? 'border-marca-600 bg-marca-50 dark:bg-marca-600/20'
                  : 'border-[var(--borde)] hover:border-marca-400',
              )}
            >
              <span aria-hidden>{sonando === voz.id ? '🔈' : '🔊'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{voz.nombre}</span>
                <span className="block text-xs text-[var(--texto-suave)]">{voz.idioma}</span>
              </span>
              {/*
                Se marcan las buenas en vez de esconder las malas: en un equipo
                sin ninguna natural, esconderlas dejaría la lista vacía y
                parecería que la aplicación está rota.
              */}
              {voz.natural && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                  natural
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
