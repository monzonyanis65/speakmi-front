/**
 * El recorrido de alguien que abre Speakmi por primera vez, en un navegador de
 * verdad.
 *
 * Esto NO sustituye a las 2279 pruebas de los dos repos: esas comprueban piezas,
 * y una pieza puede estar perfecta y no encajar con la de al lado. Aquí se
 * recorre lo que recorre una persona —registrarse, elegir nivel, hacer una
 * lección, mirar el menú— con el front y el back de verdad hablando entre ellos,
 * que es justo lo que ninguna prueba de las otras llega a ver.
 *
 * Lo que de verdad busca no son los clics: es lo que se apunta por el camino.
 * Cada error de consola, cada promesa sin capturar y cada petición que vuelve
 * 4xx o 5xx queda anotada con la pantalla en la que pasó. Un fallo así no rompe
 * nada visible —la pantalla se pinta igual— y por eso llega a producción.
 *
 *   node <skill>/run.js scripts/e2e-recorrido.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.E2E_URL || 'http://localhost:5177';
const CARPETA = process.env.PW_ARTIFACT_DIR || require('node:os').tmpdir();

/** Lo que se ha ido rompiendo, con la pantalla en la que pasó. */
const incidencias = [];
let pantalla = 'arranque';

function anotar(tipo, detalle) {
  incidencias.push({ pantalla, tipo, detalle });
  console.log(`  [${tipo}] ${pantalla}: ${detalle}`);
}

/**
 * Peticiones que se esperan rojas y no son un fallo.
 *
 * `/auth/refresh` responde 401 cuando todavía no hay sesión: es el camino normal
 * de quien abre la aplicación por primera vez, no una avería.
 */
const ROJOS_ESPERADOS = [{ ruta: '/auth/refresh', estado: 401 }];

function esperado(url, estado) {
  return ROJOS_ESPERADOS.some((r) => url.includes(r.ruta) && estado === r.estado);
}

async function paso(page, nombre, accion) {
  pantalla = nombre;
  console.log(`\n▶ ${nombre}`);
  try {
    await accion();
  } catch (error) {
    anotar('paso-roto', error.message.split('\n')[0]);
  }
  await page.screenshot({ path: path.join(CARPETA, `e2e-${nombre}.png`) }).catch(() => {});
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    // Para que los ejercicios de voz no pidan permiso y se queden colgados.
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') anotar('consola', m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => anotar('excepcion', String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const motivo = r.failure()?.errorText ?? 'sin motivo';
    if (!motivo.includes('ERR_ABORTED')) anotar('red', `${r.method()} ${r.url()} → ${motivo}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !esperado(r.url(), r.status())) {
      anotar('http', `${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });

  const correo = `e2e-${Date.now()}@speakmi.test`;
  const clave = 'unaClaveSegura123';

  try {
    await paso(page, '01-entrada', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
    });

    await paso(page, '02-registro', async () => {
      // La pantalla de entrada tiene pestañas o un enlace para crear cuenta.
      const crear = page.getByRole('button', { name: /soy nuevo|crear cuenta|registr/i }).first();
      if (await crear.isVisible().catch(() => false)) await crear.click();
      await page.waitForTimeout(400);

      /*
        Se rellenan los campos POR SU ETIQUETA y todos.

        La primera versión de esto rellenaba correo y contraseña y le daba a
        crear, y la cuenta no se creaba: el formulario pide además el nombre
        —«¿Cómo te llamas?», que no contiene la palabra «nombre»— y repetir la
        contraseña. Como la pantalla no se rompe al fallar, el recorrido seguía
        tan contento sin sesión.
      */
      await page.getByLabel(/cómo te llamas|nombre/i).fill('Prueba E2E');
      await page.getByLabel(/correo|email/i).fill(correo);

      const claves = page.locator(
        'input[type="password"], input[name*="clave" i], input[name*="pass" i]',
      );
      const cuantas = await claves.count();
      for (let i = 0; i < cuantas; i += 1) await claves.nth(i).fill(clave);

      await page
        .getByRole('button', { name: /crear|entrar|empezar/i })
        .first()
        .click();
      await page.waitForTimeout(2500);

      /*
        Y comprobar que la sesión existe de verdad.

        Sin esto el recorrido entero sigue adelante sin cuenta: cada pantalla
        rebota a la de entrada, ninguna da error, y el resumen sale limpio
        diciendo que todo va bien. Una prueba que pasa por no haber llegado a
        ejecutarse es peor que una que falla.
      */
      const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
      if (!sesion || !sesion.includes('"usuario"') || sesion.includes('"usuario":null')) {
        anotar('sin-sesion', 'no se creó la cuenta: el resto del recorrido no prueba nada');
      }
    });

    /*
      CADA ETAPA COMPRUEBA QUE LLEGÓ.

      Sin esto el recorrido entero pasaba en verde sin haber hecho nada: la
      cuenta se creaba, la elección de nivel fallaba en silencio y las trece
      pantallas siguientes rebotaban a «¿cómo empiezas?» sin dar un solo error.
      Cero incidencias, y cero probado. Una etapa que no se puede comprobar que
      ocurrió no es una etapa, es una captura de pantalla.
    */
    await paso(page, '03-como-empezar', async () => {
      await page.waitForTimeout(800);
      await page
        .getByText(/ya sé mi nivel/i)
        .first()
        .click();
      await page.waitForTimeout(1500);
      const hayNiveles = await page
        .getByText(/A1|principiante/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (!hayNiveles) anotar('etapa', 'no se abrió la lista de niveles');
    });

    await paso(page, '04-elegir-nivel', async () => {
      /*
        La tarjeta del primer nivel, buscada por su número y no por su texto.

        Buscarla por palabras no vale: las descripciones de los niveles llevan
        dentro «empezar», «continuar» y «nivel», así que un `getByRole('button',
        {name: /empezar/})` se queda con una tarjeta cualquiera en vez de con el
        botón de confirmar. Pasó: seleccionó el nivel 17 y se quedó ahí.
      */
      const tarjetas = page.locator('button').filter({ hasText: /^\s*1\s/ });
      if ((await tarjetas.count()) > 0) await tarjetas.first().click();
      else
        await page
          .locator('button')
          .nth(1)
          .click()
          .catch(() => {});
      await page.waitForTimeout(1000);

      // Y el botón de confirmar, por nombre EXACTO.
      await page.getByRole('button', { name: /^empezar$/i }).click();
      await page.waitForTimeout(3000);

      if (!page.url().includes('/ruta')) {
        anotar('etapa', `elegir nivel no llevó a la ruta (se quedó en ${page.url()})`);
      }
    });

    await paso(page, '05-ruta', async () => {
      await page.goto(`${BASE}/ruta`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      if (
        await page
          .getByText(/ya sé mi nivel/i)
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        anotar('etapa', 'la ruta sigue rebotando a «¿cómo empiezas?»: no hay nivel elegido');
      }
    });

    await paso(page, '06-leccion', async () => {
      /*
        El nodo abierto se reconoce por «es la que toca», que es lo que dice su
        etiqueta accesible. No contiene ni «lección» ni «empezar»: el pastillo
        EMPEZAR que se ve encima es un adorno y ni siquiera es pulsable, así que
        buscar por esas palabras no encontraba nada y el recorrido se quedaba
        mirando la ruta.
      */
      await page
        .getByRole('button', { name: /es la que toca/i })
        .first()
        .click();
      await page.waitForTimeout(3000);
      if (!page.url().includes('/leccion')) {
        anotar('etapa', `no se abrió ninguna lección (sigo en ${page.url()})`);
      }
    });

    await paso(page, '07-ejercicios', async () => {
      /*
        Resolver la lección sin salirse de ella.

        La primera versión pulsaba «cualquier botón de texto corto» y a la
        segunda pantalla le daba a la X de cerrar: el recorrido acababa en el
        menú y el resumen salía limpio, como si los ejercicios se hubieran
        hecho. Por eso aquí hay dos reglas: no se toca nada que suene a salir, y
        al final se comprueba CUÁNTOS se resolvieron. Cero resueltos tiene que
        doler.
      */
      /*
        Lo que no se toca nunca: la X y los botones de volver.

        «Saltar» SÍ se toca: es la salida legítima de un ejercicio que el propio
        aparato no puede hacer —un dictado sin voz inglesa instalada—, y dejarlo
        fuera era lo que paraba el recorrido en 5/9.
      */
      const esSalida = (t, aria) =>
        /^[×✕xX]$/.test(t.trim()) || /salir|cerrar|volver/i.test(`${t} ${aria ?? ''}`);

      let resueltos = 0;

      /*
        Se pulsa de UNA EN UNA y se mira si eso ha desbloqueado «comprobar».

        Pulsar todas las respuestas de golpe no vale: en un ejercicio de
        emparejar, cada par son dos toques en orden —primero la palabra, luego
        su significado— y pulsarlo todo seguido las empareja mal o las
        deselecciona. Así se resolvía cero y la pantalla se quedaba quieta.
      */
      for (let paso = 0; paso < 60; paso += 1) {
        if (!page.url().includes('/leccion')) break;

        const caja = page.getByRole('textbox').first();
        if (await caja.isVisible().catch(() => false)) {
          await caja.fill('it is seven o clock').catch(() => {});
        }

        const avanzar = page
          .getByRole('button', {
            name: /^(comprobar|continuar|siguiente|entendido|terminar)$|^saltar/i,
          })
          .first();

        if (await avanzar.isEnabled().catch(() => false)) {
          await avanzar.click({ timeout: 3000 }).catch(() => {});
          resueltos += 1;
          await page.waitForTimeout(900);
          continue;
        }

        /*
          Todavía no se puede avanzar, así que se contesta.

          Se recogen los botones que siguen ACTIVOS —los ya emparejados se
          apagan— y se pulsan DOS: uno de la primera mitad y otro de la segunda.
          Es literalmente lo que pide el ejercicio de emparejar: «toca una
          palabra de la izquierda y luego su significado».

          Llevar una lista de «ya tocados» no servía: después de hacer un par,
          las palabras que faltaban ya estaban en la lista y el bucle no las
          volvía a tocar. Un par hecho, tres sin hacer y «comprobar» apagado
          para siempre.
        */
        /*
          Contestar lo que haya en pantalla.

          El ejercicio de emparejar tiene dos reglas que hay que respetar, y las
          dos se descubrieron viendo el bucle girar en vacío:

          1. La columna de significados está APAGADA hasta que se toca una
             palabra. Por eso se mira qué hay disponible, se toca uno, y se
             vuelve a mirar: lo que aparece de nuevo son los significados.
          2. Un par hecho se puede DESHACER tocándolo otra vez, y un significado
             ya usado se puede robar para otro par. El bucle hacía las dos cosas
             sin querer: emparejaba y a la vuelta siguiente lo deshacía.

          Así que se salta lo que ya lleva flecha y se lleva la cuenta de qué
          significados están cogidos, leyéndolos de los propios pares hechos.
        */
        const textosDe = async () => {
          const bs = page.locator('button');
          const n = await bs.count();
          const fuera = [];
          const dentro = [];
          for (let i = 0; i < n; i += 1) {
            const b = bs.nth(i);
            const t = ((await b.innerText().catch(() => '')) || '').trim();
            const aria = await b.getAttribute('aria-label').catch(() => '');
            if (!t || t.length > 60) continue;
            if (esSalida(t, aria)) continue;
            if (/^(comprobar|continuar|siguiente|entendido|terminar)$|^saltar/i.test(t)) continue;
            fuera.push(t);
            if (!(await b.isEnabled().catch(() => false))) continue;
            if (!t.includes('→')) dentro.push(t);
          }
          return { libres: dentro, todos: fuera };
        };

        const pulsar = async (texto) => {
          await page
            .getByRole('button', { name: texto, exact: true })
            .first()
            .click({ timeout: 2000 })
            .catch(() => {});
        };

        const antes = await textosDe();
        if (process.env.E2E_VERBOSO) {
          const activo = await avanzar.isEnabled().catch(() => null);
          console.log(`      v${paso}: avanzar=${activo} libres=${JSON.stringify(antes.libres)}`);
        }
        if (antes.libres.length === 0) break;

        await pulsar(antes.libres[0]);
        await page.waitForTimeout(300);

        const despues = await textosDe();
        // Lo que aparece al tocar la palabra son los significados.
        const aparecidos = despues.libres.filter((t) => !antes.libres.includes(t));
        // Y los que ya están cogidos se leen de los pares hechos.
        const cogidos = despues.todos
          .filter((t) => t.includes('→'))
          .map((t) => t.split('→')[1].trim());
        const libre = aparecidos.find((t) => !cogidos.includes(t));
        if (libre) await pulsar(libre);

        await page.waitForTimeout(450);
      }

      if (resueltos < 3) {
        anotar('etapa', `solo se avanzó ${resueltos} veces dentro de la lección`);
      } else {
        console.log(`    se avanzó ${resueltos} veces dentro de la lección`);
      }
    });

    for (const [nombre, ruta] of [
      ['08-menu', '/menu'],
      ['09-perfil', '/perfil'],
      ['10-misiones', '/misiones'],
      ['11-tienda', '/tienda'],
      ['12-juegos', '/juegos'],
      ['13-liga', '/liga'],
      ['14-repaso', '/repaso'],
      ['15-lecturas', '/lecturas'],
      ['16-imitar', '/imitar'],
      ['17-conversar', '/conversar'],
      ['18-ajustes', '/ajustes'],
      ['19-novedades', '/novedades'],
    ]) {
      await paso(page, nombre, async () => {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
      });
    }
  } finally {
    await browser.close();
  }

  console.log('\n================ RESUMEN ================');
  if (incidencias.length === 0) {
    console.log('sin incidencias');
  } else {
    const porTipo = {};
    for (const i of incidencias) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
    console.log('por tipo:', JSON.stringify(porTipo));
    console.log('\ndetalle:');
    for (const i of incidencias) console.log(`  [${i.tipo}] ${i.pantalla} :: ${i.detalle}`);
  }
  fs.writeFileSync(
    path.join(CARPETA, 'e2e-incidencias.json'),
    JSON.stringify(incidencias, null, 2),
  );
  console.log(`\n(${incidencias.length} incidencias · capturas en ${CARPETA})`);
})();
