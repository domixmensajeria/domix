'use client';

import { createContext, useContext } from 'react';

const AppModeContext = createContext(null);

/* Un repartidor entrega paquetes reales a direcciones reales — no hay
   lugar para datos de prueba aquí. Por eso, a diferencia del panel
   (donde Demo sigue sirviendo para que el dueño del negocio vea el
   sistema sin necesitar pedidos reales), esta app no tiene interruptor:
   siempre opera en vivo, contra Supabase.

   Se deja el mismo contrato (`isDemo`, `isLive`, `ready`) para que el
   resto del código —que ya sabía manejar los dos modos— no tenga que
   tocarse: simplemente toma siempre la rama en vivo. */
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
