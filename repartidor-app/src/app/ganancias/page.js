'use client';

import { useCallback, useEffect, useState } from 'react';
import RequireSession from '../../components/RequireSession';
import BottomNav from '../../components/BottomNav';
import { Icon, Card, HeroCard, Overline, StatTile, EmptyState, Button } from '../../components/ui';
import { useCourierSession } from '../../context/CourierSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import { useIdioma } from '../../context/IdiomaProvider';
import HojaRetiro from '../../components/HojaRetiro';
import { fetchWeekEarnings, serviceLabel, SERVICE_ICON } from '../../lib/serviceRequests';
import { fetchSaldo, fetchRetiros, dinero, ESTADO_RETIRO, METODOS_RETIRO } from '../../lib/cuenta';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function GananciasContent() {
  const { courierProfile, courierId, demoRequests } = useCourierSession();
  const { isDemo } = useAppMode();
  const { t } = useIdioma();
  const [liveRecords, setLiveRecords] = useState([]);
  const [saldo, setSaldo] = useState({ ganado: 0, retirado: 0, pendiente: 0, disponible: 0, entregas: 0 });
  const [retiros, setRetiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoja, setHoja] = useState(false);

  const id = courierProfile?.id;

  const recargar = useCallback(async () => {
    if (isDemo || !id) return setLoading(false);
    setLoading(true);
    const [semana, s, r] = await Promise.all([
      fetchWeekEarnings(id).catch(() => []),
      fetchSaldo(id),
      fetchRetiros(id),
    ]);
    setLiveRecords(semana);
    setSaldo(s);
    setRetiros(r);
    setLoading(false);
  }, [id, isDemo]);

  useEffect(() => { recargar(); }, [recargar]);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const records = isDemo
    ? demoRequests.filter((r) => r.courier_id === courierId && r.status === 'delivered' && new Date(r.delivered_at) >= weekStart)
    : liveRecords;

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toDateString(), label: DAYS[d.getDay()], total: 0 };
  });
  for (const r of records) {
    const b = buckets.find((x) => x.key === new Date(r.delivered_at).toDateString());
    if (b) b.total += Number(r.price || 0) + Number(r.tip || 0);
  }
  const semana = buckets.reduce((s, b) => s + b.total, 0);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const tips = records.reduce((s, r) => s + Number(r.tip || 0), 0);
  const fees = records.reduce((s, r) => s + Number(r.price || 0), 0);
  const today = new Date().toDateString();

  /* En demo no hay saldo real: se muestra lo de la semana para que la
     pantalla no aparezca en ceros. */
  const disponible = isDemo ? semana : saldo.disponible;
  const enCurso = retiros.find((r) => r.status === 'pending');
  const metodo = METODOS_RETIRO.find((m) => m.id === courierProfile?.payout_method);

  return (
    <>
      <header className="dx-topbar" style={{ justifyContent: 'space-between' }}>
        <span className="dsp" style={{ fontWeight: 800, fontSize: 25 }}>{t('ganancias.titulo')}</span>
      </header>

      <div className="dx-page sc">
        <HeroCard glow="green">
          <Overline style={{ color: 'rgba(255,255,255,.55)' }}>{t('ganancias.disponible')}</Overline>
          <div className="num" style={{ fontWeight: 800, fontSize: 38, letterSpacing: '-.03em', marginTop: 6 }}>{dinero(disponible)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>
            {courierProfile?.payout_account
              ? t('ganancias.seConsigna', { metodo: metodo?.label || '', cuenta: courierProfile.payout_account })
              : t('ganancias.registraCuenta')}
          </div>

          {/* De lo ganado, cuánto ya salió */}
          {!isDemo && saldo.ganado > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
              <span>{t('ganancias.ganado')} <b className="num" style={{ color: 'rgba(255,255,255,.8)' }}>{dinero(saldo.ganado)}</b></span>
              <span>{t('ganancias.retirado')} <b className="num" style={{ color: 'rgba(255,255,255,.8)' }}>{dinero(saldo.retirado)}</b></span>
              {saldo.pendiente > 0 && <span>{t('ganancias.enCurso')} <b className="num" style={{ color: '#F0B354' }}>{dinero(saldo.pendiente)}</b></span>}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 84, marginTop: 20 }}>
            {buckets.map((b) => {
              const isToday = b.key === today;
              return (
                <span key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                  {b.total > 0 && (
                    <span className="num" style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>
                      {Math.round(b.total / 1000)}k
                    </span>
                  )}
                  <span style={{
                    width: '100%', height: Math.max(5, (b.total / max) * 48), borderRadius: '5px 5px 3px 3px',
                    background: isToday ? 'linear-gradient(180deg,#4EA33C,#2F7A24)' : 'rgba(255,255,255,.18)',
                    transition: 'height .4s var(--ease-out)',
                  }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#A9D98F' : 'rgba(255,255,255,.5)' }}>{b.label}</span>
                </span>
              );
            })}
          </div>
        </HeroCard>

        {/* Retiro en curso: lo primero que quiere ver quien ya pidió */}
        {enCurso && (
          <Card style={{ padding: 14, marginTop: 14, borderLeft: '3px solid var(--tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--sh-sm)', background: 'var(--tertiary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="schedule" size={20} fill color="var(--on-tertiary-container)" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{t('ganancias.retiroEnCamino')}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 1 }}>
                  {t('ganancias.pedidoEl', { fecha: new Date(enCurso.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) })} · {enCurso.account}
                </span>
              </span>
              <span className="num" style={{ fontWeight: 800, fontSize: 16, color: 'var(--tertiary)' }}>{dinero(enCurso.amount)}</span>
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <StatTile icon="local_shipping" tone="primary" value={dinero(fees)} label={t('ganancias.tarifasSemana')} />
          <StatTile icon="volunteer_activism" tone="secondary" value={dinero(tips)} label={t('ganancias.propinas')} />
          <StatTile icon="inventory_2" tone="tertiary" value={records.length} label={t('ganancias.entregasSemana')} />
          <StatTile icon="savings" tone="primary" value={dinero(isDemo ? semana : saldo.ganado)} label={t('ganancias.ganadoTotal')} />
        </div>

        {/* Historial de retiros */}
        {retiros.length > 0 && (
          <>
            <Overline style={{ color: 'var(--on-surface-variant)', margin: '20px 0 8px' }}>{t('ganancias.misRetiros')}</Overline>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {retiros.map((r, i) => {
                const st = ESTADO_RETIRO[r.status] || ESTADO_RETIRO.pending;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: i ? '1px solid var(--outline-variant)' : 'none' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--sh-sm)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name={st.icon} size={19} fill color={st.color} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: st.color }}>{st.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 1 }}>
                        {new Date(r.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        {r.reference ? ` · ${r.reference}` : r.account ? ` · ${r.account}` : ''}
                      </span>
                    </span>
                    <span className="num" style={{ fontWeight: 800, fontSize: 15 }}>−{dinero(r.amount)}</span>
                  </div>
                );
              })}
            </Card>
          </>
        )}

        <Overline style={{ color: 'var(--on-surface-variant)', margin: '20px 0 8px' }}>{t('ganancias.movimientos')}</Overline>

        {!loading && records.length === 0 && (
          <EmptyState icon="receipt_long" title={t('ganancias.sinMovimientos')} body={t('ganancias.sinMovimientosSub')} />
        )}

        {records.length > 0 && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {records.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: i ? '1px solid var(--outline-variant)' : 'none' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--sh-sm)', background: 'var(--secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={SERVICE_ICON[r.service_type] || 'inventory_2'} size={19} color="var(--on-secondary-container)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{serviceLabel(r.service_type)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 1 }}>
                    {new Date(r.delivered_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {new Date(r.delivered_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </span>
                <span className="num" style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>
                  +{dinero(Number(r.price || 0) + Number(r.tip || 0))}
                </span>
              </div>
            ))}
          </Card>
        )}

        {!isDemo && disponible > 0 && !enCurso && (
          <Button full icon="account_balance_wallet" color="var(--secondary)" style={{ marginTop: 14 }} onClick={() => setHoja(true)}>
            {t('ganancias.solicitarRetiro')}
          </Button>
        )}
      </div>

      <HojaRetiro
        abierta={hoja}
        disponible={disponible}
        perfil={courierProfile}
        courierId={id}
        onClose={() => setHoja(false)}
        onListo={recargar}
      />

      <BottomNav />
    </>
  );
}

export default function GananciasPage() {
  return <RequireSession><GananciasContent /></RequireSession>;
}
