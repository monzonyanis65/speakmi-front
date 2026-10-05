import { useCallback, useEffect, useMemo, useState } from 'react';
import { callar, decir } from '@/lib/voz';
import { idiomaDeCada } from '@/lib/idioma';

/**
 * Que al tocar una opción se oiga cómo se pronuncia.
 *
 * La aplicación ya sabía hablar —`decir()` lleva meses sonando en los dictados
 * y en los pares mínimos— pero en los ejercicios de elegir no sonaba nada. Se
 * tocaba «reading» y se seguía sin saber si eso se dice «rí-ding» o «ré-ading».
 *
 *
 * LAS CUATRO REGLAS, Y DE DÓNDE SALEN
 *
 * 1. SOLO SI ESTÁ EN INGLÉS. Lo decide `idioma.ts`, y cuando duda se calla. Una
 *    voz inglesa leyendo «Porque todavía no ha encontrado apartamento» no es un
 *    audio raro: es la misma pronunciación inventada que `voz.ts` lleva desde
 *    el principio negándose a reproducir.
 *
 * 2. AL TOCAR, NO AL PASAR POR ENCIMA. Quien ya se sabe la palabra toca y
 *    responde; un sonido que salta al rozar con el dedo mientras se recorre la
 *    lista convierte cuatro opciones en cuatro interrupciones. Y por eso mismo
 *    esto no devuelve ninguna promesa que haya que esperar: la respuesta se
 *    registra en el mismo toque, suene o no suene, y el botón de comprobar
 *    nunca se queda esperando a un audio.
 *
 * 3. NO SE SOLAPA. `decir()` ya corta lo anterior en cada llamada, así que
 *    tocar cinco opciones seguidas deja oír la quinta y no las cinco a la vez.
 *    Lo que faltaba era callar al SALIR: el audio del servidor es un archivo
 *    sonando y no se para solo al cambiar de ejercicio.
 *
 * 4. SE PUEDE APAGAR, Y SE RECUERDA AQUÍ. El interruptor vive en este aparato
 *    y no en la cuenta, por lo mismo que el sonido de los juegos (ver
 *    `preferencias.ts`): que algo suene o no es una decisión del SITIO donde
 *    estás —el portátil del trabajo con gente al lado— y no de la persona.
 *
 * Lo que NO se mira es `prefers-reduced-motion`, que sí apaga los pitidos de
 * los juegos. Aquel ajuste pide menos estímulo y un pitido de acierto es
 * adorno; esto es el contenido del curso. Quien lo tenga puesto no ha pedido
 * dejar de oír inglés, y el dictado tampoco deja de sonar por eso.
 */

export const CLAVE_DECIR_OPCIONES = 'speakmi.opciones.voz';

/**
 * Nace encendido.
 *
 * Es lo que se pidió y es lo que hace Duolingo; apagado habría que descubrirlo
 * en los ajustes para enterarse de que existe, y nadie busca un ajuste de algo
 * que no sabe que hay. Apagarlo son dos toques.
 */
function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE_DECIR_OPCIONES) !== 'no';
  } catch {
    // Navegación privada o cookies bloqueadas: se queda encendido esta sesión.
    return true;
  }
}

let encendido = leerPreferencia();

/** Quien esté pintando el interruptor, para que se entere si cambia. */
const oyentes = new Set<(valor: boolean) => void>();

export function decirOpcionesEncendido(): boolean {
  return encendido;
}

export function encenderDecirOpciones(valor: boolean): void {
  encendido = valor;
  if (!valor) callar();
  try {
    localStorage.setItem(CLAVE_DECIR_OPCIONES, valor ? 'si' : 'no');
  } catch {
    // Sin memoria local el ajuste dura lo que dure la pestaña. Peor es no
    // dejar apagarlo.
  }
  for (const oyente of oyentes) oyente(valor);
}

/** Para el interruptor de los ajustes. */
export function useDecirOpciones(): { encendido: boolean; cambiar: (valor: boolean) => void } {
  const [valor, setValor] = useState(encendido);

  useEffect(() => {
    oyentes.add(setValor);
    // Puede haber cambiado entre el primer pintado y este efecto.
    setValor(encendido);
    return () => {
      oyentes.delete(setValor);
    };
  }, []);

  return { encendido: valor, cambiar: encenderDecirOpciones };
}

/** Solo para las pruebas: vuelve a lo que diga el almacenamiento. */
export function olvidarPreferenciaDeOpciones(): void {
  encendido = leerPreferencia();
  oyentes.clear();
}

/**
 * El altavoz de un grupo de opciones.
 *
 * Recibe el grupo entero y no cada opción por separado porque el idioma se
 * decide mirando a todas juntas: una sola opción con marca rescata a las que no
 * tienen ninguna. Ver `idiomaDeCada`.
 *
 * `contexto` es la frase que las opciones vienen a completar, cuando la hay. En
 * un hueco las opciones son «in / to / of», palabras que no delatan ningún
 * idioma, y lo que lo delata es la frase inglesa que las rodea.
 */
export function useAltavozDeOpciones(
  opciones: readonly string[],
  contexto?: string,
): (texto: string) => void {
  /*
    La clave es el contenido, no el array.

    Quien llama construye la lista en cada pintado —`prompt.options.map(...)`—
    así que comparar por identidad recalcularía el idioma de cada opción en cada
    tecla pulsada. Con el contenido como dependencia solo se recalcula cuando
    de verdad cambian las opciones, que es al cambiar de ejercicio.
  */
  const clave = `${contexto ?? ''}\u0000${opciones.join('\u0000')}`;

  const inglesas = useMemo(() => {
    const idiomas = idiomaDeCada(opciones, contexto);
    return new Set(opciones.filter((_, i) => idiomas[i] === 'ingles'));
    // La clave resume `opciones` y `contexto`; ver el comentario de arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Al salir del ejercicio no puede quedarse una frase sonando encima del
  // siguiente. Ver la regla 3.
  useEffect(() => () => callar(), []);

  return useCallback(
    (texto: string) => {
      if (!encendido) return;
      if (!inglesas.has(texto)) return;
      /*
        Se lanza y se olvida. Si falla —sin voz inglesa, sin servidor, el
        navegador negándose a sonar sin gesto previo— no pasa nada: la opción ya
        está elegida y el ejercicio sigue igual. Un `await` aquí sería atar el
        poder responder a que haya altavoces.
      */
      void decir(texto).catch(() => undefined);
    },
    [inglesas],
  );
}
