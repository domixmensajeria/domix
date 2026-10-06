'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AddressField from '../../components/AddressField';
import MapView from '../../components/MapView';
import { Icon, Button, Field, Pill, Spinner } from '../../components/ui';
import { useClientSession } from '../../context/ClientSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import { useIdioma } from '../../context/IdiomaProvider';
import { SERVICES, createRequest } from '../../lib/services';
import { quote, etaMinutes, money, DEFAULT_RULES } from '../../lib/pricing';
import { routeBetween, BUENAVENTURA } from '../../lib/geo';
import { pushNotify } from '../../lib/notify';
import { supabase } from '../../lib/supabaseClient';

/* Pedir en dos pasos, no en un formulario de ocho campos.

   Uber, DiDi y Yango preguntan primero a dónde vas y solo después
   muestran precio y confirmación. La razón es práctica: hasta que no
   hay dos direcciones no hay precio real que mostrar, así que enseñar
   la tarifa desde el principio obliga a inventar una cifra que después
   cambia. Y ocho campos de golpe en un celular hacen que la gente
   abandone antes de llegar al botón. */

function PedirForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { client, saveClient } = useClientSession();
  const { isDemo } = useAppMode();
  const { t } = useIdioma();

  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState(params.get('tipo') || 'mensajeria');
  const [turbo, setTurbo] = useState(params.get('turbo') === '1');
  const [pickup, setPickup] = useState({ address: '', point: null });
  const [dropoff, setDropoff] = useState({ address: '', point: null });
  const [form, setForm] = useState({
    contact_name: client?.name || '',
    contact_phone: client?.phone || '',
    cliente_email: '',
    description: '',
    servicio_especial: 'ninguno',
  });
  const [route, setRoute] = useState({ coords: [], distanceKm: 0, durationMin: null });
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [calculando, setCalculando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (isDemo) return;
    let vivo = true;
    supabase
      .from('branches')
      .select('pricing_rules')
      .eq('city', 'Buenaventura')
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data?.pricing_rules && Object.keys(data.pricing_rules).length > 0) {
          setRules((prev) => ({ ...prev, ...data.pricing_rules }));
        }
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [isDemo]);

  useEffect(() => {
    let vivo = true;
    if (!pickup.point || !dropoff.point) return setRoute({ coords: [], distanceKm: 0, durationMin: null });
    setCalculando(true);
    routeBetween(pickup.point, dropoff.point).then((r) => {
      if (!vivo) return;
      setRoute(r);
      setCalculando(false);
    });
    return () => { vivo = false; };
  }, [pickup.point, dropoff.point]);

  const q = quote({ distanceKm: route.distanceKm, serviceType: tipo, turbo, rules });
  const eta = route.durationMin ?? etaMinutes(route.distanceKm, turbo);

  const hayRuta = !!pickup.address && !!dropoff.address;
  const hayContacto = !!form.contact_name.trim() && !!form.contact_phone.trim();

  /* En vez de dejar el botón muerto sin explicar por qué, se dice qué
     falta. Un botón apagado sin motivo es la queja más común de un
     formulario en celular. */
  const queFalta = () => {
    if (!pickup.address) return t('pedir.faltaRecoger');
    if (!dropoff.address) return t('pedir.faltaEntregar');
    if (!form.contact_name.trim()) return t('pedir.faltaNombre');
    if (!form.contact_phone.trim()) return t('pedir.faltaCelular');
    if (form.contact_phone.replace(/\D/g, '').length < 7) return t('pedir.celularInvalido');
    return null;
  };

  const submit = async (e) => {
    e?.preventDefault();
    const falta = queFalta();
    if (falta) return setError(falta);

    setError('');
    setBusy(true);

    const payload = {
      service_type: tipo,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      cliente_email: form.cliente_email || null,
      pickup_address: pickup.address,
      dropoff_address: dropoff.address,
      description: form.description || null,
      instrucciones_detalladas: form.description || null,
      servicio_especial: form.servicio_especial || 'ninguno',
      price: q.total,
      source: 'app',
      turbo,
      distance_km: route.distanceKm || null,
      eta_minutes: eta,
      pickup_lat: pickup.point?.lat ?? null,
      pickup_lon: pickup.point?.lon ?? null,
      dropoff_lat: dropoff.point?.lat ?? null,
      dropoff_lon: dropoff.point?.lon ?? null,
      price_breakdown: q.breakdown,
    };

    saveClient({ name: form.contact_name, phone: form.contact_phone });

    if (isDemo) {
      const code = Math.random().toString(16).slice(2, 10);
      try {
        localStorage.setItem(`domix_demo_${code}`, JSON.stringify({
          ...payload, tracking_code: code, status: 'requested', created_at: new Date().toISOString(),
          pickup_point: pickup.point, dropoff_point: dropoff.point, is_demo: true,
        }));
      } catch { /* ignorar */ }
      pushNotify(t('seguimiento.buscando'), { body: t('seguimiento.buscandoDesc'), tag: `demo-${code}` });
      setBusy(false);
      return router.push(`/seguimiento/${code}`);
    }

    const { data, error: err } = await createRequest(payload);
    setBusy(false);
    if (err) return setError(t('pedir.errorEnvio'));
    pushNotify(t('seguimiento.buscando'), { body: t('seguimiento.buscandoDesc'), tag: data.tracking_code });
    router.push(`/seguimiento/${data.tracking_code}`);
  };

  const atras = () => (paso === 1 ? router.push('/') : (setPaso(1), setError('')));

  return (
    <>
      {/* Cabecera con el paso: saber cuántos faltan reduce el abandono */}
      <div style={{ flex: 'none', padding: '10px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <button
            aria-label={t('comun.volver')}
            onClick={atras}
            style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em' }}>
              {paso === 1 ? t('pedir.donde') : t('pedir.confirmar')}
            </div>
            <div style={{ font: '600 11px Manrope,sans-serif', color: 'var(--mu)', marginTop: 2 }}>
              {t('pedir.paso', { n: paso })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, marginTop: 13 }}>
          {[1, 2].map((n) => (
            <span
              key={n}
              style={{
                flex: 1, height: 3, borderRadius: 99,
                background: n <= paso ? 'var(--tx)' : 'var(--sf2)',
                transition: 'background .3s var(--ease)',
              }}
            />
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="sb" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 130px' }}>

        {paso === 1 && (
          <div style={{ animation: 'dxSube .3s cubic-bezier(.2,.8,.2,1) both' }}>
            {/* Qué servicio */}
            <div className="sb" style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 20, margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
              {SERVICES.map((s) => {
                const on = tipo === s.value;
                return (
                  <button
                    key={s.value} type="button" onClick={() => setTipo(s.value)}
                    className="dx-toque"
                    style={{
                      flex: 'none', width: 98, padding: '13px 8px', borderRadius: 15, textAlign: 'center',
                      background: on ? 'var(--inv)' : 'var(--sf)', color: on ? 'var(--invtx)' : 'var(--tx)',
                      transition: 'background .2s var(--ease), color .2s var(--ease)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.img} alt="" style={{ width: 40, height: 40, objectFit: 'contain', margin: '0 auto 7px', display: 'block' }} />
                    <span style={{ display: 'block', font: '700 11.5px/1.25 Manrope,sans-serif' }}>{t(`servicios.${s.value}`)}</span>
                  </button>
                );
              })}
            </div>

            {/* De dónde a dónde */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>
              <AddressField
                required allowLocate label={t('pedir.recogerCorto')} icon="trip_origin"
                placeholder={t('direccion.buscar')}
                value={pickup.address} point={pickup.point} onChange={setPickup}
              />
              <AddressField
                required label={t('pedir.entregarCorto')} icon="location_on"
                placeholder={t('direccion.buscar')}
                value={dropoff.address} point={dropoff.point} onChange={setDropoff}
              />
            </div>

            {(pickup.point || dropoff.point) && (
              <div style={{ marginBottom: 18, animation: 'dxSube .3s cubic-bezier(.2,.8,.2,1) both' }}>
                <MapView
                  height={186}
                  center={BUENAVENTURA}
                  pickup={pickup.point}
                  dropoff={dropoff.point}
                  route={route.coords}
                  interactive={false}
                  style={{ borderRadius: 18, border: '1px solid var(--bd)' }}
                />
                {(calculando || route.distanceKm > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 11 }}>
                    {calculando
                      ? <Pill icon="near_me">{t('pedir.calculando')}</Pill>
                      : <Pill icon="near_me">{route.distanceKm.toFixed(1)} {t('comun.km')} · {eta} {t('comun.minutos')}</Pill>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 4 }}>
              <Pill icon="lock_open">{t('pedir.sinRegistroPill')}</Pill>
              <Pill icon="schedule">{t('pedir.respuestaPill')}</Pill>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div style={{ animation: 'dxSube .3s cubic-bezier(.2,.8,.2,1) both' }}>
            {/* Turbo */}
            <button
              type="button"
              onClick={() => setTurbo((x) => !x)}
              className="dx-toque"
              style={{
                display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: 15, borderRadius: 16,
                textAlign: 'left', marginBottom: 18,
                background: turbo ? 'linear-gradient(135deg,#245FA8,#1B4F8F)' : 'var(--bg)',
                color: turbo ? '#fff' : 'var(--tx)',
                border: `1px solid ${turbo ? 'transparent' : 'var(--bd)'}`,
                transition: 'background .2s var(--ease)',
              }}
            >
              <span style={{ width: 44, height: 44, borderRadius: 13, background: turbo ? 'rgba(255,255,255,.18)' : 'var(--navyS)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="bolt" size={22} fill color={turbo ? '#fff' : 'var(--navy)'} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: '700 14.5px Manrope,sans-serif' }}>{t('pedir.turbo')}</span>
                <span style={{ display: 'block', font: '500 12px/1.4 Manrope,sans-serif', opacity: turbo ? 0.85 : 0.6, marginTop: 1 }}>
                  {t('pedir.turboDesc')}
                </span>
              </span>
              <span style={{ flex: 'none', textAlign: 'right' }}>
                <span className="num" style={{ display: 'block', font: '800 13.5px Manrope,sans-serif' }}>+{money(DEFAULT_RULES.turboFee)}</span>
                <Icon name={turbo ? 'check_circle' : 'radio_button_unchecked'} size={19} fill={turbo} style={{ marginTop: 2 }} />
              </span>
            </button>

            {/* Placa Blanca Cali: Banner informativo */}
            {tipo === 'placa_blanca' && (
              <div style={{ marginBottom: 18, background: 'rgba(15,138,109,0.1)', border: '1.5px solid #0f8a6d', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f8a6d', fontWeight: 800, fontSize: 14 }}>
                  <Icon name="airport_shuttle" size={20} /> Ruta Intermunicipal Buenaventura ⇄ Cali
                </div>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                  Para reservar puestos en van con salidas de turno o solicitar envío/recepción de encomiendas Cali ⇄ Buenaventura:
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/cali')}
                  style={{ background: '#0f8a6d', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Abrir Portal de Salidas y Encomiendas a Cali &rarr;
                </button>
              </div>
            )}

            {/* Servicio Especial para Taxis */}
            {tipo === 'taxi' && (
              <div style={{ marginBottom: 16, background: '#fefce8', border: '1.5px solid #eab308', borderRadius: 14, padding: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#854d0e', textTransform: 'uppercase', marginBottom: 6 }}>
                  <Icon name="local_taxi" size={17} /> Servicio Especial (Opcional)
                </label>
                <select
                  value={form.servicio_especial}
                  onChange={set('servicio_especial')}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1',
                    background: '#fff', fontSize: 13, fontWeight: 700, color: '#111', outline: 'none',
                  }}
                >
                  <option value="ninguno">Ninguno (Taxi estándar)</option>
                  <option value="polarizado">Vidrios polarizados</option>
                  <option value="bodega">Con bodega amplia (Maletas / Equipaje)</option>
                </select>
                <div style={{ fontSize: 11, color: '#a16207', marginTop: 5, lineHeight: 1.3 }}>
                  El servicio se asignará a taxistas con las características seleccionadas.
                </div>
              </div>
            )}

            {/* A quién avisamos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 18 }}>
              <Field required label={t('pedir.tuNombre')} icon="person" placeholder={t('pedir.tuNombre')} value={form.contact_name} onChange={set('contact_name')} />
              <Field required label={t('pedir.tuCelular')} icon="call" type="tel" placeholder="315 792 4906" value={form.contact_phone} onChange={set('contact_phone')} />
              <div style={{ font: '500 11.5px/1.45 Manrope,sans-serif', color: 'var(--mu)', marginTop: -5, paddingLeft: 3 }}>
                {t('pedir.celularPista')}
              </div>
              <Field label="Correo Electrónico (Para recibir comprobante y PIN)" icon="mail" type="email" placeholder="ejemplo@correo.com" value={form.cliente_email} onChange={set('cliente_email')} />
              <Field label="¿Qué recogemos? / Instrucciones detalladas *" icon="inventory_2" rows={3} placeholder="Ej: recoger llaves con llavero de acrílico en portería / compras del Éxito con factura" value={form.description} onChange={set('description')} />
            </div>

            {/* Qué se paga y por qué */}
            <div style={{ borderRadius: 18, background: 'var(--sf)', padding: 17, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ font: '800 15px Manrope,sans-serif', letterSpacing: '-.02em' }}>{t('pedir.tarifa')}</span>
                {calculando
                  ? <Spinner size={17} />
                  : route.distanceKm > 0 && <Pill icon="near_me">{route.distanceKm.toFixed(1)} {t('comun.km')} · {eta} {t('comun.minutos')}</Pill>}
              </div>

              {route.distanceKm === 0 ? (
                <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--mu)' }}>
                  {t('pedir.eligeDirecciones')} {t('pedir.tarifaMinima', { precio: money(DEFAULT_RULES.minFare) })}
                </div>
              ) : (
                <>
                  {q.breakdown.map((b) => (
                    <div key={b.label} style={{ display: 'flex', gap: 10, padding: '4px 0' }}>
                      <span style={{ flex: 1, font: '500 12.5px Manrope,sans-serif', color: b.tone ? 'var(--navy)' : 'var(--mu)' }}>{b.label}</span>
                      <span className="num" style={{ font: '700 12.5px Manrope,sans-serif', color: b.tone ? 'var(--navy)' : 'var(--tx)' }}>{money(b.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
                    <span style={{ flex: 1, font: '700 14px Manrope,sans-serif' }}>{t('pedir.total')}</span>
                    <span className="num" style={{ font: '800 27px Manrope,sans-serif', letterSpacing: '-.03em' }}>{money(q.total)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                    <Pill icon="payments" tone="green">{t('pedir.pagoEfectivoPill')}</Pill>
                    {q.flags.turbo && <Pill icon="bolt" tone="navy">Turbo</Pill>}
                    {q.flags.night && <Pill icon="dark_mode" tone="amber">{t('pedir.nocturno')}</Pill>}
                  </div>
                </>
              )}
            </div>

            <div style={{ textAlign: 'center', font: '500 11.5px Manrope,sans-serif', color: 'var(--mu)' }}>
              {t('pedir.pagoEfectivo')}
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', gap: 9, padding: 13, borderRadius: 13, background: 'var(--redS)', color: 'var(--red)', font: '600 12.5px Manrope,sans-serif', marginTop: 14 }}>
            <Icon name="error" size={18} fill /> {error}
          </div>
        )}
      </form>

      {/* Barra fija: una sola acción, siempre a la vista */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 20px', background: 'var(--bg)', borderTop: '1px solid var(--bd2)', zIndex: 40 }}>
        {paso === 1 ? (
          <Button
            type="button"
            onClick={() => { const f = !pickup.address ? t('pedir.faltaRecoger') : !dropoff.address ? t('pedir.faltaEntregar') : null; if (f) return setError(f); setError(''); setPaso(2); }}
            icon="arrow_forward"
            style={{ opacity: hayRuta ? 1 : 0.55 }}
          >
            {t('pedir.siguiente')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={submit}
            disabled={busy}
            icon={busy ? undefined : 'check'}
            style={{ opacity: busy || !hayContacto ? 0.55 : 1 }}
          >
            {busy ? t('pedir.pidiendo') : `${t('pedir.pedirAhora')} · ${money(q.total)}`}
          </Button>
        )}
      </div>
    </>
  );
}

export default function PedirPage() {
  return <Suspense fallback={<div style={{ flex: 1 }} />}><PedirForm /></Suspense>;
}
