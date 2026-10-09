/**
 * Lo que el primer recorrido deja fuera.
 *
 * `e2e-recorrido.cjs` sigue el camino de quien se registra y hace una lección.
 * Esto cubre las cuatro cosas que ese camino no toca y que son igual de reales:
 *
 *   · entrar con una cuenta que YA existe, que es lo que hace todo el mundo a
 *     partir del segundo día;
 *   · la prueba de nivel, que son veinticuatro preguntas y decide en qué nivel
 *     empieza alguien —equivocarse ahí se paga durante semanas—;
 *   · los ocho juegos, uno por uno;
 *   · el escritorio. Todo lo demás se mira a 390 px de ancho, y una pantalla
 *     que se rompe a 1440 no la ve nadie hasta que la ve un usuario.
 *
 *   node <skill>/run.js scripts/e2e-mas.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.E2E_URL || 'http://localhost:5177';
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
  await page.screenshot({ path: path.join(CARPETA, `mas-${nombre}.png`) }).catch(() => {});
}

/** Crea una cuenta y deja la sesión abierta. Devuelve sus credenciales. */
async function registrar(page, etiqueta) {
  const correo = `${etiqueta}-${Date.now()}@speakmi.test`;
  const clave = 'unaClaveSegura123';

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /soy nuevo/i })
    .first()
    .click();
  await page.waitForTimeout(400);
  await page.getByLabel(/cómo te llamas|nombre/i).fill('Prueba E2E');
  await page.getByLabel(/correo|email/i).fill(correo);
  const claves = page.locator('input[type="password"]');
  for (let i = 0; i < (await claves.count()); i += 1) await claves.nth(i).fill(clave);
  await page.getByRole('button', { name: /crear/i }).first().click();
  await page.waitForTimeout(2500);

  return { correo, clave };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ---------------------------------------------------------------- móvil
  const movil = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['microphone'],
  });
  const page = await movil.newPage();
  escuchar(page);

  let cuenta = null;

  try {
    await paso(page, '01-registrar', async () => {
      cuenta = await registrar(page, 'mas');
      const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
      if (!sesion || sesion.includes('"usuario":null')) {
        anotar('etapa', 'no se creó la cuenta: lo que viene detrás no prueba nada');
      }
    });

    await paso(page, '02-cerrar-sesion', async () => {
      // Cerrar sesión vive en /menu («Más»), no en ajustes.
      await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const salir = page.getByRole('button', { name: /cerrar sesión|salir/i }).first();
      if (await salir.isVisible().catch(() => false)) {
        await salir.click();
        await page.waitForTimeout(1500);
        // Puede pedir confirmación.
        const si = page.getByRole('button', { name: /sí|confirmar|cerrar/i }).first();
        if (await si.isVisible().catch(() => false)) await si.click();
        await page.waitForTimeout(1500);
      } else {
        anotar('etapa', 'no se encontró cómo cerrar sesión en el menú');
      }
    });

    await paso(page, '03-entrar-de-nuevo', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const yaTengo = page.getByRole('button', { name: /ya tengo cuenta/i }).first();
      if (await yaTengo.isVisible().catch(() => false)) await yaTengo.click();
      await page.waitForTimeout(400);

      await page.getByLabel(/correo|email/i).fill(cuenta.correo);
      await page.locator('input[type="password"]').first().fill(cuenta.clave);
      await page
        .getByRole('button', { name: /entrar/i })
        .first()
        .click();
      await page.waitForTimeout(2500);

      const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
      if (!sesion || sesion.includes('"usuario":null')) {
        anotar('etapa', 'no se pudo volver a entrar con la cuenta recién creada');
      }
    });

    await paso(page, '04-clave-mala', async () => {
      // Lo que tiene que fallar: una clave equivocada. Se comprueba que la
      // aplicación lo CUENTA, porque un 401 sin mensaje deja a alguien mirando
      // una pantalla que no hace nada.
      await page.evaluate(() => localStorage.clear());
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.getByLabel(/correo|email/i).fill(cuenta.correo);
      await page.locator('input[type="password"]').first().fill('clave-que-no-es');
      await page
        .getByRole('button', { name: /entrar/i })
        .first()
        .click();
      await page.waitForTimeout(2000);

      const aviso = await page
        .getByRole('alert')
        .first()
        .innerText()
        .catch(() => '');
      if (!aviso.trim()) anotar('etapa', 'una clave equivocada no enseña ningún aviso');
      else console.log(`    avisa: «${aviso.replace(/\s+/g, ' ').trim().slice(0, 70)}»`);
    });

    await paso(page, '05-prueba-de-nivel', async () => {
      await registrar(page, 'nivel');
      await page.waitForTimeout(800);
      await page
        .getByText(/hazme una prueba/i)
        .first()
        .click();
      await page.waitForTimeout(2000);

      let contestadas = 0;
      for (let i = 0; i < 40; i += 1) {
        if (!page.url().includes('/prueba')) break;

        const avanzar = page
          .getByRole('button', { name: /^(comprobar|continuar|siguiente|terminar)$/i })
          .first();
        if (await avanzar.isEnabled().catch(() => false)) {
          await avanzar.click({ timeout: 3000 }).catch(() => {});
          contestadas += 1;
          await page.waitForTimeout(700);
          continue;
        }

        const caja = page.getByRole('textbox').first();
        if (await caja.isVisible().catch(() => false)) await caja.fill('hello').catch(() => {});

        const botones = page.locator('button');
        const n = await botones.count();
        let toque = false;
        for (let k = 0; k < n; k += 1) {
          const b = botones.nth(k);
          const t = ((await b.innerText().catch(() => '')) || '').trim();
          if (!t || t.length > 60) continue;
          if (/^[×✕]$/.test(t) || /salir|cerrar|volver/i.test(t)) continue;
          if (/^(comprobar|continuar|siguiente|terminar)$/i.test(t)) continue;
          if (t.includes('→')) continue;
          if (!(await b.isEnabled().catch(() => false))) continue;
          await b.click({ timeout: 2000 }).catch(() => {});
          toque = true;
          break;
        }
        if (!toque) break;
        await page.waitForTimeout(400);
      }

      if (contestadas < 5) {
        anotar('etapa', `la prueba de nivel solo avanzó ${contestadas} veces`);
      } else {
        console.log(`    la prueba de nivel avanzó ${contestadas} veces`);
      }
    });

    await paso(page, '06-juegos', async () => {
      await page.goto(`${BASE}/juegos`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      /*
        Las fichas de juego son BOTONES, no enlaces.

        Buscando `a[href^="/juegos/"]` salían cero y parecía que la pantalla no
        ofrecía ninguno. Los ofrecía: Contrarreloj, Parejas, Cadena y los demás,
        cada uno en un botón con su título.
      */
      const titulos = await page.locator('button').evaluateAll((els) =>
        els
          /*
              La primera línea del botón es el icono, que hoy es un emoji, así
              que el título es lo primero que empieza por una letra. Quedarse
              con la línea 0 devolvía «🌧️» como nombre del juego.
            */
          .map((e) =>
            ((e.innerText || '').split(/\r?\n/).find((l) => /^\s*\p{L}/u.test(l)) || '').trim(),
          )
          .filter((t) => t && t.length > 2 && t.length < 30),
      );
      const juegos = [...new Set(titulos)].filter(
        (t) => !/volver|aprender|juegos|liga|tienda|perfil/i.test(t),
      );

      if (juegos.length === 0) anotar('etapa', 'la pantalla de juegos no ofrece ninguno');
      console.log(`    ${juegos.length} juegos encontrados: ${juegos.join(', ')}`);

      for (const titulo of juegos) {
        pantalla = `06-juego-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        await page.goto(`${BASE}/juegos`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        await page
          .getByRole('button', { name: new RegExp(`^${titulo}`, 'i') })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(2000);
        if (!page.url().includes('/juegos/')) {
          /*
            No abrirse puede ser lo correcto: algunos juegos están cerrados
            hasta cierto nivel y lo dicen con un candado y un «se abre en el
            nivel 4». Una cuenta recién hecha es de nivel 1, así que tres de los
            quince no tienen que abrirse. Contarlos como avería sería enseñar a
            no hacer caso del informe.
          */
          const cerrado = await page
            .getByText(new RegExp(`${titulo}[\\s\\S]{0,400}?se abre en el nivel`, 'i'))
            .first()
            .isVisible()
            .catch(() => false);
          if (cerrado) console.log(`    «${titulo}» está cerrado todavía, como debe`);
          else anotar('etapa', `«${titulo}» no abrió ningún juego`);
          continue;
        }
        const empezar = page.getByRole('button', { name: /jugar|empezar|comenzar/i }).first();
        if (await empezar.isVisible().catch(() => false)) {
          await empezar.click().catch(() => {});
          await page.waitForTimeout(2500);
        }
        await page.screenshot({ path: path.join(CARPETA, `mas-${pantalla}.png`) }).catch(() => {});
      }
      pantalla = '06-juegos';
    });
  } finally {
    await movil.close();
  }

  // ------------------------------------------------------------ escritorio
  const escritorio = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
  });
  const grande = await escritorio.newPage();
  escuchar(grande);

  try {
    await paso(grande, '07-escritorio-entrada', async () => {
      await registrar(grande, 'escritorio');
      await grande.waitForTimeout(800);
      await grande
        .getByText(/ya sé mi nivel/i)
        .first()
        .click();
      await grande.waitForTimeout(2000);

      /*
        Primero la tarjeta, DESPUÉS el botón de confirmar.

        El botón de empezar no existe hasta que hay un nivel seleccionado, así
        que esperarlo antes de elegir es esperar para siempre: el paso se caía
        por tiempo y las seis pantallas de escritorio se recorrían sin sesión.
      */
      /*
        La tarjeta se busca por su TÍTULO y no por su número.

        Filtrar por «empieza por 1» funcionaba en móvil y no en escritorio: el
        número vive en un elemento anidado y el texto del botón no siempre
        arranca por él. El título del primer nivel no cambia de sitio.
      */
      const tarjetas = grande.locator('button').filter({ hasText: /empiezo de cero/i });
      if ((await tarjetas.count()) === 0) {
        anotar('etapa', 'no hay tarjetas de nivel en escritorio');
        return;
      }
      await tarjetas.first().click();
      await grande.waitForTimeout(1200);

      const confirmar = grande.getByRole('button', { name: /^empezar$/i });
      if ((await confirmar.count()) === 0) {
        anotar('etapa', 'elegir un nivel no hace aparecer el botón de empezar');
        return;
      }
      await confirmar.first().click();
      await grande.waitForTimeout(3000);

      if (!grande.url().includes('/ruta')) {
        anotar('etapa', `en escritorio, elegir nivel no lleva a la ruta (${grande.url()})`);
      }
    });

    for (const [nombre, ruta] of [
      ['08-escritorio-ruta', '/ruta'],
      ['09-escritorio-menu', '/menu'],
      ['10-escritorio-perfil', '/perfil'],
      ['11-escritorio-tienda', '/tienda'],
      ['12-escritorio-juegos', '/juegos'],
      ['13-escritorio-liga', '/liga'],
    ]) {
      await paso(grande, nombre, async () => {
        await grande.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
        await grande.waitForTimeout(1200);

        /*
          Lo que de verdad se mira en escritorio: que no haya scroll horizontal.
          Es el síntoma de que algo se sale del ancho, y en un móvil no se nota
          porque todo cabe en una columna.
        */
        const desborda = await grande.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        if (desborda) anotar('ancho', 'la página se sale a lo ancho (hay scroll horizontal)');
      });
    }
  } finally {
    await escritorio.close();
    await browser.close();
  }

  console.log('\n================ RESUMEN ================');
  if (incidencias.length === 0) console.log('sin incidencias');
  else {
    const porTipo = {};
    for (const i of incidencias) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
    console.log('por tipo:', JSON.stringify(porTipo));
    for (const i of incidencias) console.log(`  [${i.tipo}] ${i.pantalla} :: ${i.detalle}`);
  }
  fs.writeFileSync(
    path.join(CARPETA, 'mas-incidencias.json'),
    JSON.stringify(incidencias, null, 2),
  );
  console.log(`\n(${incidencias.length} incidencias)`);
})();
