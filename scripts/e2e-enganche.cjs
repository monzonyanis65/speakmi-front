/**
 * Las pantallas que enganchan, a 390 px y a 1440: liga, misiones, logros,
 * repaso, lecturas y novedades.
 *
 * Mira tres cosas en cada una: que no haya errores de consola ni respuestas
 * 4xx/5xx, que no se salga a lo ancho, y que lo que tenía que pasar PASÓ —si
 * una pantalla no llegó a pintarse, se anota, porque una pantalla que no se
 * visita no la prueba nadie.
 *
 *   E2E_URL=http://localhost:5173 node <skill>/run.js scripts/e2e-enganche.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.E2E_URL || 'http://localhost:5173';
const CARPETA = process.env.PW_ARTIFACT_DIR || require('node:os').tmpdir();

const incidencias = [];
let pantalla = 'arranque';

function anotar(tipo, detalle) {
  incidencias.push({ pantalla, tipo, detalle });
  console.log(`  [${tipo}] ${pantalla}: ${detalle}`);
}

/** `/auth/refresh` a 401 es el camino normal de quien todavía no ha entrado. */
function esperado(url, estado) {
  return url.includes('/auth/refresh') && estado === 401;
}

function escuchar(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') anotar('consola', m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => anotar('excepcion', String(e.message).slice(0, 240)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !esperado(r.url(), r.status())) {
      anotar('http', `${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`);
    }
  });
}

async function paso(page, nombre, accion) {
  pantalla = nombre;
  console.log(`\n▶ ${nombre}`);
  try {
    await accion();
  } catch (error) {
    anotar('paso-roto', error.message.split('\n')[0]);
  }
  await page.screenshot({ path: path.join(CARPETA, `eng-${nombre}.png`) }).catch(() => {});
}

async function sinDesborde(page) {
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (desborda) {
    const culpables = await page.evaluate(() => {
      const ancho = window.innerWidth;
      return [...document.querySelectorAll('*')]
        .filter((e) => e.getBoundingClientRect().right > ancho + 1)
        .slice(0, 4)
        .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().slice(0, 60)}`);
    });
    anotar('ancho', `se sale a lo ancho; sospechosos: ${culpables.join(' | ')}`);
  }
}

/** Crea una cuenta y deja la sesión abierta. */
async function registrar(page, etiqueta) {
  const correo = `${etiqueta}-${Date.now()}@speakmi.test`;
  const clave = 'unaClaveSegura123';

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /soy nuevo/i })
    .first()
    .click();
  await page.waitForTimeout(400);
  await page.getByLabel(/cómo te llamas|nombre/i).fill('Prueba enganche');
  await page.getByLabel(/correo|email/i).fill(correo);
  const claves = page.locator('input[type="password"]');
  for (let i = 0; i < (await claves.count()); i += 1) await claves.nth(i).fill(clave);
  await page.getByRole('button', { name: /crear/i }).first().click();
  await page.waitForTimeout(2500);

  const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
  if (!sesion || sesion.includes('"usuario":null')) {
    anotar('etapa', 'no se creó la cuenta: lo que viene detrás no prueba nada');
    return null;
  }
  return { correo, clave };
}

/** Elige nivel para salir del embudo de entrada y llegar a la ruta. */
async function elegirNivel(page) {
  await page
    .getByText(/ya sé mi nivel/i)
    .first()
    .click();
  await page.waitForTimeout(1500);
  const tarjetas = page.locator('button').filter({ hasText: /empiezo de cero/i });
  if ((await tarjetas.count()) === 0) {
    anotar('etapa', 'no hay tarjetas de nivel');
    return false;
  }
  await tarjetas.first().click();
  await page.waitForTimeout(1000);
  const confirmar = page.getByRole('button', { name: /^empezar$/i });
  if ((await confirmar.count()) === 0) {
    anotar('etapa', 'elegir un nivel no hace aparecer el botón de empezar');
    return false;
  }
  await confirmar.first().click();
  await page.waitForTimeout(2500);
  if (!page.url().includes('/ruta')) {
    anotar('etapa', `elegir nivel no lleva a la ruta (${page.url()})`);
    return false;
  }
  return true;
}

/**
 * Hace una lección fallándolo todo, desde la propia pestaña y por la API.
 *
 * Por la API y no pinchando por la pantalla a propósito: lo que se prueba aquí
 * son las SEIS pantallas de después, y para que signifiquen algo hace falta una
 * cuenta con una lección hecha, XP, una tarjeta de repaso y una misión cobrada.
 * Recorrer la lección a clics es un camino largo y frágil que, cuando se
 * tuerce, deja todas las pantallas de detrás midiendo una cuenta vacía sin que
 * se note. Yendo por la API, o hay lección o se anota que no la hay.
 *
 * Va desde la pestaña —`page.evaluate`— para que use la MISMA sesión que el
 * navegador: el token vive en memoria del cliente de API, así que se pide uno
 * nuevo con la cookie de refresco, que sí está en el navegador.
 */
async function hacerUnaLeccion(page) {
  await page.goto(`${BASE}/ruta`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const resultado = await page.evaluate(async () => {
    const refresco = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refresco.ok) return { error: `refresh ${refresco.status}` };
    const { accessToken } = await refresco.json();

    const pedir = async (metodo, ruta, cuerpo) => {
      const r = await fetch(`/api${ruta}`, {
        method: metodo,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      });
      return { estado: r.status, json: await r.json().catch(() => null) };
    };

    const niveles = await pedir('GET', '/curriculum/levels');
    const codigoNivel = niveles.json?.[0]?.code ?? niveles.json?.levels?.[0]?.code;
    if (!codigoNivel) return { error: 'no hay niveles' };

    const nivel = await pedir('GET', `/curriculum/levels/${codigoNivel}`);
    const leccion = (nivel.json?.units ?? [])[0]?.lessons?.[0]?.code;
    if (!leccion) return { error: 'no hay lecciones' };

    const ejercicios = (await pedir('GET', `/curriculum/lessons/${leccion}`)).json?.exercises ?? [];
    const inicio = await pedir('POST', '/sessions/start', { lessonCode: leccion });
    if (inicio.estado !== 201) return { error: `start ${inicio.estado}` };

    let respondidos = 0;
    for (const ej of ejercicios.slice(0, 3)) {
      const r = await pedir('POST', `/sessions/${inicio.json.sessionId}/answer`, {
        exerciseCode: ej.code,
        answer: 'zzz-respuesta-que-no-es',
      });
      if (r.estado === 200) respondidos += 1;
    }

    const fin = await pedir('POST', `/sessions/${inicio.json.sessionId}/finish`);
    return { leccion, respondidos, fin: fin.estado, xp: fin.json?.xpEarned };
  });

  if (resultado.error) {
    anotar('etapa', `no se pudo hacer la lección: ${resultado.error}`);
    return 0;
  }
  if (resultado.fin !== 200 || resultado.respondidos === 0) {
    anotar('etapa', `la lección no cuajó: ${JSON.stringify(resultado)}`);
    return 0;
  }

  console.log(
    `    lección ${resultado.leccion}: ${resultado.respondidos} fallos y ${resultado.xp} XP`,
  );
  return resultado.respondidos;
}

async function recorrido(page, ancho) {
  const etiqueta = ancho === 390 ? 'movil' : 'escritorio';

  await paso(page, `${etiqueta}-00-registro`, async () => {
    const cuenta = await registrar(page, `eng${ancho}`);
    if (cuenta) await elegirNivel(page);
  });

  await paso(page, `${etiqueta}-01-leccion`, async () => {
    const contestadas = await hacerUnaLeccion(page);
    if (contestadas < 2) anotar('etapa', `la lección solo avanzó ${contestadas} veces`);
    await page.waitForTimeout(1200);
  });

  for (const [nombre, ruta, comprobar] of [
    [
      '02-misiones',
      '/misiones',
      async () => {
        const texto = await page.locator('body').innerText();
        if (!/\d+\s*\/\s*\d+/.test(texto)) {
          anotar('etapa', 'la pantalla de misiones no enseña ningún progreso «x/y»');
        } else {
          const marcadores = texto.match(/\d+\s*\/\s*\d+/g) ?? [];
          console.log(`    progresos a la vista: ${marcadores.join(', ')}`);
        }
      },
    ],
    [
      '03-liga',
      '/liga',
      async () => {
        const texto = await page.locator('body').innerText();
        if (!/liga|división|clasificaci/i.test(texto)) {
          anotar('etapa', 'la pantalla de liga no habla de la liga');
        }
      },
    ],
    [
      '04-novedades',
      '/novedades',
      async () => {
        const texto = await page.locator('body').innerText();
        if (texto.trim().length < 40) anotar('etapa', 'el muro salió prácticamente vacío');
      },
    ],
    [
      '05-perfil',
      '/perfil',
      async () => {
        const texto = await page.locator('body').innerText();
        if (!/logro|medalla|racha/i.test(texto)) {
          anotar('etapa', 'el perfil no enseña logros ni medallas');
        }
      },
    ],
    [
      '06-repaso',
      '/repaso',
      async () => {
        /*
          Aquí no vale mirar el texto: la pantalla del repaso no dice la palabra
          «repaso» en ninguna parte, así que una comprobación por texto pasaría
          en verde sin haber repasado nada. Se repasa UNA tarjeta de verdad y se
          mira que el contador avance, que es lo que esta pantalla hace.
        */
        const contador = page.locator('text=/^\\d+\\/\\d+$/').first();
        const antes = await contador.innerText().catch(() => '');
        if (!antes) {
          const texto = await page.locator('body').innerText();
          if (/nada que repasar/i.test(texto)) {
            anotar('etapa', 'tras fallar tres ejercicios no hay nada que repasar');
          } else {
            anotar('etapa', `la cola de repaso no se pintó: «${texto.slice(0, 80)}»`);
          }
          return;
        }

        const ver = page.getByRole('button', { name: /ver respuesta/i }).first();
        if (!(await ver.isVisible().catch(() => false))) {
          anotar('etapa', 'la tarjeta no ofrece descubrir la respuesta');
          return;
        }
        await ver.click();
        await page.waitForTimeout(500);

        const bien = page.getByRole('button', { name: /^bien$/i }).first();
        if (!(await bien.isVisible().catch(() => false))) {
          anotar('etapa', 'descubrir la respuesta no ofrece calificarla');
          return;
        }
        await bien.click();
        await page.waitForTimeout(1500);

        const despues = await page.locator('body').innerText();
        if (despues.includes(antes) && !/repaso terminado/i.test(despues)) {
          anotar('etapa', `calificar una tarjeta no avanzó la cola (sigue en ${antes})`);
        } else {
          console.log(`    repasada una tarjeta: la cola pasó de ${antes}`);
        }
      },
    ],
    [
      '07-lecturas',
      '/lecturas',
      async () => {
        const texto = await page.locator('body').innerText();
        if (texto.trim().length < 20) anotar('etapa', 'la pantalla de lecturas salió vacía');
      },
    ],
  ]) {
    await paso(page, `${etiqueta}-${nombre}`, async () => {
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      await sinDesborde(page);
      await comprobar();
    });
  }

  // Una lectura de verdad, que es la única forma de probar /lecturas/:id.
  await paso(page, `${etiqueta}-08-lectura`, async () => {
    await page.goto(`${BASE}/lecturas`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    /*
      Se ESPERA al recuadro en vez de mirar si está tras una pausa fija: la
      pantalla llega en un trozo aparte y en desarrollo tarda lo que tarde. Con
      la pausa fija, una carga lenta se anotaba como «no hay dónde pegar un
      texto», que es dar por roto algo que funciona.
    */
    const area = page.locator('textarea').first();
    try {
      await area.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      anotar('etapa', 'no se encontró dónde pegar un texto en lecturas');
      return;
    }
    await area.fill(
      'The weather was cold yesterday. She walked to the market and bought some bread.',
    );
    const guardar = page
      .getByRole('button', { name: /guardar|crear|añadir|leer|empezar/i })
      .first();
    if (!(await guardar.isVisible().catch(() => false))) {
      anotar('etapa', 'no se encontró el botón de guardar la lectura');
      return;
    }
    await guardar.click();
    await page.waitForTimeout(3000);

    if (!page.url().includes('/lecturas/')) {
      // Puede quedarse en la lista: se abre desde ahí.
      const tarjeta = page
        .locator('a[href^="/lecturas/"], button')
        .filter({ hasText: /weather|prueba|sin t/i })
        .first();
      if (await tarjeta.isVisible().catch(() => false)) {
        await tarjeta.click().catch(() => {});
        await page.waitForTimeout(2500);
      }
    }

    if (!page.url().includes('/lecturas/')) {
      anotar('etapa', `no se llegó a abrir ninguna lectura (${page.url()})`);
      return;
    }
    await sinDesborde(page);
    const texto = await page.locator('body').innerText();
    if (!/weather/i.test(texto)) anotar('etapa', 'la lectura abierta no enseña su texto');
    else console.log('    la lectura abre y enseña su texto');
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const ancho of [390, 1440]) {
    const contexto = await browser.newContext({
      viewport: { width: ancho, height: ancho === 390 ? 844 : 900 },
      permissions: ['microphone'],
    });
    const page = await contexto.newPage();
    escuchar(page);
    try {
      await recorrido(page, ancho);
    } finally {
      await contexto.close();
    }
  }

  await browser.close();

  console.log('\n================ RESUMEN ================');
  if (incidencias.length === 0) console.log('sin incidencias');
  else {
    const porTipo = {};
    for (const i of incidencias) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
    console.log('por tipo:', JSON.stringify(porTipo));
    for (const i of incidencias) console.log(`  [${i.tipo}] ${i.pantalla} :: ${i.detalle}`);
  }
  fs.writeFileSync(
    path.join(CARPETA, 'eng-incidencias.json'),
    JSON.stringify(incidencias, null, 2),
  );
  console.log(`\n(${incidencias.length} incidencias)`);
})();
