import { cn } from '@/lib/cn';
import { CapaAtuendo, ESPECIES, NOMBRE_ATUENDO, type Atuendo, type Especie } from './mascotas';
import { useMascotaEquipada } from '@/lib/mascota-contexto';

export type EstadoMascota =
  | 'neutral'
  | 'feliz'
  | 'celebrando'
  | 'pensando'
  | 'animando'
  | 'escuchando'
  | 'triste'
  | 'sorprendido'
  | 'orgulloso'
  | 'durmiendo';

export type { Atuendo, Especie };

interface Props {
  estado?: EstadoMascota;
  /** Qué animal es. Por defecto Milo, que es quien sale en todas las pantallas. */
  especie?: Especie;
  /** Lo que lleva puesto, si lleva algo. */
  atuendo?: Atuendo | null;
  tamano?: number;
  className?: string;
}

/**
 * La mascota de Speakmi.
 *
 * Este archivo es el esqueleto del movimiento, y solo eso. Las formas de cada
 * animal viven en `mascotas/`, y la razón de separarlo es que el movimiento es
 * lo caro: diez estados, cuatro ritmos de ala, dos parpadeos y cuatro capas que
 * no pueden reiniciarse al cambiar de estado. Copiar eso cinco veces sería
 * garantizar que dentro de un mes cada animal se mueve un poco distinto.
 *
 * Así, una especie nueva es una bolsa de elipses y curvas quietas, y hereda
 * gratis los diez estados y el vestuario entero.
 *
 * Está dibujado con formas simples a propósito. Cada parte se anima por separado
 * según el estado, así que un solo personaje sirve para celebrar, escuchar o
 * pensar sin necesitar seis ilustraciones distintas.
 *
 * El dibujo va por capas, y el orden importa más de lo que parece:
 *
 *   svg          -> el gesto del estado (salta, late, se hunde, presume)
 *   g aliento    -> respirar o dormir, que nunca se detiene salvo al pensar
 *   g cabeza     -> el ladeo ocasional, que no depende del estado, y la ropa
 *   g ojos       -> abrir más, parpadear y mirar, cada uno en su propio nivel
 *
 * Separarlas es lo que hace que cambiar de estado no se vea como un corte:
 * cambiar de «neutral» a «celebrando» solo reinicia la capa de arriba, y el
 * aliento, el ladeo y la mirada siguen donde estaban. Cuando todo colgaba del
 * mismo elemento, cualquier cambio cortaba la respiración a media inspiración.
 */
export function Mascota({ estado = 'neutral', especie, atuendo, tamano = 120, className }: Props) {
  /*
    Sin decir cuál, se usa la que la persona lleva puesta.
    Así ninguna pantalla tiene que acordarse de pasarla: quien compra un gato lo
    ve en todas, y las pruebas de componentes, que no montan el proveedor,
    siguen viendo a Milo sin tocar nada.

    `undefined` y `null` no significan lo mismo en `atuendo`: sin nada es «lo
    que lleve puesto», y `null` expreso es «este sitio va sin ropa», que es lo
    que necesita la tienda para enseñar cómo queda cada prenda.
  */
  const puesto = useMascotaEquipada();
  const cual = especie ?? puesto.especie;
  const prenda = atuendo === undefined ? puesto.atuendo : atuendo;

  const animal = ESPECIES[cual];
  const ojoAbierto = estado !== 'pensando' && estado !== 'durmiendo';
  const alaArriba = estado === 'celebrando' || estado === 'animando';
  // La boca se abre al hablar y también al sorprenderse, que es media sorpresa.
  const picoAbierto = alaArriba || estado === 'sorprendido';
  // Pensando es el único estado quieto de verdad: los demás siempre respiran.
  const enReposoVivo = estado !== 'pensando';

  /**
   * El gesto propio del estado, el único que se reinicia al cambiar.
   *
   * Neutral y feliz no ponen nada aquí a propósito: su movimiento entero es el
   * de las capas de reposo, así que añadir estados nuevos no puede alterarlos.
   */
  const gestoCuerpo =
    estado === 'celebrando'
      ? 'animate-saltito'
      : estado === 'escuchando'
        ? 'animate-latido'
        : estado === 'animando'
          ? 'animate-balanceo'
          : estado === 'triste'
            ? 'animate-desanimo'
            : estado === 'sorprendido'
              ? 'animate-respingo'
              : estado === 'orgulloso'
                ? 'animate-pavoneo'
                : '';

  /**
   * El aliento, en su propia capa.
   *
   * Es el mismo valor para casi todos los estados justo para que React no
   * cambie la clase y el navegador no reinicie el ciclo: al pasar de neutral a
   * celebrando, la mascota sigue respirando en el mismo punto en el que estaba.
   */
  const aliento =
    estado === 'pensando' ? '' : estado === 'durmiendo' ? 'animate-dormir' : 'animate-respirar';

  /**
   * Cómo se mueven las alas según lo que esté haciendo.
   *
   * Cuatro ritmos: aleteo corto al celebrar, saludo amplio y lento al animar,
   * caídas y perezosas al fallar, y un vaivén de tres grados el resto del
   * tiempo, que acompaña a la respiración. Escuchando, pensando y durmiendo se
   * quedan quietas a propósito: en los dos primeros está atento y en el tercero
   * las lleva recogidas.
   */
  const movimientoAla =
    estado === 'celebrando'
      ? 'animate-aletear'
      : estado === 'animando'
        ? 'animate-saludar'
        : estado === 'triste'
          ? 'animate-ala-baja'
          : estado === 'escuchando' || estado === 'pensando' || estado === 'durmiendo'
            ? ''
            : 'animate-ala-calma';

  // El ala cercana es la única que hace algo distinto a la otra, y solo al
  // presumir: se queda en jarras mientras la de atrás sigue con el vaivén.
  const alaEnJarras = estado === 'orgulloso';
  const movimientoAlaCercana = alaEnJarras ? '' : movimientoAla;

  /**
   * Postura fija del ala cuando no hay animación que la mueva.
   *
   * Va por transición y no por fotogramas porque es una pose, no un ciclo: se
   * llega a ella en dos décimas y se queda. Positivo baja el ala, negativo la
   * levanta, igual que en los fotogramas de aletear y saludar.
   */
  const poseAlaCercana = alaEnJarras
    ? 'rotate-[32deg]'
    : estado === 'durmiendo'
      ? 'rotate-[12deg]'
      : !movimientoAla && alaArriba
        ? '-rotate-45'
        : '';

  // Fallar cansa los párpados: mismo parpadeo, pero el ojo tarda en volver.
  const parpadeo = !ojoAbierto
    ? ''
    : estado === 'triste'
      ? 'animate-parpadeo-lento'
      : 'animate-parpadeo';

  // Dormido los párpados caen relajados; pensando se arquean hacia arriba, que
  // es lo que distingue a alguien con los ojos cerrados de alguien dormido.
  const parpados =
    estado === 'durmiendo'
      ? ['M44 40 Q50 45 56 40', 'M64 40 Q70 45 76 40']
      : ['M44 40 Q50 35 56 40', 'M64 40 Q70 35 76 40'];

  return (
    <svg
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      role="img"
      aria-label={prenda ? `${animal.etiqueta}, con ${NOMBRE_ATUENDO[prenda]}` : animal.etiqueta}
      className={cn('select-none', gestoCuerpo, className)}
    >
      {/* Ondas de sonido: solo cuando está escuchando */}
      {estado === 'escuchando' && (
        <g className="text-marca-400">
          <circle
            cx="60"
            cy="62"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.35"
            className="animate-onda"
          />
          <circle
            cx="60"
            cy="62"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
            className="animate-onda"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}

      {/*
        La capa que respira. Envuelve al animal entero menos los adornos, que no
        tienen por qué inflarse con él. El origen es el centro del lienzo porque
        antes la escala colgaba del propio <svg>, y ahí el navegador la aplica
        desde el centro: sin fijarlo, respiraría desde la esquina.
      */}
      <g className={cn('origin-[60px_60px]', aliento)}>
        {/*
          Cola. Se balancea sola: antes era lo único del dibujo que no se movía.
          El giro lo pone esta capa y la forma la pone la especie, porque una
          cola de zorro pesa donde no pesa una de pájaro y pide otro pivote.
        */}
        <g
          className={cn(estado !== 'pensando' && estado !== 'durmiendo' && 'animate-colear')}
          style={{ transformOrigin: animal.origenCola }}
        >
          {animal.cola}
        </g>

        {/* Cuerpo y barriga */}
        {animal.cuerpo}

        {/*
          Los dos miembros de delante. El de la derecha es más pequeño y más
          oscuro: así se lee como el que queda del lado de allá, y el animal deja
          de verse plano. Van desfasados y en sentido contrario, porque dos alas
          perfectamente sincronizadas parecen un mecanismo, no un bicho.
        */}
        <g
          className={cn(
            'origin-[82px_66px] transition-transform duration-300',
            movimientoAla,
            // Dormido las dos alas caen: si solo cayera la cercana, la de atrás
            // se quedaría tiesa y parecería que le pasa algo en el hombro.
            !movimientoAla && estado === 'durmiendo' && 'rotate-[10deg]',
          )}
          style={{ animationDelay: '0.08s', animationDirection: 'reverse' }}
        >
          {animal.alaLejana}
        </g>

        <g
          className={cn(
            'origin-[38px_66px] transition-transform duration-300',
            movimientoAlaCercana,
            // La pose solo se aplica si no hay animación que mover el ala.
            // La clase escribe la propiedad `rotate` y los fotogramas escriben
            // `transform`: no se sustituyen, se suman. Un ala que saluda desde
            // treinta grados no saluda, se disloca.
            !movimientoAlaCercana && poseAlaCercana,
          )}
        >
          {animal.alaCercana}
        </g>

        {/*
          La cabeza y la cara, que se ladean solas cada once segundos.

          No depende del estado y es deliberado: es el gesto que hace que la
          mascota parezca estar atendiendo a algo en vez de esperando a que le
          den cuerda. El origen está en el cuello, no en la cabeza, para que gire
          como si tuviera una y no como una pegatina rotando sobre sí misma.
        */}
        <g
          className={cn(enReposoVivo && 'animate-inclinar-cabeza')}
          style={{ transformOrigin: `60px ${animal.anclajes.cuello}px` }}
        >
          {/* Orejas, penachos o copete: detrás del cráneo para que asomen. */}
          {animal.orejas}

          {/* Cráneo, y lo que va debajo de los ojos: hocico, mejillas, discos. */}
          {animal.cabeza}

          {/*
            Los ojos van en tres capas superpuestas y cada una hace una cosa:
            abrirse, parpadear y mirar.

            Parece un nivel de más, pero abrir los ojos es una pose que llega
            por transición y el parpadeo es un ciclo que no para nunca, y en un
            mismo elemento la animación se queda con la propiedad: mientras
            corre, la transición de esa misma propiedad se ignora y la sorpresa
            aparecería de golpe. En capas, cada una manda en lo suyo.

            Los ojos son idénticos en las cinco especies, y no por pereza: son la
            parte que más se mira y la única con tres ciclos encima. Si cada
            animal moviera los suyos, cada animal tendría su forma de romperse.
          */}
          <g
            className={cn(
              'transition-transform duration-200',
              estado === 'sorprendido' && 'scale-[1.14]',
            )}
            style={{ transformOrigin: '60px 40px' }}
          >
            <g className={cn(parpadeo)} style={{ transformOrigin: '60px 40px' }}>
              <circle cx="50" cy="40" r="9" fill="white" />
              <circle cx="70" cy="40" r="9" fill="white" />

              {/*
                La mirada. Las pupilas se mueven dos píxeles dentro del ojo con
                un ciclo de siete segundos contra los cinco del parpadeo: como
                no coinciden, no se percibe que ambos se repiten.

                Se quedan montadas aunque los ojos estén cerrados y solo se
                apagan. Si se desmontaran, al volver de pensar la mirada
                arrancaría de cero y se notaría el salto.
              */}
              <g
                className={cn(
                  'transition-opacity duration-200',
                  ojoAbierto ? 'animate-mirada opacity-100' : 'opacity-0',
                )}
              >
                <circle
                  cx={estado === 'feliz' ? 51 : 50}
                  cy="41"
                  r="4.5"
                  className="fill-slate-900"
                />
                <circle
                  cx={estado === 'feliz' ? 71 : 70}
                  cy="41"
                  r="4.5"
                  className="fill-slate-900"
                />
                <circle cx="52" cy="39" r="1.6" fill="white" />
                <circle cx="72" cy="39" r="1.6" fill="white" />
              </g>

              {/* Párpados cerrados: arqueados al pensar, caídos al dormir. */}
              <g
                className={cn(
                  'transition-opacity duration-200',
                  ojoAbierto ? 'opacity-0' : 'opacity-100',
                )}
              >
                <path
                  d={parpados[0]}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={parpados[1]}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </g>

          {/*
            La boca. Las dos versiones están siempre puestas y se cruzan en
            opacidad; antes se sustituía una por otra y el pico aparecía de
            golpe justo cuando empezaba a hablar, que es cuando más se ve.
          */}
          <g
            className={cn(
              'transition-opacity duration-200',
              picoAbierto ? 'opacity-0' : 'opacity-100',
            )}
          >
            {animal.bocaCerrada}
          </g>
          <g
            className={cn(
              'transition-opacity duration-200',
              picoAbierto ? 'opacity-100' : 'opacity-0',
            )}
          >
            {animal.bocaAbierta}
          </g>

          {/*
            La ropa, lo último de la capa de la cabeza.

            Cuelga de aquí y no del svg por una razón sola: esta capa es la que
            se ladea, así que el gorro se ladea con ella. Colgado más arriba se
            quedaría clavado mientras la cabeza gira debajo, que es exactamente
            el efecto de pegatina que costó tanto quitar.
          */}
          {prenda && <CapaAtuendo atuendo={prenda} anclajes={animal.anclajes} />}
        </g>

        {/* Patas */}
        {animal.patas}
      </g>

      {/* Estrellitas al celebrar */}
      {estado === 'celebrando' && (
        <g className="fill-acento-400">
          <path
            d="M18 26 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 z"
            className="animate-destello"
          />
          <path
            d="M100 40 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z"
            className="animate-destello"
            style={{ animationDelay: '0.3s' }}
          />
          <path
            d="M96 14 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 z"
            className="animate-destello"
            style={{ animationDelay: '0.6s' }}
          />
        </g>
      )}

      {/*
        Las zetas de dormir. Reutilizan el flotar del cartel de empezar en vez
        de estrenar animación: el gesto es el mismo, subir despacio, y una
        animación menos es una cosa menos que mantener afinada.
      */}
      {estado === 'durmiendo' && (
        <g className="fill-marca-400" aria-hidden="true">
          <text
            x="86"
            y="28"
            fontSize="15"
            fontWeight="700"
            opacity="0.7"
            className="animate-flotar"
          >
            z
          </text>
          <text
            x="99"
            y="15"
            fontSize="10"
            fontWeight="700"
            opacity="0.45"
            className="animate-flotar"
            style={{ animationDelay: '0.7s' }}
          >
            z
          </text>
        </g>
      )}
    </svg>
  );
}

/** La mascota diciendo algo, para las pantallas donde acompaña con un mensaje. */
export function MascotaConMensaje({
  estado = 'neutral',
  // Sin valor por defecto a propósito: poniendo 'PET_MILO' aquí se le pasaría
  // a `Mascota` una especie expresa, y entonces ya no miraría la que la persona
  // lleva puesta. Un defecto puesto por comodidad que anula la elección.
  especie,
  atuendo,
  mensaje,
  tamano = 90,
}: {
  estado?: EstadoMascota;
  especie?: Especie;
  atuendo?: Atuendo | null;
  mensaje: string;
  tamano?: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <Mascota
        estado={estado}
        especie={especie}
        atuendo={atuendo}
        tamano={tamano}
        className="shrink-0"
      />
      <div className="relative mb-4 flex-1 animate-entrada rounded-2xl border-2 border-[var(--borde)] bg-[var(--superficie)] px-4 py-3">
        {/* Pico del bocadillo */}
        <span className="absolute -left-2 bottom-4 size-3 rotate-45 border-b-2 border-l-2 border-[var(--borde)] bg-[var(--superficie)]" />
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}
