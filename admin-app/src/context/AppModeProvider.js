'use client';

import { createContext, useContext } from 'react';

const AppModeContext = createContext(null);

/* El panel opera siempre con datos reales de Supabase. El modo Demo se
   retiró: la gente que prueba el sistema entra con cuentas reales de
   prueba y ve lo que de verdad pasa, no datos inventados.

   Se deja el mismo contrato (`isDemo`, `isLive`, `ready`) para que el
   resto del código —que ya sabía manejar los dos modos— no se toque:
   simplemente toma siempre la rama en vivo. */
export function AppModeProvider({ children }) {
  return (
    <AppModeContext.Provider value={{ mode: 'live', isDemo: false, isLive: true, ready: true }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode debe usarse dentro de AppModeProvider');
  return ctx;
}
