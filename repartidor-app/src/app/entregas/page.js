'use client';

import { useEffect, useState } from 'react';
import RequireSession from '../../components/RequireSession';
import BottomNav from '../../components/BottomNav';
import { useIdioma } from '../../context/IdiomaProvider';
import { Icon, Card, Overline, Button, Chip, EmptyState } from '../../components/ui';
import { useCourierSession } from '../../context/CourierSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import PinEntrega from '../../components/PinEntrega';
import { fetchCourierDeliveries, updateRequestStatus, serviceLabel, SERVICE_ICON } from '../../lib/serviceRequests';

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const STATUS = {
  requested: { clave: 'solicitado', bg: 'var(--surface-container)', fg: 'var(--on-surface-variant)' },
  assigned: { clave: 'porRecoger', bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  picked_up: { clave: 'recogido', bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  in_progress: { clave: 'enCamino', bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  delivered: { clave: 'entregado', bg: 'var(--secondary-container)', fg: 'var(--on-secondary-container)' },
  cancelled: { clave: 'cancelado', bg: 'var(--error-container)', fg: 'var(--on-error-container)' },
};

const NEXT = { assigned: 'picked_up', picked_up: 'in_progress', in_progress: 'delivered' };
const CLAVE_SIGUIENTE = { assigned: 'marcarRecogido', picked_up: 'enCamino', in_progress: 'marcarEntregado' };
const NEXT_ICON = { assigned: 'inventory', picked_up: 'navigation', in_progress: 'task_alt' };

const FILTERS = [
  { id: 'activos', clave: 'activos', match: (s) => ['assigned', 'picked_up', 'in_progress'].includes(s) },
  { id: 'entregados', clave: 'entregados', match: (s) => s === 'delivered' },
  { id: 'todos', clave: 'todos', match: () => true },
];

function EntregasContent() {
  const { t } = useIdioma();
  const { courierProfile, courierId, demoRequests, demoAdvance } = useCourierSession();
  const { isDemo } = useAppMode();
  const [liveItems, setLiveItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('activos');
  const [pinPara, setPinPara] = useState(null);

  const load = () => {
    if (isDemo) return setLoading(false);
    if (!courierProfile?.id) return;
    fetchCourierDeliveries(courierProfile.id).then(setLiveItems).catch(() => setLiveItems([])).finally(() => setLoading(false));
  };
  useEffect(load, [courierProfile?.id, isDemo]);

  const items = isDemo ? demoRequests.filter((r) => r.courier_id === courierId) : liveItems;

  const advance = async (req) => {
    const next = NEXT[req.status];
    if (!next) return;
    // La entrega no se cierra sola: exige el PIN que dicta el cliente.
    if (next === 'delivered' && !isDemo) return setPinPara(req);
    if (isDemo) return demoAdvance(req.id, next);
    const { error } = await updateRequestStatus(req.id, next);
    if (!error) load();
  };

  const q = query.toLowerCase();
  const activeFilter = FILTERS.find((f) => f.id === filter);
  const list = items.filter((d) => activeFilter.match(d.status)).filter((d) =>
    !q || [d.pickup_address, d.dropoff_address, d.contact_name, d.tracking_code].some((v) => v?.toLowerCase().includes(q))
  );

  return (
    <>
      <header className="dx-topbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="dsp" style={{ fontWeight: 800, fontSize: 25 }}>{t('entregas.titulo')}</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 15px', borderRadius: 'var(--sh-full)', background: 'var(--surface-container)' }}>
          <Icon name="search" size={20} color="var(--on-surface-variant)" />
          <input
            placeholder="Cliente, dirección o código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
          />
          {query && <button onClick={() => setQuery('')} style={{ display: 'flex' }}><Icon name="close" size={18} color="var(--on-surface-variant)" /></button>}
        </span>

        <span style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 'var(--sh-xs)', fontSize: 12.5, fontWeight: 700,
                  background: on ? 'var(--secondary-container)' : 'transparent',
                  color: on ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)',
                  border: on ? '1px solid transparent' : '1px solid var(--outline-variant)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {on && <Icon name="check" size={16} />}
                {t(`entregas.${f.clave}`)}
              </button>
            );
          })}
        </span>
      </header>

      <div className="dx-page sc">
        {!loading && list.length === 0 && (
          <EmptyState
            icon="receipt_long"
            title={filter === 'activos' ? t('entregas.sinActivas') : t('entregas.nadaAqui')}
            body={filter === 'activos' ? t('entregas.sinActivasSub') : t('entregas.nadaAquiSub')}
          />
        )}

        {list.map((req) => {
          const st = STATUS[req.status] || STATUS.requested;
          return (
            <Card key={req.id} elevation={1} style={{ padding: 15, marginBottom: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 'var(--sh-sm)', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={SERVICE_ICON[req.service_type] || 'inventory_2'} size={21} color="var(--on-primary-container)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{serviceLabel(req.service_type)}</span>
                  <span className="num" style={{ display: 'block', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    #{req.tracking_code} · {new Date(req.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="num" style={{ fontWeight: 800, fontSize: 17 }}>{money(req.price)}</span>
              </div>

              <div style={{ marginTop: 13, paddingTop: 13, borderTop: '1px solid var(--outline-variant)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', border: '2.5px solid var(--primary)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.pickup_address}</span>
                </div>
                <div style={{ width: 2, height: 12, background: 'var(--outline-variant)', marginLeft: 4 }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.dropoff_address}</span>
                </div>
              </div>

              {/* Servicio Especial y Detalle de Mandado / Encomienda */}
              {(req.servicio_especial && req.servicio_especial !== 'ninguno') && (
                <div style={{ marginTop: 10, padding: '4px 8px', borderRadius: 6, background: '#FFF3C4', color: '#795548', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
                  ★ {req.servicio_especial === 'polarizado' ? 'Vidrios polarizados' : req.servicio_especial === 'bodega' ? 'Con bodega' : req.servicio_especial}
                </div>
              )}

              {(req.instrucciones_detalladas || req.description) && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 'var(--sh-sm)', background: 'var(--surface-container)', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="description" size={14} /> DETALLE E INSTRUCCIONES
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--on-surface)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                    {req.instrucciones_detalladas || req.description}
                  </div>
                </div>
              )}

              {req.contact_phone && ['assigned', 'picked_up', 'in_progress'].includes(req.status) && (
                <a
                  href={`https://wa.me/57${req.contact_phone.replace(/\D/g, '').slice(-10)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 'var(--sh-sm)', background: 'var(--secondary-container)', color: 'var(--on-secondary-container)', fontSize: 12.5, fontWeight: 700 }}
                >
                  <Icon name="chat" size={17} fill />
                  Escribir a {req.contact_name || 'cliente'}
                </a>
              )}

              <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Chip bg={st.bg} color={st.fg}>{t(`entregas.${st.clave}`)}</Chip>
                <span style={{ flex: 1 }} />
                {NEXT[req.status] && (
                  <Button icon={NEXT_ICON[req.status]} onClick={() => advance(req)} style={{ height: 42, padding: '0 16px', fontSize: 13 }}>
                    {t(`entregas.${CLAVE_SIGUIENTE[req.status]}`)}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {pinPara && (
        <PinEntrega
          request={pinPara}
          onClose={() => setPinPara(null)}
          onConfirmado={() => { setPinPara(null); load(); }}
        />
      )}

      <BottomNav badges={{ '/entregas': items.filter((d) => ['assigned', 'picked_up', 'in_progress'].includes(d.status)).length }} />
    </>
  );
}

export default function EntregasPage() {
  return <RequireSession><EntregasContent /></RequireSession>;
}
