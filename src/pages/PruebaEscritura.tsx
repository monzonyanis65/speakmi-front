import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ejercicio } from '@/components/ejercicios/Ejercicio';
import type { Correccion, Respuesta } from '@/components/ejercicios/tipos';

/**
 * Banco de pruebas de escribir libre.
 *
 * Existe por lo mismo que `/vivo` y `/shadowing`: la pantalla de verdad vive
 * dentro de una lección, y para llegar a ella hacen falta cuenta, sesión,
 * servidor y una clave del modelo. Para mirar cómo queda el recuadro a 320 px
 * con el teclado abierto, eso es media hora de trámite cada vez.
 *
 * Va sin sesión, como los otros dos, y monta el componente REAL a través del
 * mismo `Ejercicio` que usa la lección: si aquí se ve bien y allí no, es que
 * este banco estaba mintiendo.
 *
 *   /escritura              la consigna de A1, sin corregir
 *   /escritura?nivel=c1     la de C1, que va sin palabras de apoyo
 *   /escritura?corregido=1  con la corrección ya puesta y un punto sin cubrir
 */

const CONSIGNAS = {
  a1: {
    code: 'L2-U2-05-E04',
    type: 'free_write',
    difficulty: 2,
    prompt: {
      instruction_es: 'Escribe el mensaje. Cuatro o cinco frases bastan.',
      situacion_es:
        'Un compañero de tu clase de inglés te pregunta por tu hermana. Le contestas por mensaje.',
      puntos_es: [
        'En qué trabaja tu hermana y dónde.',
        'Una cosa que hace ella en ese trabajo todos los días.',
        'Una pregunta para él sobre el trabajo de alguien de su familia.',
      ],
      apoyo: ['downtown', 'office', 'every day', 'starts', 'customers'],
    },
  },
  c1: {
    code: 'L18-U2-06-E06',
    type: 'free_write',
    difficulty: 5,
    prompt: {
      instruction_es: 'Escribe tu mensaje en el canal.',
      situacion_es:
        'Tu jefa acaba de proponer en el canal del equipo adelantar la entrega dos semanas. Tú no lo ves, y lo que escribas lo lee el equipo entero, ella incluida.',
      puntos_es: [
        'Reconoce la parte de su propuesta que sí te parece razonable.',
        'Di lo que no ves, sin presentarlo como un hecho cerrado.',
        'Propón otra salida dejándole a ella la última palabra.',
      ],
    },
  },
};

/** Una corrección con un punto sin cubrir, que es el caso que más ocupa. */
const CORREGIDO: Correccion = {
  isCorrect: false,
  score: 2 / 3,
  feedback: {
    message_es: 'Te falta el punto 2.',
    correcta: 'My sister works in an office downtown. Does your brother work near you?',
    errores: [
      {
        category: 'verb_tense',
        expected: 'she works',
        actual: 'she work',
        severity: 3,
        explicacion_es: '«she work» → «she works». Con she el verbo lleva -s.',
      },
    ],
    puntos: [
      { cubierto: true },
      { cubierto: false, porQue_es: 'No llega a decir qué hace ella cada día en ese trabajo.' },
      { cubierto: true },
    ],
  },
};

export function PruebaEscritura() {
  const [parametros] = useSearchParams();
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  const corregido = parametros.get('corregido') === '1';
  const ejercicio = parametros.get('nivel') === 'c1' ? CONSIGNAS.c1 : CONSIGNAS.a1;

  return (
    <main className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-2xl font-bold">Escribir libre</h1>

        <div className="mt-6">
          <Ejercicio
            ejercicio={ejercicio}
            bloqueado={corregido}
            onCambio={setRespuesta}
            resultado={corregido ? CORREGIDO : null}
          />
        </div>

        {/* Lo que la lección mandaría al servidor, para verlo sin abrir la consola. */}
        <p className="mt-6 text-xs text-[var(--texto-suave)]">
          Respuesta: {respuesta === null ? '(nada todavía)' : String(respuesta)}
        </p>
      </div>
    </main>
  );
}
