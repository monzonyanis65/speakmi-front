import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePreferencias } from '@/lib/preferencias';
import { decir, elegirVoz, hayVoz, listarVoces, vozElegida, type VozDisponible } from '@/lib/voz';
import { servidorPuedeHablar, servidorPuedeHablarYa } from '@/lib/voz-servidor';

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
  /*
    Si podemos poner nosotros el audio. Cambia por completo lo que hay que
    decirle a quien no tiene voces: con servidor esto es una nota tranquila, y
    sin él sigue siendo el aviso de que media aplicación no va a sonar.
  */
  const [servidor, setServidor] = useState(servidorPuedeHablarYa);
  const { preferencias, guardar } = usePreferencias();

  useEffect(() => {
    if (servidor !== 'todavia-no-se') return;
    void servidorPuedeHablar().then((puede) => setServidor(puede ? 'si' : 'no'));
  }, [servidor]);

  useEffect(() => {
    void (async () => {
      const lista = await listarVoces();
      setVoces(lista);
      setBuscando(false);
    })();
  }, []);

  // La voz guardada en la cuenta gana: se eligió en algún aparato y se espera
  // encontrarla igual en todos. Si aquí no existe, se ignora sin romper nada.
  useEffect(() => {
    const deLaCuenta = preferencias?.ttsVoice;
    if (!deLaCuenta || deLaCuenta === elegida) return;
    setElegida(deLaCuenta);
    elegirVoz(deLaCuenta);
  }, [preferencias, elegida]);

  async function probar(voz: VozDisponible) {
    setSonando(voz.id);
    setElegida(voz.id);
    elegirVoz(voz.id);
    guardar.mutate({ ttsVoice: voz.id });
    await decir(FRASE_DE_PRUEBA, { vozId: voz.id });
    setSonando(null);
  }

  // Sin sintetizador y sin servidor no hay nada que elegir ni nada que contar
  // aquí: el aviso lo da el propio ejercicio cuando toca hacerlo.
  if (!hayVoz() && servidor !== 'si') return null;

  // Mientras se buscan no se dice nada: tardan unos segundos en aparecer y un
  // aviso que sale y desaparece solo asusta para nada.
  if (buscando) return null;

  /*
    Sin ninguna voz inglesa no hay nada que elegir, pero sí algo que contar, y
    ya no es lo mismo según haya servidor o no.

    Con servidor esto deja de ser un problema: se oye igual, solo que el audio
    baja de internet en vez de fabricarlo el aparato. Se dice porque se nota
    —hace falta conexión la primera vez— y porque instalar una voz local sigue
    siendo mejor: va sin conexión y suena al instante.

    Sin servidor se queda el aviso de siempre, que es el honesto: los dictados y
    las frases clave no van a sonar, y se explica cómo arreglarlo.
  */
  if (voces.length === 0) {
    return servidor === 'si' ? (
      <section className="rounded-2xl border-2 border-b-4 border-[var(--borde)] bg-[var(--superficie)] p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden>☁️</span>
          El inglés te lo ponemos nosotros
        </p>
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Este equipo no tiene ninguna voz en inglés, así que el audio lo genera Speakmi y te llega
          por internet. Funciona en todo: dictados, pares mínimos y el juego de Escucha.
        </p>
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Si instalas una voz inglesa en el equipo, la usaremos a ella: va sin conexión y suena al
          instante. En Windows: Configuración → Hora e idioma → Voz → Agregar voces.
        </p>
      </section>
    ) : (
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
