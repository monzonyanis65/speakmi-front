/**
 * Decir una frase en inglés con la voz del sistema.
 *
 * Se usa el sintetizador del navegador, que es gratis, funciona sin conexión y
 * no gasta cuota de nadie. A cambio, la voz depende del equipo: en un Windows
 * recién instalado puede no haber ninguna en inglés, y por eso todo esto avisa
 * en vez de fallar en silencio.
 */

export function hayVoz(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Las voces tardan en cargar y `getVoices()` devuelve una lista vacía en la
 * primera llamada de muchos navegadores. Se espera al aviso de que ya están.
 */
async function vocesListas(): Promise<SpeechSynthesisVoice[]> {
  const voces = window.speechSynthesis.getVoices();
  if (voces.length) return voces;

  return new Promise((resolver) => {
    const alTerminar = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', alTerminar);
      resolver(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', alTerminar);
    // Si el aviso no llega, se sigue igual con lo que haya.
    setTimeout(alTerminar, 1200);
  });
}

async function mejorVozInglesa(): Promise<SpeechSynthesisVoice | null> {
  const voces = await vocesListas();
  return (
    voces.find((voz) => voz.lang === 'en-US' && voz.localService) ??
    voces.find((voz) => voz.lang === 'en-US') ??
    voces.find((voz) => voz.lang.startsWith('en')) ??
    null
  );
}

export interface OpcionesDecir {
  /** Por debajo de 1 se entiende mejor a quien está empezando. */
  velocidad?: number;
}

/** Lee el texto en voz alta. Resuelve cuando termina, o si no se pudo. */
export async function decir(texto: string, opciones: OpcionesDecir = {}): Promise<void> {
  if (!hayVoz() || !texto.trim()) return;

  // Cortar lo anterior: si alguien pulsa dos veces, no deben solaparse.
  window.speechSynthesis.cancel();

  const voz = await mejorVozInglesa();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = voz?.lang ?? 'en-US';
  frase.rate = opciones.velocidad ?? 0.9;
  if (voz) frase.voice = voz;

  await new Promise<void>((resolver) => {
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      resolver();
    };
    frase.onend = cerrar;
    frase.onerror = cerrar;
    // Chrome se queda a veces sin disparar `onend`. El tope evita que el botón
    // se quede en "reproduciendo" para siempre.
    setTimeout(cerrar, Math.max(4000, texto.length * 120));
    window.speechSynthesis.speak(frase);
  });
}
