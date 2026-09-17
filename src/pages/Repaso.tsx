import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { NOMBRE_CATEGORIA } from '@/components/ejercicios/tipos';

interface Tarjeta {
  id: string;
  itemType: string;
  state: string;
  payload: { pregunta: string; respuesta: string; pista?: string; categoria?: string };
}

type Calificacion = 'again' | 'hard' | 'good' | 'easy';

/**
 * Repaso de lo que se falló.
 *
 * Primero se intenta recordar, luego se descubre la respuesta y uno mismo dice
 * qué tal le salió. Esa autoevaluación es la que alimenta el algoritmo: si dices
 * que costó, vuelve pronto; si fue fácil, tarda más en aparecer.
 */
export function Repaso() {
  const navegar = useNavigate();
  const [indice, setIndice] = useState(0);
  const [descubierta, setDescubierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hechas, setHechas] = useState(0);

  const { data, isPending } = useQuery({
    queryKey: ['repasos'],
    queryFn: () => api.get<{ total: number; cards: Tarjeta[] }>('/review/due'),
  });

  const tarjetas = data?.cards ?? [];
  const tarjeta = tarjetas[indice];

  async function calificar(rating: Calificacion) {
    if (!tarjeta) return;
    setEnviando(true);
    try {
      await api.post(`/review/${tarjeta.id}/review`, { rating });
      setHechas(hechas + 1);
      setDescubierta(false);
      setIndice(indice + 1);
    } finally {
      setEnviando(false);
    }
  }

  if (isPending) return <Centrado>Buscando qué repasar…</Centrado>;

  if (tarjetas.length === 0) {
    return (
      <Final
        emoji="☕"
        titulo="Nada que repasar"
        texto="Vuelve más tarde. Lo que falles en las lecciones aparecerá aquí."
        onSalir={() => navegar('/ruta')}
      />
    );
  }

  if (!tarjeta) {
    return (
      <Final
        emoji="✨"
        titulo="Repaso terminado"
        texto={`Repasaste ${hechas} ${hechas === 1 ? 'tarjeta' : 'tarjetas'}. Volverán cuando toque.`}
        onSalir={() => navegar('/ruta')}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navegar('/ruta')}
          aria-label="Salir del repaso"
          className="text-xl text-[var(--texto-suave)]"
        >
          ✕
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--superficie)]">
          <div
            className="h-full rounded-full bg-acento-500 transition-all"
            style={{ width: `${(indice / tarjetas.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-[var(--texto-suave)]">
          {indice + 1}/{tarjetas.length}
        </span>
      </header>

      <div className="mt-12 flex-1">
        {tarjeta.payload.categoria && (
          <span className="rounded-md bg-[var(--superficie)] px-2 py-1 text-xs font-medium text-[var(--texto-suave)]">
            {NOMBRE_CATEGORIA[tarjeta.payload.categoria] ?? tarjeta.payload.categoria}
          </span>
        )}

        <p className="mt-4 font-[var(--font-lectura)] text-xl leading-relaxed">
          {tarjeta.payload.pregunta}
        </p>

        {descubierta ? (
          <div className="mt-8 rounded-2xl bg-[var(--superficie)] p-5">
            <p className="font-[var(--font-lectura)] text-lg font-semibold text-marca-600 dark:text-marca-400">
              {tarjeta.payload.respuesta}
            </p>
            {tarjeta.payload.pista && (
              <p className="mt-2 text-sm text-[var(--texto-suave)]">{tarjeta.payload.pista}</p>
            )}
          </div>
        ) : (
          <p className="mt-8 text-sm text-[var(--texto-suave)]">
            Intenta recordarlo antes de descubrir la respuesta.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 bg-[var(--fondo)] py-4">
        {descubierta ? (
          <>
            <p className="mb-3 text-center text-sm text-[var(--texto-suave)]">¿Qué tal te salió?</p>
            <div className="grid grid-cols-4 gap-2">
              <Boton onClick={() => void calificar('again')} disabled={enviando} tono="fallo">
                Nada
              </Boton>
              <Boton onClick={() => void calificar('hard')} disabled={enviando} tono="aviso">
                Costó
              </Boton>
              <Boton onClick={() => void calificar('good')} disabled={enviando} tono="bien">
                Bien
              </Boton>
              <Boton onClick={() => void calificar('easy')} disabled={enviando} tono="facil">
                Fácil
              </Boton>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDescubierta(true)}
            className="w-full rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700"
          >
            Ver respuesta
          </button>
        )}
      </div>
    </div>
  );
}

function Boton({
  onClick,
  disabled,
  tono,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  tono: 'fallo' | 'aviso' | 'bien' | 'facil';
  children: React.ReactNode;
}) {
  const colores = {
    fallo: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    aviso: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    bien: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    facil: 'bg-marca-100 text-marca-700 dark:bg-marca-900/50 dark:text-marca-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-xl px-2 py-3 text-sm font-medium transition disabled:opacity-50',
        colores[tono],
      )}
    >
      {children}
    </button>
  );
}

function Final({
  emoji,
  titulo,
  texto,
  onSalir,
}: {
  emoji: string;
  titulo: string;
  texto: string;
  onSalir: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 text-center">
      <p className="text-5xl" aria-hidden>
        {emoji}
      </p>
      <h1 className="mt-4 text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-[var(--texto-suave)]">{texto}</p>
      <button
        type="button"
        onClick={onSalir}
        className="mt-8 rounded-2xl bg-marca-600 px-6 py-4 font-semibold text-white transition hover:bg-marca-700"
      >
        Volver a mi ruta
      </button>
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-[var(--texto-suave)]">{children}</p>
    </div>
  );
}
