'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MapView from '../../../components/MapView';
import { Icon, Button, Pill, EmptyState, Esqueleto } from '../../../components/ui';
import { useAppMode } from '../../../context/AppModeProvider';
import { useIdioma } from '../../../context/IdiomaProvider';
import { trackRequest, loadDemoRequest, serviceInfo, STATUS_STEPS } from '../../../lib/services';
import { routeBetween } from '../../../lib/geo';
import { money } from '../../../lib/pricing';
import { pushNotify } from '../../../lib/notify';

const WHATSAPP = 'https://wa.me/573157924906';

const CLAVE = {
  requested: 'buscando',
  assigned: 'asignado',
  picked_up: 'recogido',
  in_progress: 'enCamino',
  delivered: 'entregado',
  cancelled: 'cancelado',
};

export default function SeguimientoPage() {
  const { code } = useParams();
  const router = useRouter();
  const { isDemo } = useAppMode();
  const { t } = useIdioma();

  const [req, setReq] = useState(undefined);
  const [route, setRoute] = useState([]);
  const [error, setError] = useState('');
  const [ultimoEstado, setUltimoEstado] = useState(null);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = isDemo ? loadDemoRequest(code) : await trackRequest(code);
        if (vivo) setReq(r);
      } catch (e) {
        if (vivo) setError(e.message);
      }
    };
    cargar();
    const t2 = setInterval(cargar, isDemo ? 3000 : 8000);
    return () => { vivo = false; clearInterval(t2); };
  }, [code, isDemo]);

  /* Avisar solo cuando el estado cambia de verdad, no la primera vez que
     se abre la pantalla: nadie quiere una notificación por mirar. */
  useEffect(() => {
    if (!req?.status || req.status === ultimoEstado) return;
    if (ultimoEstado !== null) {
      const paso = STATUS_STEPS.find((s) => s.id === req.status);
      if (paso) pushNotify(paso.label, { body: paso.desc, tag: `estado-${code}` });
    }
    setUltimoEstado(req.status);
  }, [req?.status, ultimoEstado, code]);

  const pickup = req?.pickup_lat != null ? { lat: req.pickup_lat, lon: req.pickup_lon } : req?.pickup_point || null;
  const dropoff = req?.dropoff_lat != null ? { lat: req.dropoff_lat, lon: req.dropoff_lon } : req?.dropoff_point || null;
  const courier = req?.courier_lat != null ? { lat: req.courier_lat, lon: req.courier_lon } : null;

  useEffect(() => {
    let vivo = true;
    if (!pickup || !dropoff) return;
    routeBetween(pickup, dropoff).then((r) => vivo && setRoute(r.coords));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lon, dropoff?.lat, dropoff?.lon]);

  const paso = req ? STATUS_STEPS.findIndex((s) => s.id === req.status) : -1;
  const cancelado = req?.status === 'cancelled';
  const entregado = req?.status === 'delivered';
  const info = req ? serviceInfo(req.service_type) : null;
  const clave = CLAVE[req?.status] || 'buscando';

  return (
    <>
      {/* Volver flotando sobre el mapa, como en las apps de viaje: la
          cabecera fija robaría altura justo donde importa ver el mapa. */}
      <button
        aria-label={t('comun.volver')}
        onClick={() => router.push('/')}
        style={{
          position: 'absolute', top: 14, left: 14, zIndex: 40,
          width: 40, height: 40, borderRadius: '50%', background: 'var(--bg)',
          boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="arrow_back" size={20} />
      </button>

      <div className="sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
        {req === undefined && !error && (
          <>
            <Esqueleto h={300} r={0} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Esqueleto h={26} w="55%" />
              <Esqueleto h={84} />
              <Esqueleto h={120} />
            </div>
          </>
        )}

        {(error || req === null) && (
          <div style={{ paddingTop: 40 }}>
            <EmptyState
              icon="search_off"
              title={t('seguimiento.noEncontrado')}
              body={`${t('seguimiento.noEncontradoTexto')} · ${code}`}
              action={
                <Button full={false} variant="green" icon="chat" onClick={() => window.open(WHATSAPP, '_blank')}>
                  {t('seguimiento.escribirWhatsapp')}
                </Button>
              }
            />
          </div>
        )}

        {req && (
          <>
            {/* El mapa manda. Ocupa casi la mitad de la pantalla y la hoja
                de información se le monta encima con las esquinas
                redondeadas, que es lo que hace que se sienta una capa
                sobre el mundo y no dos bloques pegados. */}
            {(pickup || dropoff) && (
              <MapView
                height="46vh"
                pickup={pickup}
                dropoff={dropoff}
                courier={courier}
                route={route}
                style={{ borderRadius: 0, border: 'none' }}
              />
            )}

            <div
              style={{
                position: 'relative', marginTop: (pickup || dropoff) ? -26 : 0,
                borderRadius: '26px 26px 0 0', background: 'var(--bg)',
                boxShadow: '0 -14px 34px rgba(0,0,0,.13)',
                padding: '10px 16px 30px', minHeight: '54vh',
              }}
            >
              <span style={{ display: 'block', width: 38, height: 4, borderRadius: 99, background: 'var(--sf2)', margin: '0 auto 16px' }} />

              {/* Qué está pasando ahora */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
                <span style={{ width: 54, height: 54, borderRadius: 16, background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={info.img} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {!cancelado && !entregado && (
                      <span className="dx-vivo" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flex: 'none' }} />
                    )}
                    <span style={{ font: '800 20px Manrope,sans-serif', letterSpacing: '-.03em' }}>
                      {t(`seguimiento.${clave}`)}
                    </span>
                  </div>
                  <div style={{ font: '500 12.5px/1.45 Manrope,sans-serif', color: 'var(--mu)', marginTop: 3 }}>
                    {t(`seguimiento.${clave}Desc`)}
                  </div>
                </div>
                {req.turbo && <Pill icon="bolt" tone="navy">TURBO</Pill>}
              </div>

              {/* El código de entrega: lo único que el cliente tiene que
                  hacer, así que va antes que cualquier otro dato. */}
              {req.delivery_pin && !cancelado && !entregado && (
                <div style={{ borderRadius: 18, background: 'var(--inv)', color: 'var(--invtx)', padding: '19px 16px', marginBottom: 18, textAlign: 'center' }}>
                  <div style={{ font: '700 10.5px Manrope,sans-serif', letterSpacing: '.14em', opacity: 0.6 }}>
                    {t('seguimiento.tuCodigo')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 9, margin: '13px 0 11px' }}>
                    {String(req.delivery_pin).split('').map((d, i) => (
                      <span
                        key={i}
                        style={{
                          width: 48, height: 58, borderRadius: 13, background: 'rgba(255,255,255,.13)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          font: "800 27px 'IBM Plex Mono',monospace",
                          animation: `dxSube .4s cubic-bezier(.2,.8,.2,1) ${i * 70}ms both`,
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  <div style={{ font: '500 12px/1.45 Manrope,sans-serif', opacity: 0.65 }}>
                    {t('seguimiento.codigoTexto')}
                  </div>
                </div>
              )}

              {/* Quién lo lleva, con datos completos del conductor y vehículo a un toque */}
              {req.courier_name && (
                <div style={{ borderRadius: 18, border: '1px solid var(--bd)', background: 'var(--sf)', padding: '14px 16px', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--inv)', color: 'var(--invtx)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 17px Manrope,sans-serif', flex: 'none' }}>
                      {req.courier_name[0]?.toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '800 15px Manrope,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.courier_name}
                      </div>
                      <div style={{ font: '600 12px Manrope,sans-serif', color: 'var(--mu)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {req.courier_cedula && (
                          <span>C.C. {req.courier_cedula}</span>
                        )}
                        {req.service_type === 'taxi' && (
                          <span style={{ background: '#FFF3C4', color: '#795548', padding: '1px 6px', borderRadius: 6, fontWeight: 700, fontSize: 10 }}>TAXI</span>
                        )}
                        {req.service_type === 'placa_blanca' && (
                          <span style={{ background: '#E2E8F0', color: '#1E293B', padding: '1px 6px', borderRadius: 6, fontWeight: 700, fontSize: 10 }}>PLACA BLANCA</span>
                        )}
                      </div>
                    </div>
                    {req.courier_phone && (
                      <a
                        aria-label={t('seguimiento.llamar')}
                        href={`tel:${req.courier_phone}`}
                        style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                      >
                        <Icon name="call" size={18} fill />
                      </a>
                    )}
                    <a
                      aria-label={t('seguimiento.escribir')}
                      href={req.courier_phone ? `https://wa.me/57${String(req.courier_phone).replace(/\D/g, '').slice(-10)}` : WHATSAPP}
                      target="_blank"
                      rel="noreferrer"
                      style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--greenS)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                    >
                      <Icon name="chat" size={18} fill color="var(--green)" />
                    </a>
                  </div>

                  {/* Placa y modelo del vehículo */}
                  {req.vehicle_plate && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          background: req.service_type === 'taxi' ? '#FEE715' : '#FFFFFF',
                          color: '#000000',
                          border: '2px solid #000000',
                          borderRadius: 6,
                          padding: '2px 8px',
                          font: "800 13px 'IBM Plex Mono',monospace",
                          letterSpacing: '1px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                          {req.vehicle_plate.toUpperCase()}
                        </span>
                        {req.vehicle_model && (
                          <span style={{ font: '600 12px Manrope,sans-serif', color: 'var(--mu)' }}>
                            {req.vehicle_model}
                          </span>
                        )}
                      </div>
                      {req.servicio_especial && req.servicio_especial !== 'ninguno' && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'rgba(255, 122, 0, 0.12)', color: 'var(--accent)' }}>
                          ★ {req.servicio_especial === 'polarizado' ? 'Vidrios polarizados' : req.servicio_especial === 'bodega' ? 'Con bodega' : req.servicio_especial}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Instrucciones detalladas o descripción del mandado */}
              {(req.instrucciones_detalladas || req.description) && (
                <div style={{ borderRadius: 16, border: '1px dashed var(--bd)', background: 'var(--sf)', padding: '12px 14px', marginBottom: 18 }}>
                  <div style={{ font: '700 10.5px Manrope,sans-serif', letterSpacing: '.1em', color: 'var(--mu)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="notes" size={14} /> Detalle e Instrucciones
                  </div>
                  <div style={{ font: '500 13px/1.45 Manrope,sans-serif', marginTop: 5, color: 'var(--tx)', whiteSpace: 'pre-line' }}>
                    {req.instrucciones_detalladas || req.description}
                  </div>
                </div>
              )}

              {/* Cifras del pedido */}
              <div style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
                <div style={{ flex: 1, borderRadius: 15, background: 'var(--sf)', padding: '13px 15px' }}>
                  <div style={{ font: '700 10px Manrope,sans-serif', letterSpacing: '.11em', color: 'var(--mu)' }}>{t('seguimiento.codigo')}</div>
                  <div className="num" style={{ font: "700 15px 'IBM Plex Mono',monospace", marginTop: 4 }}>#{req.tracking_code || code}</div>
                </div>
                <div style={{ flex: 1, borderRadius: 15, background: 'var(--sf)', padding: '13px 15px' }}>
                  <div style={{ font: '700 10px Manrope,sans-serif', letterSpacing: '.11em', color: 'var(--mu)' }}>{t('seguimiento.tarifa')}</div>
                  <div className="num" style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.02em', marginTop: 3 }}>{money(req.price)}</div>
                </div>
                {req.eta_minutes > 0 && !entregado && (
                  <div style={{ flex: 1, borderRadius: 15, background: 'var(--sf)', padding: '13px 15px' }}>
                    <div style={{ font: '700 10px Manrope,sans-serif', letterSpacing: '.11em', color: 'var(--mu)' }}>{t('seguimiento.llegaEn')}</div>
                    <div className="num" style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.02em', marginTop: 3 }}>
                      {req.eta_minutes} {t('comun.minutos')}
                    </div>
                  </div>
                )}
              </div>

              {/* Dónde va */}
              <div style={{ borderRadius: 16, border: '1px solid var(--bd)', padding: 16, marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', paddingTop: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', border: '3px solid var(--tx)' }} />
                    <span style={{ width: 2, flex: 1, minHeight: 22, background: 'var(--bd)' }} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                    <span style={{ display: 'block', font: '700 10px Manrope,sans-serif', letterSpacing: '.11em', color: 'var(--mu)' }}>{t('seguimiento.recogerEn')}</span>
                    <span style={{ display: 'block', font: '700 13.5px/1.4 Manrope,sans-serif', marginTop: 3 }}>{req.pickup_address}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', flex: 'none', marginTop: 4 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: '700 10px Manrope,sans-serif', letterSpacing: '.11em', color: 'var(--mu)' }}>{t('seguimiento.entregarEn')}</span>
                    <span style={{ display: 'block', font: '700 13.5px/1.4 Manrope,sans-serif', marginTop: 3 }}>{req.dropoff_address}</span>
                  </span>
                </div>
              </div>

              {/* Los pasos, para quien quiera el detalle */}
              {!cancelado && (
                <div style={{ borderRadius: 16, border: '1px solid var(--bd)', padding: 16, marginBottom: 18 }}>
                  {STATUS_STEPS.map((step, i) => {
                    const hecho = i <= paso;
                    const actual = i === paso;
                    const ultimo = i === STATUS_STEPS.length - 1;
                    const k = CLAVE[step.id];
                    return (
                      <div key={step.id} style={{ display: 'flex', gap: 13 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                          <span
                            className={actual ? 'dx-vivo' : undefined}
                            style={{
                              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: hecho ? 'var(--green)' : 'var(--sf2)',
                            }}
                          >
                            <Icon name={hecho && !actual ? 'check' : step.icon} size={16} fill color={hecho ? '#fff' : 'var(--mu)'} />
                          </span>
                          {!ultimo && <span style={{ width: 2, flex: 1, minHeight: 20, background: i < paso ? 'var(--green)' : 'var(--bd)' }} />}
                        </div>
                        <div style={{ flex: 1, paddingBottom: ultimo ? 0 : 14 }}>
                          <div style={{ font: `${actual ? 800 : 700} 14px Manrope,sans-serif`, color: hecho ? 'var(--tx)' : 'var(--mu)' }}>
                            {t(`seguimiento.${k}`)}
                          </div>
                          <div style={{ font: '500 11.5px/1.4 Manrope,sans-serif', color: 'var(--mu)', marginTop: 1 }}>
                            {t(`seguimiento.${k}Desc`)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="soft" onClick={() => window.open(WHATSAPP, '_blank')} icon="chat">{t('seguimiento.ayuda')}</Button>
                <Button onClick={() => router.push('/pedir')} icon="add">{t('seguimiento.pedirOtro')}</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
