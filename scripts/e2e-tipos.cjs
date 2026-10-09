/**
 * Los once tipos de ejercicio, jugados en un navegador de verdad.
 *
 * `e2e-recorrido.cjs` recorre la aplicación entera pulsando lo que encuentra;
 * esto hace lo contrario: se queda dentro de la lección y contesta A SABIENDAS.
 * Para cada ejercicio se sabe de antemano cuál es la respuesta buena —se lee de
 * `back/content/`— y se comprueba que:
 *
 *   1. se puede contestar y «COMPROBAR» se enciende;
 *   2. acertar dice que acertaste y fallar dice que fallaste;
 *   3. del ejercicio se sale: o se contesta o hay un botón de saltar. Nunca un
 *      callejón sin salida;
 *   4. a 390 px nada desborda a lo ancho.
 *
 * Y sobre todo: CADA ETAPA COMPRUEBA QUE OCURRIÓ. Un tipo que no se llegó a
 * ver se cuenta como «no probado», no como «probado y bien». Si al final no
 * salen los once tipos con su marca, el guion termina en rojo.
 *
 *   node <skill>/run.js scripts/e2e-tipos.cjs
 *
 * Variables: E2E_URL (front), E2E_API (back directo, para preparar el terreno).
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.E2E_URL || 'http://localhost:5179';
const CONTENIDO = path.resolve(__dirname, '../../back/content');
const CARPETA = process.env.PW_ARTIFACT_DIR || require('node:os').tmpdir();
const ANCHO = 390;
/*
  El tope contra el que se mide el desbordamiento. Es el ancho de la pantalla,
  salvo cuando se quiere comprobar que el medidor funciona: con E2E_TOPE=300 y
  la ventana en 390 tiene que protestar en todas las pantallas. Una prueba de
  ancho que nunca se pone roja no mide nada.
*/
const TOPE = Number(process.env.E2E_TOPE || ANCHO);

/** Los once tipos, y qué lección se usa para llegar a cada uno. */
const RECORRIDO = [
  // lección, qué se espera ver en ella (solo para el recuento final)
  { code: 'L1-U1-01' },
  { code: 'L1-U1-02' },
  { code: 'L1-U1-03' },
  { code: 'L1-U1-04' },
  { code: 'L10-U1-01' },
  // Más rompecabezas: es el tipo que más se mira, y uno por lección da poco.
  { code: 'L2-U1-02', previas: ['L2-U1-01'] },
  { code: 'L11-U1-02', previas: ['L11-U1-01'] },
  { code: 'L13-U1-02', previas: ['L13-U1-01'] },
  { code: 'L20-U1-02', previas: ['L20-U1-01'] },
  // Y dos emparejamientos en la misma pantalla, que es donde se vio que el
  // segundo heredaba el orden barajado del primero.
  { code: 'L3-U1-01' },
  { code: 'L4-U1-03', previas: ['L4-U1-01', 'L4-U1-02'] },
  { code: 'L8-U1-05', previas: ['L8-U1-01', 'L8-U1-02', 'L8-U1-03', 'L8-U1-04'] },
];

const TIPOS = [
  'multiple_choice',
  'fill_blank',
  'translate_write',
  'word_order',
  'match_pairs',
  'listen_type',
  'minimal_pair',
  'read_aloud',
  'speak_prompt',
  'dialogue_scene',
  'free_write',
];

/* ------------------------------------------------------------------ */
/* Lo que se va rompiendo                                              */
/* ------------------------------------------------------------------ */

const incidencias = [];
let donde = 'arranque';

function anotar(tipo, detalle) {
  incidencias.push({ donde, tipo, detalle });
  console.log(`    [${tipo}] ${donde}: ${detalle}`);
}

/** Qué se ha llegado a probar de cada tipo. */
const marcas = {};
for (const t of TIPOS) marcas[t] = { visto: 0, acertado: 0, fallado: 0, saltado: 0 };

/* ------------------------------------------------------------------ */
/* El contenido, con las soluciones                                    */
/* ------------------------------------------------------------------ */

function cargarContenido() {
  const porCodigo = new Map();
  for (const f of fs.readdirSync(CONTENIDO).filter((f) => /^L\d+-U\d+\.json$/.test(f))) {
    const j = JSON.parse(fs.readFileSync(path.join(CONTENIDO, f), 'utf8'));
    for (const l of j.lessons || []) for (const e of l.exercises || []) porCodigo.set(e.code, e);
  }
  return porCodigo;
}

/* ------------------------------------------------------------------ */
/* Utilidades de pantalla                                              */
/* ------------------------------------------------------------------ */

/** El botón grande de abajo, sea lo que sea que ponga ahora mismo. */
function botonDeAbajo(page) {
  return page
    .getByRole('button', {
      name: /^(comprobar|continuar|siguiente|terminar|revisando…)$|^saltar/i,
    })
    .first();
}

/** ¿Algo se sale por la derecha a 390 px? */
async function desbordes(page) {
  return page.evaluate((ancho) => {
    const malos = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > ancho + 1 || r.left < -1) {
        const d = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`;
        malos.push(`${d} [${Math.round(r.left)}…${Math.round(r.right)}] «${(el.textContent || '').trim().slice(0, 40)}»`);
      }
    }
    return {
      anchoDoc: document.documentElement.scrollWidth,
      malos: malos.slice(0, 4),
    };
  }, TOPE);
}

/* ------------------------------------------------------------------ */
/* Cómo se contesta cada tipo                                          */
/* ------------------------------------------------------------------ */

/**
 * Pulsa un botón por su texto exacto, el que haga `cual` de los que coincidan.
 *
 * Hace falta `cual` porque en «ordenar» puede haber dos fichas iguales y
 * `first()` pulsaría siempre la misma.
 */
async function pulsarTexto(page, texto, cual = 0) {
  const b = page.getByRole('button', { name: texto, exact: true }).nth(cual);
  await b.click({ timeout: 4000 });
}

/**
 * Contesta el ejercicio en pantalla.
 *
 * `bien` dice si hay que acertar. Devuelve `true` si llegó a contestar algo.
 */
async function contestar(page, servido, bruto, bien) {
  const p = servido.prompt;
  const s = bruto.solution;

  switch (servido.type) {
    case 'multiple_choice': {
      const buena = bruto.prompt.options[s.correctIndex].text;
      const texto = bien ? buena : (p.options.find((o) => o.text !== buena) || {}).text;
      if (!texto) return false;
      await pulsarTexto(page, texto);
      return true;
    }

    case 'dialogue_scene': {
      // La pregunta no sale hasta haber visto la escena entera.
      const siguiente = page.getByRole('button', { name: 'Réplica siguiente' });
      for (let i = 0; i < 20; i += 1) {
        if (!(await siguiente.isEnabled().catch(() => false))) break;
        await siguiente.click().catch(() => {});
        await page.waitForTimeout(120);
      }
      const buena = bruto.prompt.options[s.correctIndex].text;
      const texto = bien ? buena : (p.options.find((o) => o.text !== buena) || {}).text;
      if (!texto) return false;
      const op = page.getByRole('button', { name: texto, exact: true }).first();
      if (!(await op.isVisible().catch(() => false))) {
        anotar('escena', 'la pregunta no apareció después de recorrer toda la escena');
        return false;
      }
      await op.click();
      return true;
    }

    case 'fill_blank': {
      const buena = s.accepted[0];
      if (Array.isArray(p.choices) && p.choices.length > 0) {
        const texto = bien
          ? p.choices.find((c) => s.accepted.some((a) => igual(a, c))) || buena
          : p.choices.find((c) => !s.accepted.some((a) => igual(a, c)));
        if (!texto) return false;
        await pulsarTexto(page, texto);
        return true;
      }
      const caja = page.getByRole('textbox').first();
      await caja.fill(bien ? buena : 'zzzz qqqq');
      return true;
    }

    case 'translate_write':
    case 'listen_type': {
      const caja = page.getByRole('textbox').first();
      if (!(await caja.isVisible().catch(() => false))) return false;
      await caja.fill(bien ? s.accepted[0] : 'zzzz qqqq xxxx');
      return true;
    }

    case 'word_order': {
      const orden = bien ? s.accepted[0] : giro(s.accepted);
      if (!orden) return false;
      const puestas = new Map();
      for (const ficha of orden) {
        const n = puestas.get(ficha) ?? 0;
        // Las fichas ya colocadas siguen siendo botones con el mismo texto, y
        // están ANTES en el documento. Por eso se cuenta cuántas van puestas.
        await pulsarTexto(page, ficha, n);
        puestas.set(ficha, n + 1);
        await page.waitForTimeout(60);
      }
      return true;
    }

    case 'match_pairs': {
      const pares = bien ? s.pairs : intercambiados(s.pairs);
      if (!pares) return false;
      for (let i = 0; i < p.left.length; i += 1) {
        await pulsarTexto(page, p.left[i]);
        await page.waitForTimeout(80);
        await pulsarTexto(page, p.right[pares[i]]);
        await page.waitForTimeout(80);
      }
      return true;
    }

    case 'minimal_pair': {
      const rotulo = (s.same ? bien : !bien) ? 'La misma palabra' : 'Dos palabras distintas';
      const b = page.getByRole('button', { name: rotulo, exact: true }).first();
      if (!(await b.isVisible().catch(() => false))) return false;
      await b.click();
      return true;
    }

    case 'free_write': {
      const caja = page.getByRole('textbox').first();
      if (!(await caja.isVisible().catch(() => false))) return false;
      await caja.fill(
        'Hi Ana, I am writing to tell you about my weekend. I went to the beach with my family and we had lunch there. See you soon.',
      );
      return true;
    }

    default:
      return false;
  }
}

/** ¿Está este ejercicio —y no otro— en pantalla? Se mira por su instrucción. */
async function enPantalla(page, servido) {
  const texto = String(servido.prompt.instruction_es || '').trim();
  if (!texto) return true;
  return page
    .getByText(texto, { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
}

/** ¿Se puede fallar este ejercicio a propósito, con una respuesta concreta? */
function sePuedeFallar(servido, bruto) {
  switch (servido.type) {
    case 'multiple_choice':
    case 'dialogue_scene':
      return servido.prompt.options.length > 1;
    case 'fill_blank':
      return (
        !Array.isArray(servido.prompt.choices) ||
        servido.prompt.choices.some((c) => !bruto.solution.accepted.some((a) => igual(a, c)))
      );
    case 'translate_write':
    case 'listen_type':
    case 'minimal_pair':
      return true;
    case 'word_order':
      return giro(bruto.solution.accepted) !== null;
    case 'match_pairs':
      return bruto.solution.pairs.length > 1;
    default:
      // `free_write` lo corrige un modelo: no hay «mal» que se pueda garantizar.
      return false;
  }
}

const igual = (a, b) =>
  String(a).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() ===
  String(b).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/** Un orden de fichas que NO está entre los aceptados. */
function giro(aceptados) {
  const t = [...aceptados[0]];
  if (t.length < 2) return null;
  const dado = [t[t.length - 1], ...t.slice(0, -1)];
  const clave = (xs) => xs.join(' ').toLowerCase();
  return aceptados.some((a) => clave(a) === clave(dado)) ? null : dado;
}

function intercambiados(pares) {
  if (pares.length < 2) return null;
  const p = [...pares];
  [p[0], p[1]] = [p[1], p[0]];
  return p;
}

/* ------------------------------------------------------------------ */

(async () => {
  const porCodigo = cargarContenido();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: ANCHO, height: 844 },
    permissions: ['microphone'],
  });
  /*
    UN NAVEGADOR SIN VOZ, Y OTRO CON ELLA.

    Chromium sin cabeza no trae ninguna voz instalada, y este equipo tampoco
    tiene voz de servidor configurada. Eso es un caso REAL —es el Android en
    español para el que se escribió todo el plan B del audio— y es el que
    descubre callejones: el dictado y el par mínimo enseñan «mientras tanto,
    sáltalo» y hay que poder saltarlos.

    Pero es solo la mitad. Sin voz esos dos tipos no se contestan nunca, así que
    su corrección no se llega a probar. Con E2E_CON_VOZ=1 se le pone al
    navegador un sintetizador de pega que dice tener inglés: entonces se pintan
    enteros y se pueden contestar como cualquier otro.
  */
  if (process.env.E2E_CON_VOZ) {
    await context.addInitScript(() => {
      class UtteranceFalsa {
        lang = '';
        rate = 1;
        voice = null;
        onend = null;
        onerror = null;
        constructor(texto) {
          this.text = texto;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: UtteranceFalsa });
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [{ lang: 'en-US', name: 'Falsa', localService: true }],
          speak: (frase) => setTimeout(() => frase.onend && frase.onend(), 10),
          cancel: () => {},
          pause: () => {},
          resume: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          speaking: false,
          pending: false,
        },
      });
    });
  }

  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') anotar('consola', m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => anotar('excepcion', String(e.message).slice(0, 200)));

  /** La última corrección que devolvió el servidor, para no fiarse del pintado. */
  let ultimaCorreccion = null;
  page.on('response', async (r) => {
    if (!/\/sessions\/[^/]+\/answer$/.test(new URL(r.url()).pathname)) return;
    if (r.status() !== 200) {
      const cuerpo = await r.text().catch(() => '');
      anotar('http', `${r.status()} al corregir: ${cuerpo.slice(0, 220)}`);
      return;
    }
    ultimaCorreccion = await r.json().catch(() => null);
  });

  /**
   * Pulsa COMPROBAR y comprueba que la corrección llegó y dice lo que debe.
   *
   * No se fía del pintado ni del servidor por separado: mira la respuesta del
   * servidor Y que el panel de corrección enseñe su mensaje. Devuelve `false`
   * si hubo que anotar algo, para que quien llama no dé el ejercicio por bueno.
   */
  async function comprobar(page, servido, bien) {
    const t = servido.type;
    const boton = botonDeAbajo(page);
    if (!(await boton.isEnabled().catch(() => false))) {
      anotar('boton', 'se contestó entero y «COMPROBAR» sigue apagado');
      return false;
    }
    await boton.click();
    // Escribir libre lo corrige un modelo por la red: tarda bastante más.
    const espera = servido.type === 'free_write' ? 45000 : 6000;
    for (let i = 0; i < espera / 300 && ultimaCorreccion === null; i += 1) {
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(400);

    if (ultimaCorreccion === null) {
      anotar('correccion', 'se pulsó COMPROBAR y no llegó ninguna corrección');
      return false;
    }
    /*
      Escribir libre lo corrige un modelo contra la consigna, así que aquí no
      hay «la respuesta buena»: lo que se prueba es que se pueda escribir, que
      la corrección llegue y que se enseñe. Exigirle un acierto sería exigirle
      al guion que escribiera bien en inglés sobre lo que pida cada consigna.
    */
    if (t !== 'free_write' && ultimaCorreccion.isCorrect !== bien) {
      anotar(
        'correccion',
        bien
          ? `la respuesta BUENA del contenido sale mal: «${ultimaCorreccion.feedback.message_es}»`
          : 'una respuesta MALA se dio por buena',
      );
      return false;
    }

    const panel = await page.getByRole('status').first().innerText().catch(() => '');
    if (!panel.includes(ultimaCorreccion.feedback.message_es)) {
      anotar('correccion', `el panel no enseña lo que dijo el servidor: «${panel.slice(0, 70)}»`);
      return false;
    }

    if (marcas[t]) marcas[t][t === 'free_write' || bien ? 'acertado' : 'fallado'] += 1;
    return true;
  }

  const correo = `tipos-${Date.now()}@speakmi.test`;
  const clave = 'unaClaveSegura123';
  let token = null;

  try {
    /* --- 1. una cuenta, por la pantalla de siempre ------------------ */
    donde = 'registro';
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const crear = page.getByRole('button', { name: /soy nuevo|crear cuenta|registr/i }).first();
    if (await crear.isVisible().catch(() => false)) await crear.click();
    await page.waitForTimeout(400);
    await page.getByLabel(/cómo te llamas|nombre/i).fill('Probador de tipos');
    await page.getByLabel(/correo|email/i).fill(correo);
    const claves = page.locator('input[type="password"]');
    for (let i = 0; i < (await claves.count()); i += 1) await claves.nth(i).fill(clave);
    await page.getByRole('button', { name: /crear|entrar|empezar/i }).first().click();
    await page.waitForTimeout(2500);

    const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
    if (!sesion || sesion.includes('"usuario":null')) {
      anotar('sin-sesion', 'no se creó la cuenta: nada de lo que sigue probaría nada');
      throw new Error('sin cuenta');
    }

    // El token, para preparar el terreno sin pasar por la pantalla.
    const refresco = await context.request.post(`${BASE}/api/auth/refresh`);
    token = (await refresco.json()).accessToken;
    if (!token) {
      anotar('sin-token', 'no se pudo refrescar la sesión: no se pueden abrir lecciones lejanas');
      throw new Error('sin token');
    }

    const api = (metodo, ruta, cuerpo) =>
      context.request.fetch(`${BASE}/api${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(cuerpo ? { data: cuerpo } : {}),
      });

    /* --- 2. abrir camino hasta las lecciones raras ------------------ */
    // Las lecciones van en orden dentro de su nivel, así que para llegar a la
    // que tiene `free_write` hay que haber terminado las de antes. Se hacen por
    // la API, bien y deprisa: lo que se prueba a mano es la lección de destino.
    donde = 'preparar';
    const yaHechas = new Set();
    for (const { code, previas } of RECORRIDO) {
      for (const previa of previas || []) {
        if (previa === code || yaHechas.has(previa)) continue;
        yaHechas.add(previa);
        const ini = await api('POST', '/sessions/start', { lessonCode: previa });
        if (!ini.ok()) {
          anotar('preparar', `no abre ${previa}: ${ini.status()}`);
          continue;
        }
        const sid = (await ini.json()).sessionId;
        const lec = await (await api('GET', `/curriculum/lessons/${previa}`)).json();
        for (const ej of lec.exercises) {
          const bruto = porCodigo.get(ej.code);
          if (!bruto) continue;
          const r = respuestaApi(ej, bruto);
          if (r === null) continue;
          await api('POST', `/sessions/${sid}/answer`, {
            exerciseCode: ej.code,
            answer: r,
            timeMs: 1000,
          });
        }
        await api('POST', `/sessions/${sid}/finish`);
      }
    }

    /* --- 3. las lecciones, una por una, a mano --------------------- */
    for (const { code } of RECORRIDO) {
      donde = code;
      console.log(`\n▶ ${code}`);

      const lec = await (await api('GET', `/curriculum/lessons/${code}`)).json();
      if (!lec.exercises) {
        anotar('leccion', `no se pudo leer la lección: ${JSON.stringify(lec).slice(0, 120)}`);
        continue;
      }

      await page.goto(`${BASE}/leccion/${code}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const cerrada = await page
        .getByText(/no pudimos abrir|todavía|antes de esta/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (cerrada) {
        anotar('leccion', 'la lección está cerrada para esta cuenta');
        continue;
      }

      /*
        DOS PASADAS, Y LA SEGUNDA ES LA REPESCA.

        Acertar a la primera pasa al siguiente ejercicio y ya no hay forma de
        probar el fallo sin volver a empezar la lección. Así que en la primera
        pasada se FALLA a propósito todo lo que se puede fallar, y lo fallado
        vuelve a salir al final —eso es la repesca— y es ahí donde se acierta.
        Con una sola lección se prueban las dos correcciones, el orden de la
        repesca y el aviso de «esta la fallaste antes».
      */
      const fallados = [];

      for (let n = 0; n < lec.exercises.length; n += 1) {
        const servido = lec.exercises[n];
        const bruto = porCodigo.get(servido.code);
        donde = servido.code;
        const t = servido.type;
        if (marcas[t]) marcas[t].visto += 1;

        await page.waitForTimeout(400);

        /*
          Que en pantalla esté EL EJERCICIO QUE TOCA.

          Sin esto, un ejercicio que no avanza deja al guion contestando el
          anterior y apuntándose aciertos que no ha hecho. Se reconoce por su
          instrucción, que es lo único que siempre se ve y es suyo.
        */
        if (!(await enPantalla(page, servido))) {
          anotar('desincronizado', 'la pantalla no enseña este ejercicio: se deja la lección');
          break;
        }

        // 4. Que no desborde a lo ancho.
        const d = await desbordes(page);
        if (d.anchoDoc > TOPE) {
          anotar('ancho', `el documento mide ${d.anchoDoc} px y el tope es ${TOPE}: ${d.malos.join(' · ')}`);
        }

        /*
          ¿El propio ejercicio reconoce que aquí no se puede hacer?

          Entonces TIENE que haber por dónde salir sin abandonar la lección.
          Ese fue el callejón que ya apareció una vez: un dictado en un equipo
          sin voz inglesa decía «mientras tanto, sáltalo» y la única salida era
          la X. Lo que se mira no es el aviso, es el botón de abajo: vale
          saltar, y vale TERMINAR cuando es el último.
        */
        const avisoImposible = await page
          .getByText(/sáltalo|puedes saltar este ejercicio|no se puede oír/i)
          .first()
          .isVisible()
          .catch(() => false);
        const salida = (await botonDeAbajo(page).innerText().catch(() => '')).trim();
        const haySalida = /^(saltar|terminar|continuar)/i.test(salida);

        if (avisoImposible || /^saltar/i.test(salida)) {
          if (!haySalida) {
            anotar(
              'callejon',
              `dice que aquí no se puede hacer y abajo solo hay «${salida}»: no se sale`,
            );
          } else {
            if (marcas[t]) marcas[t].saltado += 1;
            console.log(`    ${servido.code} [${t}] saltado: «${salida}»`);
          }
          await botonDeAbajo(page).click().catch(() => {});
          await page.waitForTimeout(900);
          continue;
        }

        if (!bruto) {
          anotar('contenido', 'el servidor sirve un ejercicio que no está en content/');
          await botonDeAbajo(page).click().catch(() => {});
          await page.waitForTimeout(900);
          continue;
        }

        const aFallar = sePuedeFallar(servido, bruto);
        const bien = !aFallar;

        ultimaCorreccion = null;
        const contesto = await contestar(page, servido, bruto, bien).catch((e) => {
          anotar('contestar', `${bien ? 'acertando' : 'fallando'}: ${String(e.message).split('\n')[0]}`);
          return false;
        });

        if (!contesto) {
          anotar('callejon', 'no hay forma de contestar este ejercicio ni de saltarlo');
          await botonDeAbajo(page).click().catch(() => {});
          await page.waitForTimeout(900);
          continue;
        }

        if (!(await comprobar(page, servido, bien))) continue;
        if (aFallar) fallados.push(servido);

        await botonDeAbajo(page).click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      /* --- la repesca: ahora se acierta --------------------------- */
      for (const servido of fallados) {
        donde = `${servido.code} (repesca)`;
        const bruto = porCodigo.get(servido.code);
        await page.waitForTimeout(500);

        // Que esto es DE VERDAD la repesca, y no que el guion se quedó mirando
        // otra pantalla. Sin esta comprobación, media prueba sería decorado.
        const avisa = await page
          .getByText(/esta la fallaste antes/i)
          .first()
          .isVisible()
          .catch(() => false);
        if (!avisa || !(await enPantalla(page, servido))) {
          anotar('repesca', 'no se volvió a preguntar lo fallado: no hay repesca que probar');
          break;
        }

        ultimaCorreccion = null;
        const contesto = await contestar(page, servido, bruto, true).catch(() => false);
        if (!contesto) {
          anotar('repesca', 'no se pudo volver a contestar');
          break;
        }
        await comprobar(page, servido, true);
        await botonDeAbajo(page).click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: path.join(CARPETA, `tipos-${code}.png`) }).catch(() => {});
    }
  } catch (e) {
    anotar('guion-roto', String(e.message).split('\n')[0]);
  } finally {
    await browser.close();
  }

  /* --- recuento ---------------------------------------------------- */
  console.log('\n================ TIPOS ================');
  let sinProbar = 0;
  for (const t of TIPOS) {
    const m = marcas[t];
    const ok = m.acertado > 0 || m.saltado > 0;
    if (!ok) sinProbar += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'NADA'} ${t.padEnd(16)} visto ${m.visto}  acertado ${m.acertado}  fallado ${m.fallado}  saltado ${m.saltado}`,
    );
  }

  console.log('\n================ INCIDENCIAS ================');
  if (incidencias.length === 0) console.log('  ninguna');
  const porTipo = {};
  for (const i of incidencias) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
  console.log('  ' + JSON.stringify(porTipo));
  for (const i of incidencias.slice(0, 60)) console.log(`  [${i.tipo}] ${i.donde} :: ${i.detalle}`);

  fs.writeFileSync(
    path.join(CARPETA, 'e2e-tipos.json'),
    JSON.stringify({ marcas, incidencias }, null, 2),
  );

  if (sinProbar > 0) {
    console.log(`\n${sinProbar} tipos no se llegaron a probar: esto NO es un verde.`);
    process.exitCode = 1;
  }
})();

/** La respuesta buena en el formato de la API, para abrir camino sin pantalla. */
function respuestaApi(servido, bruto) {
  const s = bruto.solution;
  switch (servido.type) {
    case 'multiple_choice':
    case 'dialogue_scene': {
      const buena = bruto.prompt.options[s.correctIndex].text;
      const i = servido.prompt.options.findIndex((o) => o.text === buena);
      return i < 0 ? null : i;
    }
    case 'fill_blank':
    case 'translate_write':
    case 'listen_type':
      return s.accepted[0];
    case 'word_order':
      return s.accepted[0];
    case 'match_pairs':
      return s.pairs;
    case 'minimal_pair':
      return s.same ? 0 : 1;
    default:
      return null;
  }
}
