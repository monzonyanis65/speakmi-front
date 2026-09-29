/**
 * Lo fuerte que suena una voz, ahora mismo.
 *
 * Existe para una cosa: que la boca de las mascotas se abra lo que suena la voz
 * de verdad y no lo que le toque por turno. `visemaDeVoz` ya sabe convertir una
 * apertura de 0 a 1 en una postura de boca; lo que faltaba era de dónde sacar
 * ese número, y sale de aquí.
 *
 * NO hay reconocimiento de fonemas ni falta. Lo que el ojo reconoce como habla
 * no es que la boca acierte el sonido —no lo comprueba nadie— sino que se mueva
 * CUANDO hay voz y se pare cuando no la hay. Eso es amplitud, y la amplitud se
 * lee con un `AnalyserNode` en cuatro líneas.
 *
 * El cálculo vive separado del enganche a propósito: el enganche necesita un
 * navegador con Web Audio y no se puede probar, y el cálculo es aritmética que
 * sí se puede probar entera.
 */

/**
 * Cuánta señal hay en estas muestras, de 0 a 1.
 *
 * Las muestras vienen de `getByteTimeDomainData`, que entrega la ONDA, no el
 * espectro: son bytes de 0 a 255 donde el silencio es 128, no 0. Ese 128 es la
 * trampa de todo esto. Midiendo los bytes tal cual, el silencio da 0,5 y la boca
 * se queda medio abierta para siempre, que es peor que no moverla.
 *
 * Se mide en valor eficaz (la raíz de la media de los cuadrados) y no por el
 * pico. El pico de una voz lo marca cualquier chasquido y salta a tope con un
 * golpe de aire en el micrófono; el valor eficaz es cuánta voz hay de media en
 * ese instante, que es lo que abre una mandíbula.
 */
export function amplitudDe(muestras: Uint8Array): number {
  if (muestras.length === 0) return 0;

  let suma = 0;
  for (let i = 0; i < muestras.length; i += 1) {
    // De byte a onda centrada: 128 es el reposo y 1 es el máximo de la escala.
    const onda = (muestras[i]! - 128) / 128;
    suma += onda * onda;
  }

  const eficaz = Math.sqrt(suma / muestras.length);
  return Math.min(1, eficaz / EFICAZ_DE_VOZ_ALTA);
}

/**
 * Qué valor eficaz se considera «hablando fuerte», o sea el tope de la escala.
 *
 * Una voz sintetizada normalizada se mueve entre 0,05 y 0,25 de valor eficaz; el
 * uno de la escala no está ni cerca porque el uno es una onda cuadrada a tope,
 * que no existe en una voz. Sin este divisor la amplitud no pasaría nunca de 0,2
 * y la boca no llegaría a abrirse: se vería a la mascota masticando.
 */
const EFICAZ_DE_VOZ_ALTA = 0.2;

/**
 * Cuánto se mueve la apertura de un fotograma al siguiente.
 *
 * ABRE MÁS RÁPIDO DE LO QUE CIERRA, y no es un ajuste estético. La amplitud
 * bruta salta muchísimo entre fotogramas —dentro de una misma vocal hay ceros,
 * porque una onda pasa por cero sesenta veces por segundo— y seguida al pie de
 * la letra la mandíbula tiembla. Una mandíbula de verdad tampoco puede: pesa.
 *
 * Que suba antes que baje es lo que copia el ataque de una sílaba, que empieza
 * de golpe y se apaga poco a poco. Igualando los dos números se pierde el
 * ataque y todo se lee como un zumbido.
 */
const AL_ABRIR = 0.6;
const AL_CERRAR = 0.22;

/** La apertura del fotograma siguiente, partiendo de la de ahora. */
export function suavizar(anterior: number, medida: number): number {
  const peso = medida > anterior ? AL_ABRIR : AL_CERRAR;
  return anterior + (medida - anterior) * peso;
}

/**
 * Lo que tiene que cambiar la apertura para molestarse en avisar.
 *
 * Quien recibe esto lo mete en un estado de React, y la boca solo lo consulta
 * una vez por sílaba —unas diez veces por segundo—. Avisar sesenta veces por
 * segundo sería dibujar la pantalla entera sesenta veces para que cincuenta de
 * esas lecturas no las mire nadie.
 */
const SALTO_QUE_IMPORTA = 0.07;
const MINIMO_ENTRE_AVISOS = 70;

/** Con qué frecuencia se mira la onda. 1024 muestras son unos 23 ms de sonido. */
const MUESTRAS = 1024;

/**
 * El contexto de audio, uno para toda la aplicación.
 *
 * Los navegadores limitan cuántos se pueden tener abiertos —seis en Chrome— y
 * crear uno por frase se los come en media escena y deja la aplicación muda. Se
 * crea a la primera y se reutiliza.
 */
let contexto: AudioContext | null = null;

function contextoDeAudio(): AudioContext | null {
  if (contexto) return contexto;

  const Constructor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Constructor) return null;

  try {
    contexto = new Constructor();
    return contexto;
  } catch {
    // Sin Web Audio no hay amplitud, pero el audio se sigue oyendo igual.
    return null;
  }
}

/**
 * Engancha un analizador a este audio y va avisando de lo fuerte que suena.
 *
 * Devuelve cómo soltarlo. Hay que llamarlo siempre: sin soltar, el bucle de
 * fotogramas sigue vivo después de cambiar de pantalla.
 *
 * Si algo falla —no hay Web Audio, el navegador se niega, el elemento ya estaba
 * enganchado— devuelve un soltar que no hace nada y no avisa nunca. Quien lo use
 * tiene que aguantar eso y seguir funcionando: es exactamente el mismo caso que
 * cuando habla el sintetizador del navegador, donde no hay nada que medir.
 */
export function seguirAmplitud(
  audio: HTMLAudioElement,
  alMedir: (apertura: number) => void,
): () => void {
  const nada = () => {};
  const ctx = contextoDeAudio();
  if (!ctx || typeof requestAnimationFrame !== 'function') return nada;

  /*
    Un elemento solo se puede enchufar al grafo UNA vez en toda su vida, y al
    hacerlo DEJA DE SONAR POR SU CUENTA: a partir de ahí solo se oye lo que salga
    por donde diga el grafo.

    De ahí el rescate del `catch`, que no es paranoia. Si `createMediaElementSource`
    funciona y luego falla cualquier cosa —crear el analizador, conectarlo—, el
    elemento se queda enchufado a un callejón sin salida y la frase no se oye. Y
    no se enteraría nadie: `play()` resuelve, `currentTime` avanza y el reloj de
    la escena corre igual. Solo que en silencio.

    Así que si algo se tuerce, lo primero es devolver el sonido a la salida y
    renunciar a medirlo. Perder la sincronía de la boca es un detalle; perder el
    audio es perder el ejercicio.
  */
  let fuente: MediaElementAudioSourceNode | null = null;
  let analizador: AnalyserNode;
  try {
    fuente = ctx.createMediaElementSource(audio);
    analizador = ctx.createAnalyser();
    analizador.fftSize = MUESTRAS * 2;
    fuente.connect(analizador);
    analizador.connect(ctx.destination);
  } catch {
    if (fuente) {
      try {
        fuente.disconnect();
        fuente.connect(ctx.destination);
      } catch {
        // Ni eso. Aquí ya no queda nada que hacer desde este lado.
      }
    }
    return nada;
  }

  /*
    Un contexto creado sin un toque previo nace suspendido y no mide nada. Se
    intenta reanudar y no se espera a que conteste: si no puede, el audio suena
    igual —va por el elemento— y lo único que se pierde es la sincronía.
  */
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const muestras = new Uint8Array(analizador.frequencyBinCount);
  let apertura = 0;
  let ultimoAvisado = -1;
  let ultimoAviso = 0;
  let vivo = true;
  let fotograma = 0;

  const mirar = () => {
    if (!vivo) return;
    analizador.getByteTimeDomainData(muestras);
    apertura = suavizar(apertura, amplitudDe(muestras));

    const ahora = performance.now();
    if (
      Math.abs(apertura - ultimoAvisado) >= SALTO_QUE_IMPORTA &&
      ahora - ultimoAviso >= MINIMO_ENTRE_AVISOS
    ) {
      ultimoAvisado = apertura;
      ultimoAviso = ahora;
      alMedir(apertura);
    }

    fotograma = requestAnimationFrame(mirar);
  };

  fotograma = requestAnimationFrame(mirar);

  return () => {
    vivo = false;
    cancelAnimationFrame(fotograma);
    try {
      /*
        Al soltar NO se deja el elemento desconectado: se le devuelve un camino
        recto hasta la salida.

        Un elemento que ya pasó por el grafo no vuelve a sonar solo nunca, así
        que dejarlo suelto sería dejarlo mudo. Normalmente da igual porque quien
        suelta esto también corta el audio, pero atarlo a ese orden es apostar a
        que nadie lo cambie nunca.
      */
      fuente.disconnect();
      analizador.disconnect();
      fuente.connect(ctx.destination);
    } catch {
      // Ya estaba suelto. El contexto se queda abierto para la frase siguiente.
    }
  };
}

/** Solo para las pruebas: tira el contexto compartido. */
export function olvidarContextoDeAudio(): void {
  contexto = null;
}
