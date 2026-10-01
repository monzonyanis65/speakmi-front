import { type Atuendo, type Especie } from '@/components/mascotas';
import { MASCOTA_POR_DEFECTO, type MascotaEquipada } from './mascota-contexto';

/** Lo que manda la cartera del servidor, si es que manda algo con sentido. */
export interface CarteraDelServidor {
  equipped?: { mascota?: string; atuendo?: string | null } | null;
}

/**
 * Qué mascota se lleva puesta, según lo que haya contestado el servidor.
 *
 * Vive fuera del componente a propósito, y no por limpieza: ESTA decisión se
 * puede probar y dentro del componente no. Lo intenté primero ahí y no valía —
 * cuando el render revienta, React descarta ese intento y deja pintado el árbol
 * anterior, así que la prueba miraba el estado bueno de ANTES y pasaba en verde
 * con el fallo delante.
 *
 * Y el fallo era gordo: se leía el campo de la mascota colgando de «equipped»
 * sin comprobar «equipped», con un valor por defecto detrás. Ese valor por
 * defecto protege de que falte la mascota, no de que falte «equipped» entero.
 * Como esto envuelve la aplicación entera, una respuesta sin ese campo no
 * dejaba sin mascota: dejaba TODA la app en blanco.
 */
export function mascotaDe(datos: CarteraDelServidor | undefined): MascotaEquipada {
  if (!datos) return MASCOTA_POR_DEFECTO;

  return {
    especie: (datos.equipped?.mascota as Especie) ?? MASCOTA_POR_DEFECTO.especie,
    atuendo: (datos.equipped?.atuendo as Atuendo | null) ?? null,
  };
}
