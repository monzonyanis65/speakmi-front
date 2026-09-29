import { cn } from '@/lib/cn';
import type { Contraste } from '@/data/fonemas';
import {
  CUANTOS_ENSENAR,
  analizar,
  bandaDeProsodia,
  contarCortes,
  type Corte,
  type EvaluacionFonetica,
  type SonidoFlojo,
} from '@/lib/fonetica';

/**
 * Qué sonido se falló y cómo se hace.
 *
 * Es el salto de «esta palabra te salió mal» a «este sonido te salió mal, y esto
 * es lo que tienes que hacer con la lengua». Lo primero se puede leer mil veces
 * sin mejorar nada, porque no dice qué cambiar; lo segundo es una instrucción.
 *
 * TODO EL DISEÑO DE ESTA PANTALLA SALE DE UN MIEDO: que se lea como una bronca.
 * Un desglose por fonemas es, por naturaleza, una lista de defectos de tu boca,
 * y lo normal al recibirla es cerrar la app. Cuatro decisiones lo evitan, y
 * ninguna es de adorno:
 *
 *   1. Dos sonidos como mucho. El resto, dentro de un desplegable cerrado. No
 *      porque se escondan, sino porque nadie arregla nueve cosas a la vez y una
 *      lista de nueve solo sirve para dar a entender que hablas fatal.
 *   2. Se cuenta primero lo que salió bien, y con número. Casi siempre son la
 *      inmensa mayoría de los sonidos de la frase, y verlo cambia por completo
 *      cómo se lee lo que viene debajo.
 *   3. No hay rojo. El rojo ya está gastado en esta app para «no se te oyó»; un
 *      sonido a medias no es un fallo, es lo siguiente que hay que practicar.
 *   4. Cada tarjeta acaba en una instrucción, no en una nota. Nunca se enseña la
 *      puntuación del fonema: no le dice nada a nadie y solo da qué comparar.
 *
 * Y la regla de los tres estados, que está explicada entera en `lib/fonetica.ts`:
 * `undefined` no pinta nada, `null` dice que no se pudo medir SIN enseñar ningún
 * número, y la lista vacía es una buena noticia.
 */

interface Props extends EvaluacionFonetica {
  /**
   * El texto por palabras, para poder decir dónde cayó un corte.
   *
   * Es opcional porque los cortes se entienden igual sin nombrarlas, y quien
   * llama no siempre tiene la lista a mano.
   */
  palabras?: readonly string[];
}

export function ComoSonaste({ fonemas, cortes, prosodia, palabras }: Props) {
  // Ni fonética ni cortes ni prosodia: este servidor no evalúa esto todavía. Un
  // hueco vacío diciendo «no disponible» sería peor que nada, porque parecería
  // que algo se ha roto.
  if (fonemas === undefined && cortes === undefined && prosodia === undefined) return null;

  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--texto-suave)]">
        Cómo te salieron los sonidos
      </h3>

      {fonemas !== undefined && <Sonidos fonemas={fonemas} />}
      {cortes !== undefined && <Enlaces cortes={cortes} palabras={palabras} />}
      {prosodia !== undefined && <Musica prosodia={prosodia} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Sonidos({ fonemas }: { fonemas: NonNullable<EvaluacionFonetica['fonemas']> | null }) {
  if (fonemas === null) {
    return (
      <SinMedida>
        No pudimos mirar tus sonidos uno a uno en esta toma. No es una nota baja: es que no hay
        medida, y preferimos decírtelo a inventarnos algo.
      </SinMedida>
    );
  }

  const { flojos, total, limpios } = analizar(fonemas);
  const aEnsenar = flojos.slice(0, CUANTOS_ENSENAR);
  const resto = flojos.slice(CUANTOS_ENSENAR);

  if (total === 0 || aEnsenar.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border-2 border-emerald-500 p-4 text-sm text-emerald-800 dark:text-emerald-300">
        {total === 0
          ? 'Medimos los sonidos y no encontramos ninguno para trabajar aquí.'
          : `Los ${total} sonidos de la frase salieron. No hay nada que corregirte esta vez.`}
      </p>
    );
  }

  return (
    <div className="mt-3">
      {/*
        La buena noticia va DELANTE de las tarjetas, y con el número exacto. Es la
        frase que decide si lo de abajo se lee como «tengo dos cosas que pulir» o
        como «hablo fatal», y en casi todos los intentos el número es aplastante a
        favor: veinte sonidos bien y dos regulares.
      */}
      <p className="text-sm">
        <strong>
          {limpios} de {total}
        </strong>{' '}
        sonidos te salieron.{' '}
        {aEnsenar.length === 1 ? 'Quédate con este:' : 'Quédate con estos dos y ya:'}
      </p>

      <div className="mt-3 grid gap-3">
        {aEnsenar.map((flojo) => (
          <Tarjeta key={`${flojo.simbolo}-${flojo.patron?.id ?? ''}`} flojo={flojo} />
        ))}
      </div>

      {resto.length > 0 && (
        /*
          Cerrado de serie, y con el número por fuera para que nadie sienta que se
          le oculta nada. Quien quiera la lista completa la abre; quien acaba de
          leer una frase en alto no tiene por qué encontrársela.
        */
        <details className="mt-3 rounded-2xl border border-[var(--borde)] p-3">
          <summary className="cursor-pointer text-sm text-[var(--texto-suave)]">
            Hubo {resto.length} {resto.length === 1 ? 'sonido más' : 'sonidos más'} a medias. Verlos
          </summary>
          <ul className="mt-2 grid gap-2">
            {resto.map((flojo) => (
              <li key={`${flojo.simbolo}-${flojo.patron?.id ?? ''}`} className="text-sm">
                <span className="font-[var(--font-lectura)] font-bold">/{flojo.simbolo}/</span>{' '}
                <span className="text-[var(--texto-suave)]">
                  {tituloDe(flojo)} · {flojo.palabras.join(', ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--texto-suave)]">
            Están aquí abajo a propósito: nadie arregla cuatro sonidos a la vez, y empezar por los
            dos de arriba arrastra a estos.
          </p>
        </details>
      )}
    </div>
  );
}

/** Cómo se llama en cristiano lo que enseña esta tarjeta. */
function tituloDe(flojo: SonidoFlojo): string {
  // El patrón solo da el título cuando no hay ficha del sonido: si las dos
  // cosas están, manda el sonido, porque el patrón se explica entero al final
  // de la tarjeta y repetirlo arriba diría dos veces lo mismo.
  return flojo.sonido?.nombre ?? flojo.patron?.titulo ?? flojo.simbolo;
}

/**
 * Una ficha.
 *
 * El orden de dentro no es casual: primero DÓNDE pasó (para que se reconozca el
 * momento), luego QUÉ HACER (que es lo único accionable y por eso va en su propia
 * caja), y solo después el porqué y el par mínimo. Quien lee en diagonal se queda
 * con la instrucción, que es exactamente lo que queremos que se lleve.
 *
 * Puede venir sin ficha de sonido y solo con patrón: la /s/ de «school» y la /d/
 * de «and» están bien hechas, lo que falla es lo que la boca hace alrededor. En
 * ese caso la tarjeta es el patrón entero, y no se enseña ningún consejo sobre
 * cómo hacer un sonido que ya se sabe hacer.
 */
function Tarjeta({ flojo }: { flojo: SonidoFlojo }) {
  const { sonido, patron, palabras } = flojo;

  return (
    <article className="rounded-2xl border-2 border-amber-500 p-4">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="font-[var(--font-lectura)] text-2xl font-bold text-amber-700 dark:text-amber-300"
          // El símbolo IPA leído por un lector de pantalla es ruido: la mayoría
          // de voces lo deletrean o lo saltan. El título de al lado ya lo dice.
          aria-hidden
        >
          /{flojo.simbolo}/
        </span>
        <span className="min-w-0 text-sm font-semibold">{tituloDe(flojo)}</span>
      </header>

      <p className="mt-1 break-words text-sm text-[var(--texto-suave)]">
        En{' '}
        <span className="font-[var(--font-lectura)] font-semibold text-[var(--texto)]">
          {palabras.join(', ')}
        </span>
        {sonido && (
          <>
            {' · se oye en '}
            <span className="font-[var(--font-lectura)]">{sonido.ancla}</span>
          </>
        )}
      </p>

      {sonido && (
        <>
          {/* Lo único que se puede hacer ahora mismo con la boca. Va en caja aparte. */}
          <p className="mt-3 rounded-xl bg-[var(--superficie)] p-3 text-sm">{sonido.comoSeHace}</p>

          <p className="mt-2 text-sm text-[var(--texto-suave)]">
            Se te va hacia <strong className="text-[var(--texto)]">{sonido.seConfundeCon}</strong>.{' '}
            {sonido.porQue}
          </p>

          <ParMinimo par={sonido.parMinimo} />
        </>
      )}

      {patron && (
        /*
          El patrón de posición va DESPUÉS del sonido y no en lugar de él, porque
          son dos cosas distintas: una es cómo se hace el sonido y la otra es qué
          le pasa a tu boca en ese sitio de la palabra. Quien se come la d de
          «and» sabe hacer perfectamente una d.
        */
        <div className={cn(sonido && 'mt-3 border-t border-[var(--borde)] pt-3')}>
          {sonido && <p className="text-sm font-semibold">{patron.titulo}</p>}
          <p
            className={cn(
              'rounded-xl bg-[var(--superficie)] p-3 text-sm',
              sonido ? 'mt-1' : 'mt-3',
            )}
          >
            {patron.comoSeHace}
          </p>
          <p className="mt-2 text-sm text-[var(--texto-suave)]">{patron.porQue}</p>
          {!sonido && <ParMinimo par={patron.parMinimo} />}
        </div>
      )}
    </article>
  );
}

function ParMinimo({ par }: { par: Contraste }) {
  return (
    <p className="mt-2 break-words text-sm">
      <span className="font-[var(--font-lectura)] font-semibold">{par.uno}</span>
      <span className="text-[var(--texto-suave)]"> frente a </span>
      <span className="font-[var(--font-lectura)] font-semibold">{par.otro}</span>
      <span className="text-[var(--texto-suave)]"> — {par.loQueCambia}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Los enlaces entre palabras.
 *
 * Lleva explicación larga y no se puede recortar, porque a diferencia de un
 * sonido esto no se sabe que existe: nadie ha oído nunca que el inglés PEGA las
 * palabras. Y decir solo «te sobró un corte» sin contar qué es un corte deja al
 * que lo lee peor que antes, convencido de que falló en algo que ni entiende.
 */
function Enlaces({
  cortes,
  palabras,
}: {
  cortes: NonNullable<EvaluacionFonetica['cortes']> | null;
  palabras?: readonly string[];
}) {
  if (cortes === null) {
    return (
      <SinMedida>
        Los enlaces entre palabras no se pudieron medir en esta toma. Sin medida no hay nota: no la
        contamos ni a favor ni en contra.
      </SinMedida>
    );
  }

  if (cortes.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border-2 border-emerald-500 p-4">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Enlazaste las palabras
        </p>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Las dijiste pegadas, como se dicen. Es lo que separa sonar a inglés de sonar a alguien
          leyendo inglés.
        </p>
      </div>
    );
  }

  const { sobran, faltan } = contarCortes(cortes);

  return (
    /*
      Borde neutro, y no ámbar como las tarjetas de sonido. Tres cajas ámbar
      seguidas convierten la pantalla en un muro de avisos, que es exactamente la
      sensación que esto tiene que evitar. Además, esto no es un fallo tuyo: es
      algo que nadie te ha contado nunca. Se pinta como lo que es, una explicación.
    */
    <div className="mt-3 rounded-2xl border border-[var(--borde)] p-4">
      <p className="text-sm font-semibold">Fuiste palabra por palabra</p>

      <p className="mt-2 text-sm">
        El inglés PEGA las palabras y el español las separa.{' '}
        <span className="font-[var(--font-lectura)]">«What are you doing»</span> no son cuatro
        palabras cuando lo dice un nativo: es{' '}
        <span className="font-[var(--font-lectura)]">«whaddaya doing»</span>, dos golpes.
      </p>

      <p className="mt-2 text-sm text-[var(--texto-suave)]">
        Decirlo en trozos sueltos es correcto y se te entiende. Pero esto no va solo de cómo suenas:
        es LA RAZÓN de que no entiendas a un nativo hablando rápido. Tú esperas cuatro palabras
        separadas y él te da una sola, así que la buscas en la cabeza y no la encuentras. Practicar
        el enlace al hablar es lo que enseña al oído a esperarlo.
      </p>

      <ul className="mt-3 grid gap-1.5">
        {cortes.map((corte, i) => (
          <li key={`${corte.indicePalabra}-${corte.tipo}-${i}`} className="text-sm">
            <UnCorte corte={corte} palabras={palabras} />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm">
        {sobran > 0 && faltan === 0
          ? 'Prueba a decir la frase de un tirón, como si fuera una sola palabra larga, y luego ve separando solo donde de verdad respiras.'
          : faltan > 0 && sobran === 0
            ? 'Junta esas dos palabras sin pausa: la consonante de la primera arranca la vocal de la segunda.'
            : 'Dilo de un tirón donde cortaste, y pega sin pausa donde te faltó el enlace.'}
      </p>
    </div>
  );
}

function UnCorte({ corte, palabras }: { corte: Corte; palabras?: readonly string[] }) {
  const palabra = palabras?.[corte.indicePalabra];
  // Sin la lista de palabras se numera, empezando en uno: «la palabra 0» no se
  // lo dice a nadie más que a un programador.
  const donde = palabra ? (
    <span className="font-[var(--font-lectura)] font-semibold">«{palabra}»</span>
  ) : (
    <>la palabra {corte.indicePalabra + 1}</>
  );

  return corte.tipo === 'sobra' ? (
    <>Cortaste antes de {donde}, y ahí no hay pausa.</>
  ) : (
    <>Faltó el enlace en {donde}: va pegada a la de delante.</>
  );
}

/* ------------------------------------------------------------------ */

function Musica({ prosodia }: { prosodia: number | null }) {
  if (prosodia === null) {
    return (
      <SinMedida>
        La música de la frase no se pudo medir esta vez. Cuando no hay medida no ponemos un número:
        un cero aquí querría decir que lo hiciste fatal, y lo que pasa es que no lo sabemos.
      </SinMedida>
    );
  }

  const { titulo, detalle } = bandaDeProsodia(prosodia);

  return (
    <div className="mt-3 rounded-2xl bg-[var(--superficie)] p-4">
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">{detalle}</p>
      {/*
        El número va detrás del titular y en pequeño. Es un dato real y no se
        esconde, pero puesto en grande se convierte en la nota del examen, y una
        nota no le dice a nadie qué tiene que mover.
      */}
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Música de la frase: {prosodia} sobre 100
      </p>
    </div>
  );
}

/**
 * El aviso de «no se pudo medir».
 *
 * Con borde discontinuo y en gris, igual que el resto de avisos honestos de la
 * app, para que se distinga a simple vista de un resultado. Y sin una sola cifra
 * dentro: la tentación de poner «0 %» aquí es justo lo que hace que la gente se
 * ponga a arreglar algo que a lo mejor ya hacía bien.
 */
function SinMedida({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-3 rounded-2xl border border-dashed border-[var(--borde)] p-3',
        'text-sm text-[var(--texto-suave)]',
      )}
    >
      {children}
    </p>
  );
}
