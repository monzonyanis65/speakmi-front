import { describe, expect, it } from 'vitest';
import { amplitudDe, suavizar } from './amplitud';

/**
 * La aritmética de la boca.
 *
 * Es lo único de todo el enganche que se puede probar: el `AnalyserNode` necesita
 * un navegador de verdad y aquí no hay ninguno. A cambio, esto es donde están
 * los errores que no se ven —un silencio que no da cero, una voz que no llega a
 * abrir la boca—, porque en pantalla los dos se leen como «la animación está
 * rara» y nadie sabe decir por qué.
 */

/** Lo que entrega `getByteTimeDomainData` cuando no suena nada: todo a 128. */
function silencio(cuantas = 1024): Uint8Array {
  return new Uint8Array(cuantas).fill(128);
}

/** Una onda de la amplitud que se le pida, en fracción de la escala completa. */
function onda(altura: number, cuantas = 1024): Uint8Array {
  const muestras = new Uint8Array(cuantas);
  for (let i = 0; i < cuantas; i += 1) {
    muestras[i] = Math.round(128 + Math.sin((i / cuantas) * Math.PI * 2 * 16) * 127 * altura);
  }
  return muestras;
}

describe('cuánta voz hay en estas muestras', () => {
  /*
    LA PRUEBA QUE IMPORTA.

    El silencio de una onda es 128, no 0, porque los bytes son la onda desplazada
    a la mitad de la escala. Es la trampa entera de este archivo: midiendo los
    bytes tal cual, el silencio da medio y la mascota se queda con la boca a
    medio abrir para siempre entre frase y frase.

    Comprobada al revés antes de darla por buena: quitando el «- 128» del
    cálculo, el silencio pasa a medir 1 (recortado desde 5) y esta prueba se pone
    roja. Con él, cero.
  */
  it('el silencio no abre la boca ni un poco', () => {
    expect(amplitudDe(silencio())).toBe(0);
  });

  it('una voz alta llega a abrirla del todo', () => {
    // Si esto no llegara cerca del uno, la boca no se abriría nunca: se vería a
    // la mascota masticando en vez de hablando.
    expect(amplitudDe(onda(0.35))).toBeGreaterThan(0.8);
  });

  it('una voz baja la abre poco, pero la abre', () => {
    const floja = amplitudDe(onda(0.05));
    expect(floja).toBeGreaterThan(0);
    expect(floja).toBeLessThan(0.5);
  });

  it('más fuerte es siempre más abierta', () => {
    const escalera = [0.02, 0.06, 0.12, 0.2].map((alto) => amplitudDe(onda(alto)));
    for (let i = 1; i < escalera.length; i += 1) {
      expect(escalera[i]!, `${i} no abre más que ${i - 1}`).toBeGreaterThan(escalera[i - 1]!);
    }
  });

  it('nunca se pasa de uno por muy fuerte que suene', () => {
    // `visemaDeVoz` indexa una escalera de bocas con este número: pasarse de uno
    // se saldría de la lista.
    expect(amplitudDe(onda(1))).toBeLessThanOrEqual(1);
    expect(amplitudDe(onda(1))).toBe(1);
  });

  it('un chasquido suelto no cuenta como voz', () => {
    /*
      Se mide el valor eficaz y no el pico a propósito. Una sola muestra a tope
      —un chasquido del códec, un golpe de aire— dispararía el pico al máximo y
      abriría la boca de par en par en mitad de un silencio.
    */
    const conChasquido = silencio();
    conChasquido[500] = 255;
    expect(amplitudDe(conChasquido)).toBeLessThan(0.2);
  });

  it('sin muestras no se inventa nada', () => {
    expect(amplitudDe(new Uint8Array(0))).toBe(0);
  });
});

describe('cómo se mueve la mandíbula entre fotogramas', () => {
  it('abre más rápido de lo que cierra', () => {
    /*
      Una sílaba empieza de golpe y se apaga poco a poco, y una mandíbula pesa.
      Igualando los dos pesos se pierde el ataque y todo se lee como un zumbido.
    */
    const abriendo = suavizar(0, 1) - 0;
    const cerrando = 1 - suavizar(1, 0);
    expect(abriendo).toBeGreaterThan(cerrando);
  });

  it('siempre va hacia la medida, nunca se pasa', () => {
    expect(suavizar(0, 1)).toBeLessThan(1);
    expect(suavizar(0, 1)).toBeGreaterThan(0);
    expect(suavizar(1, 0)).toBeGreaterThan(0);
    expect(suavizar(1, 0)).toBeLessThan(1);
  });

  it('con la medida quieta acaba llegando a ella', () => {
    let apertura = 0;
    for (let n = 0; n < 40; n += 1) apertura = suavizar(apertura, 0.8);
    expect(apertura).toBeCloseTo(0.8, 2);
  });

  it('un cero suelto a media vocal no cierra la boca de golpe', () => {
    /*
      Una onda pasa por cero decenas de veces por segundo: dentro de una misma
      vocal hay fotogramas que miden casi nada. Sin suavizado la mandíbula
      tiembla en vez de hablar.
    */
    expect(suavizar(0.9, 0)).toBeGreaterThan(0.5);
  });
});
