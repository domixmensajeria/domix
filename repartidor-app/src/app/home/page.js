'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import RequireSession from '../../components/RequireSession';
import BottomNav from '../../components/BottomNav';
import { useIdioma } from '../../context/IdiomaProvider';
import IncomingOffer from '../../components/IncomingOffer';
import PinEntrega from '../../components/PinEntrega';
import MapView from '../../components/MapView';
import ModeSwitch from '../../components/ModeSwitch';
import { Icon, Card, HeroCard, Overline, Button, Chip, StatTile, EmptyState, Spinner, Switch } from '../../components/ui';
import { useCourierSession } from '../../context/CourierSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import { fetchNearbyRequests, fetchTodayEarnings, fetchCourierDeliveries, acceptRequest, updateRequestStatus, serviceLabel, SERVICE_ICON } from '../../lib/serviceRequests';
import { money, etaMinutes } from '../../lib/pricing';
import { requestNotificationPermission, notificationPermission, pushNotify } from '../../lib/notify';
import { routeBetween } from '../../lib/geo';

const ACTIVE = ['assigned', 'picked_up', 'in_progress'];

// Cuánto esperar antes de volver a ofrecer un pedido que se venció, y
// cuánto silenciarlo si el repartidor lo rechazó a propósito.
const REOFRECER_MS = 60 * 1000;
const RECHAZO_MS = 60 * 60 * 1000;
const NEXT = { assigned: 'picked_up', picked_up: 'in_progress', in_progress: 'delivered' };
const CLAVE_SIGUIENTE = { assigned: 'yaLoRecogi', picked_up: 'voyEnCamino', in_progress: 'entregado' };

function HomeContent() {
  const { t } = useIdioma();
  const { profile, courierProfile, setOnlineStatus, courierId, demoRequests, demoAccept, demoAdvance, demoInject } = useCourierSession();
  const { isDemo } = useAppMode();

  const [live, setLive] = useState([]);
  const [offer, setOffer] = useState(null);
  const [route, setRoute] = useState([]);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState('default');
  const [pinPara, setPinPara] = useState(null);
  const seen = useRef(new Map());
  const [latido, setLatido] = useState(0);

  const isOnline = courierProfile?.status === 'online';

  useEffect(() => { setPerm(notificationPermission()); }, []);

  /* ---- Origen de datos según el modo ---- */
  const rows = isDemo ? demoRequests : live;
  const mine = rows.filter((r) => r.courier_id === courierId);
  const active = mine.filter((r) => ACTIVE.includes(r.status));
  const open = rows.filter((r) => r.status === 'requested');
  const today = new Date().toDateString();
  const deliveredToday = mine.filter((r) => r.status === 'delivered' && r.delivered_at && new Date(r.delivered_at).toDateString() === today);
  const earnings = deliveredToday.reduce((s, r) => s + Number(r.price || 0) + Number(r.tip || 0), 0);

  const loadLive = useCallback(async () => {
    if (isDemo || !courierId) return;
    try {
      const [mineRows, openRows] = await Promise.all([
        fetchCourierDeliveries(courierId),
        isOnline ? fetchNearbyRequests({}) : Promise.resolve([]),
      ]);
      setLive([...mineRows, ...openRows.filter((o) => !mineRows.some((m) => m.id === o.id))]);
    } catch { /* sin red */ } finally { setLoading(false); }
  }, [isDemo, courierId, isOnline]);

  useEffect(() => { if (isDemo) setLoading(false); else loadLive(); }, [isDemo, loadLive]);
  useEffect(() => {
    if (isDemo || !isOnline) return;
    const t = setInterval(loadLive, 10000);
    return () => clearInterval(t);
  }, [isDemo, isOnline, loadLive]);

  /* ---- Un pedido nuevo abre la oferta a pantalla completa ----
     `seen` guarda hasta cuándo NO volver a ofrecer cada pedido. Un pedido
     que se venció vuelve tras una pausa corta: si el repartidor iba
     manejando y no alcanzó a aceptar, no se puede quedar tirado. Uno que
     rechazó a propósito no vuelve en toda la sesión. */
  useEffect(() => {
    if (!isOnline || offer) return;
    const ahora = Date.now();
    const fresh = open.find((r) => {
      const hasta = seen.current.get(r.id);
      return hasta === undefined || ahora >= hasta;
    });
    if (fresh) {
      seen.current.set(fresh.id, ahora + RECHAZO_MS);
      setOffer(fresh);
    }
  }, [open, isOnline, offer, latido]);

  /* Se revisa cada tanto para que un pedido en pausa vuelva a ofrecerse
     aunque no haya entrado ningún pedido nuevo que dispare el efecto. */
  useEffect(() => {
    if (!isOnline) return;
    const t = setInterval(() => setLatido((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [isOnline]);

  /* ---- Ruta del pedido activo, para el mapa de seguimiento ---- */
  const current = active[0];
  useEffect(() => {
    let alive = true;
    if (!current?.pickup_point || !current?.dropoff_point) return setRoute([]);
    routeBetween(current.pickup_point, current.dropoff_point).then((r) => alive && setRoute(r.coords));
    return () => { alive = false; };
  }, [current?.id, current?.pickup_point, current?.dropoff_point]);

  const toggle = async () => { setToggling(true); await setOnlineStatus(!isOnline); setToggling(false); };

  const accept = async (req) => {
    setOffer(null);
    if (isDemo) return demoAccept(req.id);
    const { error } = await acceptRequest(req.id, courierId);
    if (!error) loadLive();
  };

  const advance = async (req) => {
    const next = NEXT[req.status];
    if (!next) return;
    if (isDemo) {
      demoAdvance(req.id, next);
      if (next === 'delivered') pushNotify(t('inicio.entregaCompletada'), { body: t('inicio.sumadosATuDia', { monto: money(req.price) }), tag: `fin-${req.id}` });
      return;
    }
    // El último paso no se hace con un toque: sin el PIN que dicta el
    // cliente, cualquiera podría marcar "entregado" sin haber entregado
    // nada. Esta pantalla tenía ese atajo suelto — la de Entregas ya lo
    // hacía bien, aquí se une al mismo candado.
    if (next === 'delivered') return setPinPara(req);
    const { error } = await updateRequestStatus(req.id, next);
    if (!error) loadLive();
  };

  const simulate = async (turbo = false) => {
    if (perm !== 'granted') setPerm(await requestNotificationPermission());
    const req = demoInject({ turbo });
    seen.current.set(req.id, Date.now() + RECHAZO_MS);
    setOffer(req);
  };

  const inits = ((profile?.first_name?.[0] || 'D') + (profile?.last_name?.[0] || '')).toUpperCase();

  return (
    <>
      <header className="dx-topbar">
        <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary-container)', color: 'var(--on-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flex: 'none' }}>
          {inits}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dsp" style={{ fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('inicio.hola', { nombre: profile?.first_name || '' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--on-surface-variant)', fontWeight: 600, marginTop: 1 }}>
            <Icon name="star" size={13} fill color="var(--tertiary)" />
            <span className="num">{Number(courierProfile?.rating || 5).toFixed(1)}</span>
            <span style={{ opacity: .5 }}>·</span>
            <Icon name="location_on" size={13} fill color="var(--primary)" />
            {courierProfile?.work_zone || 'Centro'}
          </div>
        </div>
        <span style={{ flex: 'none' }}><ModeSwitch compact /></span>
      </header>

      <div className="dx-page sc">
        <HeroCard glow={isOnline ? 'green' : 'orange'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Overline style={{ color: 'rgba(255,255,255,.55)' }}>{t('inicio.ganadoHoy')}</Overline>
            <Chip icon="two_wheeler" bg="rgba(255,255,255,.12)" color="#A9D98F">
              {courierProfile?.total_deliveries || 0} entregas
            </Chip>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span className="num" style={{ fontWeight: 800, fontSize: 36, letterSpacing: '-.03em' }}>{money(earnings)}</span>
            {deliveredToday.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: '#A9D98F' }}>{deliveredToday.length} hoy</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.13)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 'var(--sh-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: isOnline ? 'rgba(123,198,83,.22)' : 'rgba(255,255,255,.1)' }}>
              <Icon name={isOnline ? 'bolt' : 'bedtime'} size={19} fill color={isOnline ? '#A9D98F' : 'rgba(255,255,255,.6)'} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{isOnline ? t('inicio.enLinea') : t('inicio.fueraDeLinea')}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 1 }}>
                {isOnline ? t('inicio.enLineaSub', { zona: courierProfile?.work_zone || 'Centro' }) : t('inicio.actívate')}
              </span>
            </span>
            <Switch checked={isOnline} onChange={toggle} disabled={toggling} />
          </div>

          {/* Resumen del turno, en la misma tarjeta */}
          <div style={{ display: 'flex', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.13)' }}>
            {[
              { l: t('inicio.entregasHoy'), v: deliveredToday.length },
              { l: t('comun.calificacion'), v: Number(courierProfile?.rating || 5).toFixed(1) },
              { l: t('inicio.enCurso'), v: active.length },
            ].map((s, i) => (
              <span key={s.l} style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeft: i ? '1px solid rgba(255,255,255,.13)' : 'none' }}>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>{s.l}</span>
                <span className="num" style={{ display: 'block', fontSize: 16, fontWeight: 700, marginTop: 3 }}>{s.v}</span>
              </span>
            ))}
          </div>
        </HeroCard>

        {/* Activar notificaciones */}
        {perm !== 'granted' && perm !== 'unsupported' && (
          <Card tone="low" style={{ marginTop: 12, padding: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--sh-sm)', background: 'var(--tertiary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="notifications_active" size={19} fill color="var(--on-tertiary-container)" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{t('inicio.activaAlertas')}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 1 }}>{t('inicio.activaAlertasSub')}</span>
            </span>
            <Button style={{ height: 38, fontSize: 12.5, padding: '0 14px' }} onClick={async () => setPerm(await requestNotificationPermission())}>
              Activar
            </Button>
          </Card>
        )}

        {/* Pedido activo con seguimiento en vivo */}
        {current && (
          <Card elevation={3} style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '13px 15px', background: 'var(--secondary-container)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)', animation: 'dxGlow 1.2s infinite' }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', color: 'var(--on-secondary-container)' }}>ENTREGA EN CURSO</span>
              <span style={{ flex: 1 }} />
              {current.turbo && <Chip icon="bolt" bg="var(--secondary)" color="#fff">TURBO</Chip>}
            </div>

            {current.pickup_point && current.dropoff_point && (
              <MapView
                height={190}
                pickup={current.pickup_point}
                dropoff={current.dropoff_point}
                courier={courierProfile?.last_lat ? { lat: courierProfile.last_lat, lon: courierProfile.last_lon } : null}
                route={route}
                interactive={false}
                style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--outline-variant)' }}
              />
            )}

            <div style={{ padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 40, height: 40, borderRadius: 'var(--sh-sm)', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={SERVICE_ICON[current.service_type]} size={20} color="var(--on-primary-container)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{serviceLabel(current.service_type)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current.status === 'assigned' ? current.pickup_address : current.dropoff_address}
                  </span>
                </span>
                <span className="num" style={{ fontWeight: 800, fontSize: 18 }}>{money(current.price)}</span>
              </div>

              {current.contact_phone && (
                <a
                  href={`https://wa.me/57${String(current.contact_phone).replace(/\D/g, '').slice(-10)}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 'var(--sh-sm)', background: 'var(--secondary-container)', color: 'var(--on-secondary-container)', fontSize: 12.5, fontWeight: 700 }}
                >
                  <Icon name="chat" size={17} fill /> Escribir a {current.contact_name || 'cliente'}
                </a>
              )}

              <Button full icon="navigation" color="var(--secondary)" onClick={() => advance(current)} style={{ marginTop: 12 }}>
                {t('inicio.' + CLAVE_SIGUIENTE[current.status])}
              </Button>
            </div>
          </Card>
        )}

        {/* Simulador de pedidos (solo Demo) */}
        {isDemo && isOnline && (
          <Card tone="low" style={{ marginTop: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
              <Icon name="science" size={18} fill color="var(--tertiary)" />
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('inicio.simulador')}</span>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <Button variant="outlined" icon="add_alert" onClick={() => simulate(false)} style={{ flex: 1, height: 44, fontSize: 12.5, padding: 0 }}>
                Pedido normal
              </Button>
              <Button icon="bolt" color="var(--secondary)" onClick={() => simulate(true)} style={{ flex: 1, height: 44, fontSize: 12.5, padding: 0 }}>
                Turbo
              </Button>
            </div>
          </Card>
        )}

        {isOnline && !current && open.length === 0 && !loading && (
          <Card style={{ marginTop: 12, padding: '28px 22px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Spinner /></div>
            <div className="dsp" style={{ fontWeight: 700, fontSize: 16, marginTop: 14 }}>{t('inicio.buscandoPedidos')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--on-surface-variant)', lineHeight: 1.5, marginTop: 4 }}>
              {t('inicio.buscandoPedidosSub', { zona: courierProfile?.work_zone || 'Centro' })}
            </div>
          </Card>
        )}

        {!isOnline && (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              icon="bedtime"
              title="Estás desconectado"
              body="Actívate para empezar a recibir mensajería, encomiendas y mandados."
              action={<Button icon="bolt" color="var(--secondary)" onClick={toggle}>{t('inicio.conectarme')}</Button>}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginTop: 12 }}>
          <StatTile icon="payments" tone="secondary" value={money(earnings)} label="Ganado hoy" />
          <StatTile icon="task_alt" tone="primary" value={deliveredToday.length} label="Entregas hoy" />
          <StatTile icon="star" tone="tertiary" value={Number(courierProfile?.rating || 5).toFixed(1)} label="Calificación" />
        </div>
      </div>

      {offer && (
        <IncomingOffer
          request={offer}
          onAccept={accept}
          onExpire={() => {
            // Vuelve a la fila: puede que solo iba manejando.
            seen.current.set(offer.id, Date.now() + REOFRECER_MS);
            setOffer(null);
          }}
          onReject={() => {
            seen.current.set(offer.id, Date.now() + RECHAZO_MS);
            setOffer(null);
          }}
        />
      )}

      {pinPara && (
        <PinEntrega
          request={pinPara}
          onClose={() => setPinPara(null)}
          onConfirmado={() => { setPinPara(null); loadLive(); }}
        />
      )}

      <BottomNav badges={{ '/entregas': active.length }} />
    </>
  );
}

export default function HomePage() {
  return <RequireSession><HomeContent /></RequireSession>;
}
