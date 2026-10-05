import { useCallback, useEffect, useRef, useState } from 'react';
import { Shadowing } from '@/components/ejercicios/Shadowing';
import {
  frasesDe,
  leccionesParaImitar,
  type FraseParaImitar,
  type LeccionCandidata,
} from '@/lib/frase-para-imitar';

/**
 * Imitar el ritmo, ya con su propia puerta.
 *
 *
 * POR QUÉ ES UNA PANTALLA Y NO UN PASO DE LA LECCIÓN
 *
 * Vivía dentro de los ejercicios de leer en voz alta, con un botón que cambiaba
 * uno por otro. Lo dijo quien lo usaba: «el shadowing está mal ahí, debería ir
 * como una opción aparte». Y la razón de fondo no es de colocación: imitar el
 * ritmo NO se hace una vez. Se repite el mismo trozo hasta que sale, y eso no
 * cabe en una lección que avanza. Metido ahí, o interrumpes la lección o no
 * repites lo suficiente.
 *
 *
 * LO QUE ESTA PANTALLA HACE DE VERDAD ES ELEGIR LA FRASE
 *
 * Dentro de una lección el código del ejercicio venía dado. Aquí no, así que
 * elegirlo es el trabajo — y es donde puede fallar en silencio, porque una
 * pantalla que sale con una frase cualquiera se ve igual de bien que una que
 * sale con la tuya.
 *
 * Se entra directo a una frase, sin listas que recorrer: quien viene aquí viene
 * a repetir, no a elegir. El botón de «otra frase» cambia sin volver a la red
 * mientras queden de la misma lección, y cuando se agotan pasa a la siguiente.
 * Las lecciones que no traen ninguna frase hablada se saltan en vez de dar la
 * pantalla por vacía: decir «no hay frases» teniéndolas dos lecciones más allá
 * sería mentira.
 */
export function Imitar() {
  const [lecciones, setLecciones] = useState<LeccionCandidata[] | null>(null);
  const [frases, setFrases] = useState<FraseParaImitar[]>([]);
  const [cual, setCual] = useState(0);
  const [agotado, setAgotado] = useState(false);
  /*
    Distinto de `agotado`: esto es «pediste otra y ya no quedaba». Sin
    separarlo, al acabarse las lecciones la pantalla se quedaba enseñando la
    última frase otra vez, y pulsar «otra frase» no hacía nada visible.
  */
  const [seAcabo, setSeAcabo] = useState(false);

  /* Por dónde va el recorrido de lecciones. No se pinta, así que no es estado. */
  const siguienteLeccion = useRef(0);

  /**
   * Trae frases de las lecciones que queden, saltando las que no tengan.
   *
   * Devuelve si encontró algo. Las lecciones sin frases habladas no son un
   * error: el temario solo dice el TIPO de lección, y un repaso puede no traer
   * ninguna.
   */
  const traerMas = useCallback(async (lista: LeccionCandidata[]): Promise<boolean> => {
    while (siguienteLeccion.current < lista.length) {
      const leccion = lista[siguienteLeccion.current]!;
      siguienteLeccion.current += 1;

      let encontradas: FraseParaImitar[] = [];
      try {
        encontradas = await frasesDe(leccion);
      } catch {
        continue;
      }

      if (encontradas.length > 0) {
        setFrases((antes) => {
          setCual(antes.length);
          return [...antes, ...encontradas];
        });
        return true;
      }
    }
    setAgotado(true);
    return false;
  }, []);

  useEffect(() => {
    let vivo = true;
    leccionesParaImitar()
      .then(async (lista) => {
        if (!vivo) return;
        setLecciones(lista);
        if (lista.length === 0) {
          setAgotado(true);
          return;
        }
        await traerMas(lista);
      })
      .catch(() => {
        if (vivo) setAgotado(true);
      });
    return () => {
      vivo = false;
    };
  }, [traerMas]);

  async function otra() {
    // Mientras queden descargadas, cambiar de frase no cuesta una petición.
    if (cual + 1 < frases.length) {
      setCual(cual + 1);
      return;
    }
    if (!lecciones || !(await traerMas(lecciones))) setSeAcabo(true);
  }

  const actual = frases[cual];

  if (!actual || seAcabo) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">Imitar el ritmo</h1>
        {agotado ? (
          <p className="mt-4 text-sm text-[var(--texto-suave)]">
            Todavía no hay frases que imitar. Haz una lección y vuelve: se imita lo que ya diste, no
            lo que no has visto.
          </p>
        ) : (
          <p className="mt-4 text-sm text-[var(--texto-suave)]">Buscando una frase tuya…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
      <h1 className="text-2xl font-bold">Imitar el ritmo</h1>

      {/*
        De dónde sale la frase, dicho en voz alta. Sin esta línea aparecería de
        la nada, que es como se siente un ejercicio al azar; y además cambia lo
        que se espera de ti: si ya hiciste la lección, el vocabulario no es el
        reto y lo único que se mide es cómo suena.
      */}
      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        {actual.hecha ? 'De algo que ya hiciste: ' : 'De una lección que te queda: '}
        <span className="font-medium text-[var(--texto)]">{actual.tituloLeccion}</span>
      </p>

      <Shadowing ejercicio={{ code: actual.code }} />

      <button
        type="button"
        onClick={() => void otra()}
        className="mt-6 min-h-[48px] w-full rounded-xl border-2 border-[var(--borde)] px-4 text-sm font-medium"
      >
        Otra frase
      </button>
    </main>
  );
}
