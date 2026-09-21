'use client';

import { createContext, useContext } from 'react';

const AppModeContext = createContext(null);

/* Esta es la app de cara al público — un cliente real en Buenaventura
   nunca debería poder cambiar a datos de prueba. Por eso, a diferencia
   del repartidor y el panel (donde Demo sigue sirviendo para mostrar el
   sistema o entrenar gente nueva), aquí no hay interruptor: siempre
   opera en vivo, contra Supabase.

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
