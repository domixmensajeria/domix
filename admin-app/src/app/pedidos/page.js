'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TopBar from '../../components/TopBar';
import GuiaSeccion from '../../components/GuiaSeccion';
import MapView from '../../components/MapView';
import { Icon, Card, Overline, Button, Chip, Field, Spinner, EmptyState } from '../../components/ui';
import { useOps } from '../../context/OpsProvider';
import { SERVICE_LABELS, SERVICE_ICON, STATUS_META, BOARD_COLUMNS, OPEN_STATUSES , fetchDeliveryPin } from '../../lib/ops';
import { money, quote, etaMinutes } from '../../lib/pricing';
import { routeBetween } from '../../lib/geo';

const NEXT = { requested: 'assigned', assigned: 'picked_up', picked_up: 'in_progress', in_progress: 'delivered' };
const NEXT_LABEL = { assigned: 'Recogido', picked_up: 'En camino', in_progress: 'Entregado' };

function minutesAgo(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/* ---------- Ficha de pedido ----------
   Jerarquía: primero el servicio y la urgencia, luego la ruta, el precio
   y de último quién lo lleva. Es el orden en que mira un despachador. */
function OrderCard({ req, couriers, onAssign, onAdvance, onOpen }) {
  const courier = couriers.find((c) => c.id === req.courier_id);
  const minutos = Math.round((Date.now() - new Date(req.created_at).getTime()) / 60000);
  const tarde = req.status === 'requested' && minutos > 8;
  const nuevo = minutos < 2;

  return (
    <div
      onClick={() => onOpen(req)}
      className="dx-pedido"
      data-turbo={req.turbo ? 'si' : 'no'}
      data-tarde={tarde ? 'si' : 'no'}
      style={{ animation: nuevo ? 'dxEntra .45s cubic-bezier(.2,.9,.25,1) both' : 'dxUp .22s var(--ease-out) both' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="dx-pedido-icono">
          <Icon name={SERVICE_ICON[req.service_type]} size={17} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', font: '800 13px Manrope,sans-serif', letterSpacing: '-.01em' }}>
            {SERVICE_LABELS[req.service_type]}
          </span>
          <span className="num" style={{ display: 'block', font: "500 10px 'IBM Plex Mono',monospace", color: 'var(--mu)', marginTop: 1 }}>
            #{req.tracking_code}
          </span>
        </span>
        {req.turbo && (
          <span className="dx-turbo-chip"><Icon name="bolt" size={12} fill /> TURBO</span>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 9 }}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', paddingTop: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', border: '2px solid var(--mu)' }} />
          <span style={{ width: 1.5, flex: 1, minHeight: 14, background: 'var(--bd)', margin: '2px 0' }} />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
        </span>
        <span style={{ flex: 1, minWidth: 0, font: '600 11.5px/1.55 Manrope,sans-serif' }}>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mu)' }}>
            {req.pickup_address}
          </span>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.dropoff_address}
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--bd2)' }}>
        <span className={tarde ? 'dx-tarde' : ''} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name={tarde ? 'error' : 'schedule'} size={13} fill={tarde} color={tarde ? 'var(--orange)' : 'var(--mu)'} />
          <span className="num" style={{ font: "700 10.5px 'IBM Plex Mono',monospace", color: tarde ? 'var(--orange)' : 'var(--mu)' }}>
            {minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h`}
          </span>
        </span>
        <span style={{ flex: 1 }} />
        <span className="num" style={{ font: "800 16px 'IBM Plex Mono',monospace", letterSpacing: '-.03em' }}>
          {money(req.price)}
        </span>
      </div>

      {req.status === 'requested' ? (
        <div className="dx-asignar" onClick={(e) => e.stopPropagation()}>
          <Icon name="person_search" size={15} color="var(--orange)" />
          <select defaultValue="" onChange={(e) => onAssign(req.id, e.target.value)}>
            <option value="">Asignar repartidor…</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}{c.status === 'online' ? ' · libre' : c.status === 'busy' ? ' · ocupado' : ' · offline'}
              </option>
            ))}
          </select>
          <Icon name="expand_more" size={16} color="var(--orange)" />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span className="dx-avatar">{(courier?.first_name?.[0] || '?').toUpperCase()}</span>
            <span style={{ font: '600 11px Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {courier ? courier.first_name : 'Sin repartidor'}
            </span>
          </span>
          {NEXT[req.status] && (
            <button className="dx-avanzar" onClick={(e) => { e.stopPropagation(); onAdvance(req.id, NEXT[req.status]); }}>
              {NEXT_LABEL[req.status]}
              <Icon name="arrow_forward" size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}


/* ---------- Detalle lateral con mapa ---------- */
function OrderDrawer({ req, couriers, onClose, onAdvance }) {
  const [route, setRoute] = useState([]);
  const pickup = req.pickup_point || (req.pickup_lat != null ? { lat: req.pickup_lat, lon: req.pickup_lon } : null);
  const dropoff = req.dropoff_point || (req.dropoff_lat != null ? { lat: req.dropoff_lat, lon: req.dropoff_lon } : null);
  const courier = couriers.find((c) => c.id === req.courier_id);

  useEffect(() => {
    let alive = true;
    if (!pickup || !dropoff) return;
    routeBetween(pickup, dropoff).then((r) => alive && setRoute(r.coords));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.id]);

  const st = STATUS_META[req.status] || STATUS_META.requested;

  const [pin, setPin] = useState(null);
  const verPin = async () => setPin(await fetchDeliveryPin(req.id) || '----');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--scrim)', display: 'flex', justifyContent: 'flex-end', animation: 'dxFadeIn .15s ease' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sc"
        style={{ width: 'min(460px,100%)', height: '100%', overflowY: 'auto', background: 'var(--surface)', boxShadow: 'var(--elev-4)', animation: 'dxDrawer .24s var(--ease-out)' }}
      >
        <div style={{ padding: '20px 22px 16px', background: req.turbo ? 'linear-gradient(135deg,#2E7BC4,#1B4F8F)' : 'linear-gradient(135deg,#2A241E,#17140F)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <Overline style={{ color: 'rgba(255,255,255,.6)' }}>{SERVICE_LABELS[req.service_type]}</Overline>
              <div className="dsp" style={{ fontWeight: 800, fontSize: 26, marginTop: 5, letterSpacing: '.04em' }}>#{req.tracking_code}</div>
            </div>
            <button aria-label="Cerrar" onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={20} color="#fff" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
            <span className="dsp" style={{ fontWeight: 800, fontSize: 32 }}>{money(req.price)}</span>
            {req.distance_km > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, opacity: .8 }}>{Number(req.distance_km).toFixed(1)} km</span>}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Código de entrega: solo se descubre a propósito, porque es
              lo que prueba que el pedido llegó a su dueño. */}
          {OPEN_STATUSES.includes(req.status) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, background: 'var(--sf)', marginBottom: 16 }}>
              <Icon name="password" size={19} color="var(--mu)" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: '700 12.5px Manrope,sans-serif' }}>Código de entrega</span>
                <span style={{ display: 'block', font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: 1 }}>
                  Dícteselo al repartidor solo si el cliente no lo tiene
                </span>
              </span>
              {pin ? (
                <span className="num" style={{ font: "800 20px 'IBM Plex Mono',monospace", letterSpacing: '.12em' }}>{pin}</span>
              ) : (
                <Button variant="outline" onClick={verPin} style={{ height: 34, fontSize: 12 }}>Ver</Button>
              )}
            </div>
          )}

          {(pickup || dropoff) && (
            <MapView
              height={220}
              pickup={pickup}
              dropoff={dropoff}
              courier={courier?.lat != null ? { lat: courier.lat, lon: courier.lon } : null}
              route={route}
            />
          )}

          {/* Servicio Especial de Taxi si aplica */}
          {req.servicio_especial && req.servicio_especial !== 'ninguno' && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FFF3C4', color: '#795548', fontWeight: 700, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="star" size={16} fill color="#795548" />
              <span>Servicio Especial: {req.servicio_especial === 'polarizado' ? 'Vidrios polarizados' : req.servicio_especial === 'bodega' ? 'Con bodega' : req.servicio_especial}</span>
            </div>
          )}

          {/* Instrucciones Detalladas / Mandado / Encomienda */}
          {(req.instrucciones_detalladas || req.description) && (
            <Card style={{ padding: 16, marginTop: 14, borderLeft: '4px solid var(--primary)', background: 'var(--surface-container-high)' }}>
              <Overline style={{ color: 'var(--primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="description" size={15} /> Instrucciones y Detalle del Servicio
              </Overline>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--on-surface)', whiteSpace: 'pre-line', fontWeight: 500 }}>
                {req.instrucciones_detalladas || req.description}
              </div>
            </Card>
          )}

          <Card style={{ padding: 16, marginTop: 14 }}>
            <Overline style={{ color: 'var(--on-surface-variant)', marginBottom: 11 }}>Cliente</Overline>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{req.contact_name || 'Sin nombre'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--on-surface-variant)', marginTop: 2 }}>{req.contact_phone}</div>
            {req.contact_phone && (
              <a
                href={`https://wa.me/57${String(req.contact_phone).replace(/\D/g, '').slice(-10)}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 'var(--sh-sm)', background: 'var(--secondary-container)', color: 'var(--on-secondary-container)', fontSize: 12.5, fontWeight: 700 }}
              >
                <Icon name="chat" size={17} fill /> Escribir por WhatsApp
              </a>
            )}
          </Card>

          <Card style={{ padding: 16, marginTop: 14 }}>
            <Overline style={{ color: 'var(--on-surface-variant)', marginBottom: 11 }}>Recorrido</Overline>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', paddingTop: 4 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', border: '3px solid var(--primary)' }} />
                <span style={{ width: 2, flex: 1, minHeight: 22, background: 'var(--outline-variant)' }} />
              </span>
              <span style={{ flex: 1, paddingBottom: 14 }}>
                <Overline style={{ fontSize: 9.5, color: 'var(--on-surface-variant)' }}>Recoger en</Overline>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{req.pickup_address}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--primary)', flex: 'none', marginTop: 4 }} />
              <span style={{ flex: 1 }}>
                <Overline style={{ fontSize: 9.5, color: 'var(--on-surface-variant)' }}>Entregar en</Overline>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{req.dropoff_address}</span>
              </span>
            </div>
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <Chip bg={st.bg} color={st.fg}>{st.label}</Chip>
            <span style={{ flex: 1 }} />
            {NEXT[req.status] && req.status !== 'requested' && (
              <Button icon="arrow_forward" onClick={() => { onAdvance(req.id, NEXT[req.status]); onClose(); }}>
                {NEXT_LABEL[req.status]}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Alta manual de pedido (llamada / WhatsApp) ---------- */
function NuevoPedido({ onClose, onCreate, rules }) {
  const [form, setForm] = useState({
    service_type: 'mensajeria',
    contact_name: '',
    contact_phone: '',
    pickup_address: '',
    dropoff_address: '',
    distance_km: 3,
    turbo: false,
    servicio_especial: 'ninguno',
    instrucciones_detalladas: '',
    precio_personalizado: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const q = quote({ distanceKm: Number(form.distance_km) || 0, serviceType: form.service_type, turbo: form.turbo, rules });
  const precioSistema = q.total;
  const precioFinal = form.precio_personalizado !== '' && !isNaN(Number(form.precio_personalizado))
    ? Number(form.precio_personalizado)
    : precioSistema;

  // Reparto 70% para conductor / 30% para Domix
  const parteRepartidor = Math.round(precioFinal * 0.70);
  const parteDomix = Math.round(precioFinal * 0.30);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await onCreate({
      service_type: form.service_type,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      pickup_address: form.pickup_address,
      dropoff_address: form.dropoff_address,
      distance_km: Number(form.distance_km) || null,
      turbo: form.turbo,
      servicio_especial: form.servicio_especial,
      instrucciones_detalladas: form.instrucciones_detalladas,
      eta_minutes: etaMinutes(Number(form.distance_km) || 0, form.turbo),
      price: precioFinal,
      price_breakdown: {
        ...q.breakdown,
        precio_sistema_sugerido: precioSistema,
        precio_manual_aplicado: precioFinal,
        repartidor_70_pct: parteRepartidor,
        domix_30_pct: parteDomix,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    onClose();
  };

  return (
    <Card elevation={3} style={{ padding: 22, marginBottom: 18, border: '1px solid var(--outline-variant)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span className="dsp" style={{ fontWeight: 800, fontSize: 20 }}>Nuevo Pedido / Servicio Manual</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
            Ingreso telefónico o por WhatsApp con cotización automática y ajuste manual
          </span>
        </div>
        <button aria-label="Cerrar" onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={19} />
        </button>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: 14 }}>
        <label>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', marginBottom: 6 }}>Tipo de Servicio</span>
          <select value={form.service_type} onChange={set('service_type')} style={{ width: '100%', height: 52, padding: '0 14px', borderRadius: 'var(--sh-sm)', background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)', fontSize: 14.5, fontWeight: 600 }}>
            {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        {form.service_type === 'taxi' && (
          <label>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', marginBottom: 6 }}>Servicio Especial (Taxi)</span>
            <select value={form.servicio_especial} onChange={set('servicio_especial')} style={{ width: '100%', height: 52, padding: '0 14px', borderRadius: 'var(--sh-sm)', background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)', fontSize: 14.5, fontWeight: 600 }}>
              <option value="ninguno">Ninguno (Estándar)</option>
              <option value="polarizado">Vidrios polarizados</option>
              <option value="bodega">Con bodega / Maletas</option>
            </select>
          </label>
        )}

        <Field required label="Cliente" icon="person" placeholder="Nombre de quien pide" value={form.contact_name} onChange={set('contact_name')} />
        <Field required label="Celular" icon="call" type="tel" placeholder="315 792 4906" value={form.contact_phone} onChange={set('contact_phone')} />
        <Field required label="Recoger en" icon="trip_origin" placeholder="Dirección de origen" value={form.pickup_address} onChange={set('pickup_address')} />
        <Field required label="Entregar en" icon="location_on" placeholder="Dirección de destino" value={form.dropoff_address} onChange={set('dropoff_address')} />
        <Field required label="Distancia estimada (km)" icon="straighten" type="number" step="0.1" placeholder="3" value={form.distance_km} onChange={set('distance_km')} />

        <div style={{ gridColumn: '1 / -1' }}>
          <label>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', marginBottom: 6 }}>
              Instrucciones Detalladas del Mandado / Encomienda (Visible para el repartidor)
            </span>
            <textarea
              rows={2}
              placeholder="Ej: Comprar 2 bolsas de leche en la tienda de la esquina y llevarlas al piso 2 apto 201..."
              value={form.instrucciones_detalladas}
              onChange={set('instrucciones_detalladas')}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--sh-sm)',
                background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)',
                fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </label>
        </div>

        {/* MÓDULO DE TARIFAS: SISTEMA + EDICIÓN MANUAL + DESGLOSE 70/30 */}
        <div style={{
          gridColumn: '1 / -1', padding: '16px 18px', borderRadius: 'var(--sh-md)',
          background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'center',
        }}>
          {/* Opción Turbo */}
          <div>
            <button type="button" onClick={() => setForm((f) => ({ ...f, turbo: !f.turbo }))} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: form.turbo ? 'var(--tertiary)' : 'var(--on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Icon name={form.turbo ? 'check_box' : 'check_box_outline_blank'} size={20} fill={form.turbo} />
              <Icon name="bolt" size={17} fill /> Domix Turbo (Prioritario)
            </button>
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Asigna de inmediato al conductor más cercano
            </div>
          </div>

          {/* Tarifa que arroja el sistema */}
          <div style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--outline-variant)' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--on-surface-variant)' }}>
              Costo arrojado por el sistema:
            </span>
            <span className="dsp" style={{ fontWeight: 800, fontSize: 20, color: 'var(--on-surface)' }}>
              {money(precioSistema)}
            </span>
          </div>

          {/* Campo editable de tarifa final */}
          <div>
            <label style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)' }}>
                  Tarifa a Cobrar (Editable):
                </span>
                {form.precio_personalizado !== '' && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, precio_personalizado: '' }))}
                    style={{ background: 'none', border: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--tertiary)', cursor: 'pointer' }}
                  >
                    ↺ Restaurar sugerido
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--on-surface-variant)' }}>$</span>
                <input
                  type="number"
                  step="100"
                  placeholder={String(precioSistema)}
                  value={form.precio_personalizado}
                  onChange={set('precio_personalizado')}
                  style={{
                    width: '100%', height: 46, padding: '0 12px 0 28px', borderRadius: 'var(--sh-sm)',
                    background: 'var(--surface-lowest)', border: form.precio_personalizado !== '' ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                    fontSize: 18, fontWeight: 800, color: 'var(--on-surface)',
                  }}
                />
              </div>
            </label>
          </div>

          {/* Desglose 70% Repartidor / 30% Domix */}
          <div style={{
            gridColumn: '1 / -1', paddingTop: 12, borderTop: '1px dashed var(--outline-variant)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)' }}>DESGLOSE DE SERVICIO:</span>
              <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(95,191,69,0.18)', color: '#2e7d32', fontWeight: 800, fontSize: 12 }}>
                70% Conductor: {money(parteRepartidor)}
              </span>
              <span style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', color: '#1d4ed8', fontWeight: 800, fontSize: 12 }}>
                30% Domix: {money(parteDomix)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface-variant)' }}>Total a liquidar:</span>
              <span className="dsp" style={{ fontWeight: 800, fontSize: 24, color: 'var(--primary)' }}>
                {money(precioFinal)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          {error && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--error)' }}>{error}</span>}
          <span style={{ flex: 1 }} />
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon="check" disabled={busy}>{busy ? 'Creando…' : 'Crear pedido con esta tarifa'}</Button>
        </div>
      </form>
    </Card>
  );
}

function PedidosContent() {
  const params = useSearchParams();
  const { requests, couriers, loading, assign, advance, createRequest, effectiveRules } = useOps();
  const [nuevo, setNuevo] = useState(params.get('nuevo') === '1');
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');

  const q = query.toLowerCase();
  const visibles = requests.filter((r) =>
    !q || [r.contact_name, r.contact_phone, r.pickup_address, r.dropoff_address, r.tracking_code].some((v) => v?.toLowerCase().includes(q))
  );
  const entregadosHoy = visibles.filter((r) => r.status === 'delivered' && r.delivered_at && new Date(r.delivered_at).toDateString() === new Date().toDateString());

  return (
    <>
      <TopBar
        title="Pedidos en vivo"
        subtitle="El tablero se actualiza solo a medida que entran y avanzan los servicios"
        actions={<Button icon="add" onClick={() => setNuevo(true)} style={{ height: 44 }}>Nuevo pedido</Button>}
      />

      <div className="dx-content sb" style={{ animation: 'trFade .3s ease' }}>
        <GuiaSeccion
          id="pedidos"
          tono="orange"
          titulo="Aquí no se pierde ni un pedido"
          frase="Todo lo que entra —por la app, por WhatsApp o cargado a mano— cae en este tablero y avanza de columna hasta la entrega."
          puntos={[{ i: 'add_alert', t: 'Sin asignar', s: 'Elige el repartidor y sale' }, { i: 'drag_indicator', t: 'Por columnas', s: 'Sigues cada etapa de un vistazo' }, { i: 'schedule', t: 'Demorados', s: 'Los que llevan mucho esperando se marcan solos' }]}
        />


      {nuevo && <NuevoPedido rules={effectiveRules} onClose={() => setNuevo(false)} onCreate={createRequest} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 15px', borderRadius: 'var(--sh-full)', background: 'var(--surface-container)', minWidth: 280 }}>
          <Icon name="search" size={19} color="var(--on-surface-variant)" />
          <input placeholder="Cliente, dirección o código" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }} />
        </span>
        <span style={{ flex: 1 }} />
        <Chip icon="task_alt" bg="var(--secondary-container)" color="var(--on-secondary-container)" style={{ height: 34, fontSize: 12.5 }}>
          {entregadosHoy.length} entregados hoy
        </Chip>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}><Spinner /></div>
      ) : (
        <div className="dx-tablero sb">
          {BOARD_COLUMNS.map((col) => {
            const items = visibles.filter((r) => r.status === col.id);
            const tono = {
              orange: ['var(--orangeS)', 'var(--orange)'],
              navy: ['var(--navyS)', 'var(--navy)'],
              purple: ['var(--purpleS)', 'var(--purple)'],
              green: ['var(--greenS)', 'var(--green)'],
            }[col.tono] || ['var(--sf)', 'var(--mu)'];

            return (
              <div key={col.id} className="dx-columna">
                <div className="dx-col-cabeza">
                  <span className="dx-col-punto" style={{ background: tono[1] }} />
                  <Icon name={col.icon} size={16} color={tono[1]} />
                  <span className="dx-col-nombre">{col.label}</span>
                  <span
                    className="dx-col-cuenta"
                    style={{
                      background: items.length ? tono[0] : 'var(--sf)',
                      color: items.length ? tono[1] : 'var(--mu)',
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                {items.length === 0 && <div className="dx-col-vacia">{col.vacio}</div>}

                {items.map((r) => (
                  <OrderCard key={r.id} req={r} couriers={couriers} onAssign={assign} onAdvance={advance} onOpen={setDetail} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!loading && visibles.length === 0 && (
        <div style={{ marginTop: 18 }}>
          <EmptyState icon="receipt_long" title="Sin pedidos" body="Cuando un cliente pida por la app o cargues uno desde WhatsApp, aparecerá aquí al instante." />
        </div>
      )}

      {detail && <OrderDrawer req={detail} couriers={couriers} onClose={() => setDetail(null)} onAdvance={advance} />}
      </div>
    </>
  );
}

export default function PedidosPage() {
  return <Suspense fallback={<Spinner />}><PedidosContent /></Suspense>;
}
