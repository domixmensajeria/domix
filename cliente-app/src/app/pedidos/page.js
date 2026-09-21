'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '../../components/BottomNav';
import { Row, Pill, Button, Field, EmptyState, Esqueleto } from '../../components/ui';
import { useClientSession } from '../../context/ClientSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import { useIdioma } from '../../context/IdiomaProvider';
import { fetchMyRequests, listDemoRequests, serviceInfo } from '../../lib/services';
import { money } from '../../lib/pricing';

const TONO = {
  requested: 'default',
  assigned: 'navy',
  picked_up: 'navy',
  in_progress: 'navy',
  delivered: 'green',
  cancelled: 'red',
};

const CLAVE_ESTADO = {
  requested: 'recibido',
  assigned: 'asignado',
  picked_up: 'recogido',
  in_progress: 'enCamino',
  delivered: 'entregado',
  cancelled: 'cancelado',
};

export default function ActividadPage() {
  const router = useRouter();
  const { client, ready, saveClient } = useClientSession();
  const { isDemo } = useAppMode();
  const { t } = useIdioma();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (isDemo) {
      setRows(listDemoRequests(client?.phone));
      setLoading(false);
      const t2 = setInterval(() => setRows(listDemoRequests(client?.phone)), 4000);
      return () => clearInterval(t2);
    }
    if (!client?.phone) return setLoading(false);
    fetchMyRequests(client.phone).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [ready, client?.phone, isDemo]);

  const buscar = (e) => {
    e.preventDefault();
    saveClient({ name: client?.name || '', phone });
    setLoading(true);
  };

  const abiertos = rows.filter((r) => !['delivered', 'cancelled'].includes(r.status));

  return (
    <>
      <div className="sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '10px 0 104px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 4px', animation: 'dxSube .34s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ font: '800 26px Manrope,sans-serif', letterSpacing: '-.035em' }}>{t('actividad.titulo')}</div>
        </div>
        <div style={{ padding: '0 16px 20px', font: '500 13px Manrope,sans-serif', color: 'var(--mu)' }}>
          {t('actividad.subtitulo')}
        </div>

        {/* Sin celular no hay nada que buscar. No es registro: es la única
            forma de encontrar los pedidos de alguien que nunca creó cuenta. */}
        {ready && !client?.phone && !isDemo && (
          <div style={{ padding: '0 16px' }}>
            <div style={{ borderRadius: 18, background: 'var(--sf)', padding: 19 }}>
              <div style={{ font: '700 15px Manrope,sans-serif', marginBottom: 5 }}>{t('actividad.consulta')}</div>
              <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginBottom: 15 }}>
                {t('actividad.consultaTexto')}
              </div>
              <form onSubmit={buscar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field required icon="call" type="tel" placeholder="315 792 4906" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button type="submit" icon="search">{t('actividad.verPedidos')}</Button>
              </form>
            </div>
          </div>
        )}

        {/* Siluetas mientras carga: la espera se siente más corta que
            frente a una pantalla vacía. */}
        {loading && client?.phone && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[0, 1, 2].map((i) => <Esqueleto key={i} h={72} r={14} />)}
          </div>
        )}

        {!loading && client?.phone && rows.length === 0 && (
          <EmptyState
            icon="receipt_long"
            title={t('actividad.vacioTitulo')}
            body={t('actividad.vacioTexto')}
            action={<Button full={false} icon="add" onClick={() => router.push('/pedir')}>{t('actividad.pedirAlgo')}</Button>}
          />
        )}

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rows.map((r, i) => {
            const info = serviceInfo(r.service_type);
            const clave = CLAVE_ESTADO[r.status] || 'recibido';
            return (
              <div key={r.id || r.tracking_code} style={{ animation: `dxSube .34s cubic-bezier(.2,.8,.2,1) ${Math.min(i, 6) * 40}ms both` }}>
                <Row
                  image={info.img}
                  title={t(`servicios.${r.service_type}`)}
                  subtitle={r.dropoff_address}
                  onClick={() => router.push(`/seguimiento/${r.tracking_code}`)}
                  right={
                    <span style={{ flex: 'none', textAlign: 'right' }}>
                      <span className="num" style={{ display: 'block', font: '800 15px Manrope,sans-serif', letterSpacing: '-.02em' }}>{money(r.price)}</span>
                      <span style={{ display: 'block', marginTop: 5 }}>
                        <Pill tone={TONO[r.status]}>{t(`actividad.${clave}`)}</Pill>
                      </span>
                    </span>
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav badges={{ '/pedidos': abiertos.length }} />
    </>
  );
}
