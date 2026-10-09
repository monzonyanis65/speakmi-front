/**
 * La tienda de punta a punta, en un navegador de verdad.
 *
 * Lo que se prueba aquí es lo que no puede probar ninguna prueba de unidad: que
 * el dinero que se ve en pantalla es el mismo que tiene el servidor, y que un
 * doble clic en «Comprar» no acaba cobrando dos veces. Cada petición a
 * `/shop/buy` se cuenta una por una, y el saldo se compara contra el que
 * devuelve la API, no contra lo que pinta la pantalla.
 *
 *   node <skill>/run.js scripts/e2e-tienda.cjs
 */

const path = require('node:path');
const { chromium } = require('playwright');
const { Client } = require(
  path.join('C:', 'Users', 'Asus', 'Documents', 'app-ingles', 'back', 'node_modules', 'pg'),
);

const BASE = process.env.E2E_URL || 'http://localhost:5180';
const BD = process.env.E2E_DB || 'postgresql://postgres:12345678@127.0.0.1:5432/bd_ingles';
const CARPETA = process.env.PW_ARTIFACT_DIR || require('node:os').tmpdir();

const incidencias = [];
let pantalla = 'arranque';

function anotar(tipo, detalle) {
  incidencias.push({ pantalla, tipo, detalle });
  console.log(`  [${tipo}] ${pantalla}: ${detalle}`);
}

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
  await page.screenshot({ path: path.join(CARPETA, `tienda-${nombre}.png`) }).catch(() => {});
}

(async () => {
  const bd = new Client({ connectionString: BD });
  await bd.connect();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  /** Las peticiones de compra, contadas una a una. Esto es lo que más duele. */
  const compras = [];
  page.on('request', (r) => {
    if (r.url().includes('/shop/buy') && r.method() === 'POST') {
      compras.push(r.postData() ?? '');
    }
  });

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

  const correo = `e2e-tnd-${Date.now()}@speakmi.test`;
  const clave = 'unaClaveSegura123';
  let userId = null;

  /** El saldo según el SERVIDOR, que es el único que cuenta. */
  async function saldoReal() {
    const filas = await bd.query(
      'SELECT COALESCE(SUM(amount), 0)::int AS total FROM coin_ledger WHERE user_id = $1',
      [userId],
    );
    return filas.rows[0].total;
  }

  async function regalar(cantidad) {
    await bd.query(
      "INSERT INTO coin_ledger (user_id, amount, reason_code) VALUES ($1, $2, 'PRUEBA_E2E')",
      [userId, cantidad],
    );
  }

  /** El saldo que pinta la cabecera de la tienda. */
  async function saldoEnPantalla() {
    const texto = await page.locator('p[aria-label^="Tienes "]').first().getAttribute('aria-label');
    const n = /Tienes (\d+)/.exec(texto ?? '');
    return n ? Number(n[1]) : null;
  }

  async function abrirTienda() {
    await page.goto(`${BASE}/tienda`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
  }

  try {
    await paso(page, '01-registro', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const crear = page.getByRole('button', { name: /soy nuevo|crear cuenta|registr/i }).first();
      if (await crear.isVisible().catch(() => false)) await crear.click();
      await page.waitForTimeout(400);

      await page.getByLabel(/cómo te llamas|nombre/i).fill('Prueba tienda');
      await page.getByLabel(/correo|email/i).fill(correo);
      const claves = page.locator('input[type="password"]');
      const cuantas = await claves.count();
      for (let i = 0; i < cuantas; i += 1) await claves.nth(i).fill(clave);
      await page
        .getByRole('button', { name: /crear|entrar|empezar/i })
        .first()
        .click();
      await page.waitForTimeout(2500);

      // La etapa tiene que haber ocurrido de verdad: sin cuenta no se prueba nada.
      const sesion = await page.evaluate(() => localStorage.getItem('speakmi-sesion'));
      if (!sesion || sesion.includes('"usuario":null')) {
        anotar('sin-sesion', 'no se creó la cuenta: lo que viene detrás no prueba nada');
        return;
      }

      const filas = await bd.query('SELECT id FROM users WHERE email = $1', [correo]);
      userId = filas.rows[0]?.id ?? null;
      if (!userId) anotar('sin-sesion', 'la cuenta no está en la base');
    });

    if (!userId) throw new Error('sin cuenta: se para aquí');

    await paso(page, '02-tienda-vacia', async () => {
      await abrirTienda();
      const enPantalla = await saldoEnPantalla();
      const real = await saldoReal();
      console.log(`  saldo pantalla=${enPantalla} servidor=${real}`);
      if (enPantalla !== real) anotar('saldo', `pantalla ${enPantalla} ≠ servidor ${real}`);

      // Sin saldo, el botón de comprar tiene que estar apagado y decir por qué.
      const boton = page.getByRole('button', { name: /^Comprar Nala/ }).first();
      const apagado = await boton.isDisabled().catch(() => null);
      if (apagado !== true) anotar('sin-saldo', 'el botón de comprar no está apagado sin saldo');
      const antes = compras.length;
      await boton.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      if (compras.length !== antes) {
        anotar('sin-saldo', 'pulsar sin saldo mandó una compra al servidor');
      }
      if ((await saldoReal()) !== real) anotar('sin-saldo', 'el saldo cambió sin comprar');
    });

    await paso(page, '03-comprar-de-verdad', async () => {
      await regalar(1000);
      await abrirTienda();
      if ((await saldoEnPantalla()) !== 1000) {
        anotar('saldo', `tras regalar 1000, la pantalla dice ${await saldoEnPantalla()}`);
      }

      const antes = compras.length;
      await page
        .getByRole('button', { name: /^Comprar Nala/ })
        .first()
        .click();
      await page.waitForTimeout(1500);

      const real = await saldoReal();
      console.log(`  compras enviadas=${compras.length - antes} saldo servidor=${real}`);
      if (real !== 700) anotar('compra', `el servidor dejó ${real} y tenía que dejar 700`);

      const tuyo = await page
        .getByText('Ya es tuyo')
        .first()
        .isVisible()
        .catch(() => false);
      if (!tuyo) anotar('compra', 'el artículo comprado no aparece marcado como tuyo');

      const enPantalla = await saldoEnPantalla();
      if (enPantalla !== real) anotar('saldo', `pantalla ${enPantalla} ≠ servidor ${real}`);
    });

    await paso(page, '04-doble-clic', async () => {
      const antes = compras.length;
      const saldoAntes = await saldoReal();
      const boton = page.getByRole('button', { name: /^Comprar Tuco/ }).first();

      // Dos clics seguidos, sin esperar entre ellos: lo que hace una persona
      // nerviosa cuando la red va lenta.
      await boton.dispatchEvent('click');
      await boton.dispatchEvent('click');
      await boton.dispatchEvent('click');
      await page.waitForTimeout(2500);

      const enviadas = compras.length - antes;
      const real = await saldoReal();
      const gastado = saldoAntes - real;
      console.log(`  peticiones de compra=${enviadas} · gastado=${gastado}`);
      if (gastado !== 300) {
        anotar('doble-clic', `tres clics gastaron ${gastado} monedas (Tuco cuesta 300)`);
      }
      const cuantos = await bd.query(
        "SELECT quantity FROM user_items WHERE user_id = $1 AND item_code = 'PET_PERRO'",
        [userId],
      );
      if ((cuantos.rows[0]?.quantity ?? 0) !== 1) {
        anotar('doble-clic', `quedaron ${cuantos.rows[0]?.quantity} unidades de PET_PERRO`);
      }
    });

    await paso(page, '05-doble-clic-protector', async () => {
      const saldoAntes = await saldoReal();
      await abrirTienda();
      const boton = page.getByRole('button', { name: /^Comprar Protector/ }).first();
      await boton.dispatchEvent('click');
      await boton.dispatchEvent('click');
      await page.waitForTimeout(2500);

      const real = await saldoReal();
      const freezes = await bd.query('SELECT freezes_available FROM streaks WHERE user_id = $1', [
        userId,
      ]);
      const n = freezes.rows[0]?.freezes_available ?? 0;
      const gastado = saldoAntes - real;
      console.log(`  protectores=${n} gastado=${gastado}`);
      // Cada protector cobrado tiene que haberse entregado: ni uno de más ni de menos.
      if (gastado !== n * 100) {
        anotar('doble-clic', `cobró ${gastado} monedas y entregó ${n} protectores`);
      }
    });

    await paso(page, '06-equipar', async () => {
      await abrirTienda();
      await page.getByRole('tab', { name: /tus cosas/i }).click();
      await page.waitForTimeout(800);

      await page
        .getByRole('button', { name: /^Llevar Nala/ })
        .first()
        .click();
      await page.waitForTimeout(1200);

      const filas = await bd.query(
        'SELECT mascot_code, outfit_code FROM user_equipped WHERE user_id = $1',
        [userId],
      );
      const puesta = filas.rows[0]?.mascot_code ?? null;
      console.log(`  mascota equipada en la base=${puesta}`);
      if (puesta !== 'PET_GATO') anotar('equipar', `la base dice ${puesta}, no PET_GATO`);

      const marcado = await page
        .getByRole('button', { name: /Nala, es la que llevas/ })
        .first()
        .isVisible()
        .catch(() => false);
      if (!marcado) anotar('equipar', 'la pantalla no marca la mascota como puesta');
    });

    await paso(page, '07-festival-no-se-vende', async () => {
      await abrirTienda();
      for (const nombre of ['Corona de hojas', 'Antifaz del festival', 'Capa de otoño']) {
        const boton = page.getByRole('button', { name: new RegExp(`^Comprar ${nombre}`) });
        if ((await boton.count()) > 0) {
          anotar('festival', `${nombre} sale con botón de comprar y el servidor lo rechaza`);
        }
      }
    });

    await paso(page, '08-ancho-390', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await abrirTienda();
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (desborde > 0) anotar('ancho', `se desborda ${desborde} px a 390`);

      // Nada se sale del marco por la derecha.
      const fuera = await page.evaluate(() => {
        const limite = document.documentElement.clientWidth;
        return [...document.querySelectorAll('button, article, h1, h2, h3, p')]
          .filter((n) => n.getBoundingClientRect().right > limite + 1)
          .map((n) => `${n.tagName}.${n.className.toString().slice(0, 40)}`)
          .slice(0, 5);
      });
      if (fuera.length > 0) anotar('ancho', `se salen por la derecha: ${fuera.join(' | ')}`);
    });

    await paso(page, '09-ancho-1440', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await abrirTienda();
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (desborde > 0) anotar('ancho', `se desborda ${desborde} px a 1440`);
    });

    await paso(page, '10-botones-vivos', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await abrirTienda();
      const botones = await page.evaluate(() =>
        [...document.querySelectorAll('button')].map((b) => ({
          texto: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 50),
          apagado: b.disabled,
          alto: b.getBoundingClientRect().height,
        })),
      );
      console.log(`  ${botones.length} botones en la tienda`);
      for (const b of botones) {
        if (!b.apagado && b.alto > 0 && b.alto < 44) {
          anotar('tocable', `«${b.texto}» mide ${Math.round(b.alto)} px de alto`);
        }
        if (b.texto === '') anotar('tocable', 'hay un botón sin nombre accesible');
      }
    });
  } catch (error) {
    anotar('fatal', error.message.split('\n')[0]);
  }

  console.log('\n──────── RESUMEN ────────');
  if (incidencias.length === 0) console.log('Sin incidencias.');
  for (const i of incidencias) console.log(`${i.tipo} · ${i.pantalla} · ${i.detalle}`);
  console.log(`Total: ${incidencias.length}`);
  console.log(`Capturas en ${CARPETA}`);

  await bd.query('DELETE FROM users WHERE email = $1', [correo]).catch(() => {});
  await bd.end();
  await browser.close();
})();
