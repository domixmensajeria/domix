'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCourierSession } from '../context/CourierSessionProvider';
import Login from '../components/Login';
import { Spinner } from '../components/ui';

/* Puerta de entrada de la flota: siempre con celular y clave reales,
   contra Supabase. No hay modo de prueba aquí — un repartidor que
   entrega de verdad no debería poder confundirse con datos falsos. */
export default function EntrarPage() {
  const router = useRouter();
  const { session, loading, selectCourier } = useCourierSession();

  useEffect(() => {
    if (!loading && session) router.replace('/home');
  }, [loading, session, router]);

  const entrarConSesion = async (sesion) => {
    await selectCourier(sesion.id, sesion);
    router.replace('/home');
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <Login
      titulo="App de repartidores"
      subtitulo="Entra con tu celular y la clave que te dio Domix"
      rolesPermitidos={['courier']}
      onEntrar={entrarConSesion}
    />
  );
}
