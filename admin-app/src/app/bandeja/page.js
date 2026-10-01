'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '../../components/TopBar';
import GuiaSeccion from '../../components/GuiaSeccion';
import { Icon, Card, Button, Pill, Spinner, EmptyState } from '../../components/ui';
import { useOps } from '../../context/OpsProvider';
import { useAppMode } from '../../context/AppModeProvider';
import {
  fetchConversaciones, fetchMensajes, marcarLeida, cambiarEstado,
  guardarBorrador, registrarSalida, suscribirBandeja, ESTADOS_CONV,
} from '../../lib/whatsapp';
import { CONVERSACIONES_DEMO, BORRADORES_DEMO } from '../../lib/demoWhatsapp';
import { SERVICE_LABELS, SERVICE_ICON, createRequestFromAdmin } from '../../lib/ops';
import { money } from '../../lib/pricing';

function hace(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

/* ---------- Borrador que propone la IA ---------- */
function Borrador({ borrador, onCrear, creando, onResponder }) {
  const info = SERVICE_LABELS[borrador.service_type];
  const tono = { alta: 'green', media: 'amber', baja: 'red' }[borrador.confianza];

  if (!borrador.es_pedido) {
    return (
      <Card style={{ background: 'var(--sf)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <Icon name="info" size={18} color="var(--mu)" />
          <span style={{ font: '700 13px Manrope,sans-serif' }}>No parece un pedido</span>
        </div>
        <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginBottom: 12 }}>
          La IA no encontró un servicio que despachar en este chat.
        </div>
        {borrador.respuesta_sugerida && (
          <Button variant="outline" icon="reply" onClick={() => onResponder(borrador.respuesta_sugerida)} style={{ width: '100%' }}>
            Responder igual
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <Icon name="auto_awesome" size={18} color="var(--green)" />
        <span style={{ flex: 1, font: '800 14px Manrope,sans-serif' }}>Borrador de la IA</span>
        <Pill tone={tono}>Confianza {borrador.confianza}</Pill>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, background: 'var(--sf)', marginBottom: 10 }}>
        <Icon name={SERVICE_ICON[borrador.service_type]} size={19} color="var(--mu)" />
        <span style={{ flex: 1, font: '700 13px Manrope,sans-serif' }}>{info}</span>
        {borrador.turbo && <Pill tone="navy" icon="bolt">TURBO</Pill>}
      </div>

      {[
        { l: 'Cliente', v: borrador.contact_name, i: 'person' },
        { l: 'Celular', v: borrador.contact_phone, i: 'call' },
        { l: 'Recoge en', v: borrador.pickup_address, i: 'trip_origin' },
        { l: 'Entrega en', v: borrador.dropoff_address, i: 'location_on' },
        { l: 'Detalle', v: borrador.description, i: 'notes' },
      ].map((f) => (
        <div key={f.l} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid var(--bd2)' }}>
          <Icon name={f.i} size={16} color="var(--mu)" style={{ marginTop: 2 }} />
          <span style={{ flex: 'none', width: 78, font: '600 11.5px Manrope,sans-serif', color: 'var(--mu)' }}>{f.l}</span>
          <span style={{ flex: 1, font: '600 12.5px/1.45 Manrope,sans-serif', color: f.v ? 'var(--tx)' : 'var(--mu)' }}>
            {f.v || '—'}
          </span>
        </div>
      ))}

      {borrador.falta?.length > 0 && (
        <div style={{ marginTop: 13, padding: 12, borderRadius: 11, background: 'var(--amberS)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '700 11.5px Manrope,sans-serif', color: 'var(--amber)' }}>
            <Icon name="help" size={15} fill /> Falta preguntar
          </div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, font: '500 12px/1.5 Manrope,sans-serif', color: 'var(--amber)' }}>
            {borrador.falta.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {borrador.respuesta_sugerida && (
        <div style={{ marginTop: 13 }}>
          <div style={{ font: '600 11.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: 6 }}>
            Respuesta sugerida
          </div>
          <div style={{ padding: 12, borderRadius: 11, background: 'var(--greenS)', font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--tx)' }}>
            {borrador.respuesta_sugerida}
          </div>
          <Button variant="outline" icon="send" onClick={() => onResponder(borrador.respuesta_sugerida)} style={{ width: '100%', marginTop: 9 }}>
            Enviar esta respuesta
          </Button>
        </div>
      )}

      <Button
        variant="green" icon="check_circle" onClick={onCrear} disabled={creando}
        style={{ width: '100%', marginTop: 12 }}
      >
        {creando ? 'Creando pedido…' : 'Confirmar y crear el pedido'}
      </Button>
    </Card>
  );
}

/* ---------- Pantalla ---------- */
export default function BandejaPage() {
  const router = useRouter();
  const { isDemo } = useAppMode();
  const { reload } = useOps();

  const [convs, setConvs] = useState([]);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [borrador, setBorradorLocal] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [respuesta, setRespuesta] = useState('');

  const cargar = useCallback(async () => {
    if (isDemo) {
      setConvs(CONVERSACIONES_DEMO);
      setLoading(false);
      return;
    }
    try {
      setConvs(await fetchConversaciones());
    } catch { setConvs([]); } finally { setLoading(false); }
  }, [isDemo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (isDemo) return;
    return suscribirBandeja(cargar);
  }, [isDemo, cargar]);

  const abrir = async (c) => {
    setActiva(c);
    setBorradorLocal(c.ai_draft || null);
    setError('');
    if (isDemo) return setMensajes(c.mensajes || []);
    setMensajes(await fetchMensajes(c.id));
    if (c.unread_count > 0) { await marcarLeida(c.id); cargar(); }
  };

  const leerConIA = async () => {
    setLeyendo(true);
    setError('');
    if (isDemo) {
      // En Demo se muestra el borrador de ejemplo, sin gastar una llamada real.
      await new Promise((r) => setTimeout(r, 900));
      setBorradorLocal(BORRADORES_DEMO[activa.id] || null);
      setLeyendo(false);
      return;
    }
    try {
      const res = await fetch('/api/leer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo leer el chat.');
      setBorradorLocal(data.borrador);
      guardarBorrador(activa.id, data.borrador);
    } catch (e) {
      setError(e.message);
    } finally {
      setLeyendo(false);
    }
  };

  const crearPedido = async () => {
    setCreando(true);
    setError('');
    const payload = {
      service_type: borrador.service_type,
      contact_name: borrador.contact_name || activa.display_name,
      contact_phone: borrador.contact_phone || activa.wa_id.replace(/^57/, ''),
      pickup_address: borrador.pickup_address,
      dropoff_address: borrador.dropoff_address,
      description: borrador.description || null,
      turbo: borrador.turbo,
      source: 'whatsapp',
      status: 'requested',
    };

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 700));
      setCreando(false);
      setError('');
      return router.push('/pedidos');
    }

    const { error: err } = await createRequestFromAdmin({ ...payload, conversation_id: activa.id });
    setCreando(false);
    if (err) return setError(err.message);
    await cambiarEstado(activa.id, 'atendida');
    reload();
    router.push('/pedidos');
  };

  const responder = async (texto) => {
    setRespuesta('');
    if (isDemo) {
      setMensajes((m) => [...m, { direction: 'saliente', body: texto, author: 'domix', created_at: new Date().toISOString() }]);
      return;
    }
    const { error: err } = await registrarSalida(activa.id, texto, activa.wa_id);
    if (err) {
      setError(err);
      setRespuesta(texto);   // no se perdió lo que ya había escrito
      return;
    }
    setError('');
    setMensajes(await fetchMensajes(activa.id));
  };

  const sinLeer = convs.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <>
      <TopBar
        title="Bandeja de WhatsApp"
        subtitle={sinLeer > 0 ? `${sinLeer} mensajes sin leer` : 'Todo al día'}
      />

      <div className="dx-content sb" style={{ animation: 'trFade .3s ease' }}>
        <GuiaSeccion
          id="bandeja"
          tono="green"
          titulo="WhatsApp sin copiar y pegar"
          frase="Los mensajes de tus clientes llegan aquí. La IA lee el chat y arma el pedido; tú solo confirmas."
          puntos={[{ i: 'auto_awesome', t: 'Lee el chat', s: 'Saca direcciones, servicio y urgencia' }, { i: 'help', t: 'Qué falta', s: 'Te dice qué preguntarle al cliente' }, { i: 'send', t: 'Respuesta lista', s: 'Redactada, para enviar de una' }]}
        />

        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

        {!loading && convs.length === 0 && (
          <EmptyState
            icon="chat"
            title="Sin conversaciones"
            body="Cuando conectes el número de WhatsApp Business, los mensajes de los clientes aparecerán aquí."
          />
        )}

        {convs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr) 340px', gap: 14, alignItems: 'start' }}>

            {/* Lista de conversaciones */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {convs.map((c, i) => {
                const on = activa?.id === c.id;
                const est = ESTADOS_CONV[c.status] || ESTADOS_CONV.abierta;
                return (
                  <button
                    key={c.id}
                    onClick={() => abrir(c)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '13px 15px',
                      borderTop: i ? '1px solid var(--bd2)' : 'none',
                      background: on ? 'var(--sf)' : 'transparent',
                      borderLeft: `3px solid ${on ? 'var(--green)' : 'transparent'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--greenS)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 13px Manrope,sans-serif', flex: 'none' }}>
                        {(c.display_name?.[0] || '?').toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', font: '700 13px Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.display_name || c.wa_id}
                        </span>
                        <span className="num" style={{ display: 'block', font: "500 10.5px 'IBM Plex Mono',monospace", color: 'var(--mu)' }}>
                          {hace(c.last_message_at)}
                        </span>
                      </span>
                      {c.unread_count > 0 && (
                        <span className="num" style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: 99, background: 'var(--green)', color: '#fff', font: "700 10.5px 'IBM Plex Mono',monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <div style={{ font: '500 11.5px/1.4 Manrope,sans-serif', color: 'var(--mu)', marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.last_message_preview}
                    </div>
                    <div style={{ marginTop: 7 }}><Pill tone={est.tone}>{est.label}</Pill></div>
                  </button>
                );
              })}
            </Card>

            {/* Hilo de mensajes */}
            <Card style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
              {!activa ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--mu)', font: '500 13px Manrope,sans-serif' }}>
                  Elige una conversación para leerla
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--bd2)' }}>
                    <Icon name="chat" size={18} color="var(--green)" />
                    <span style={{ flex: 1, font: '800 14px Manrope,sans-serif' }}>{activa.display_name || activa.wa_id}</span>
                    <span className="num" style={{ font: "500 11px 'IBM Plex Mono',monospace", color: 'var(--mu)' }}>+{activa.wa_id}</span>
                  </div>

                  <div className="sb" style={{ flex: 1, overflowY: 'auto', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 380 }}>
                    {mensajes.map((m, i) => {
                      const mio = m.direction === 'saliente';
                      return (
                        <div key={m.id || i} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '78%', padding: '10px 13px', borderRadius: 14,
                            background: mio ? 'var(--greenS)' : 'var(--sf)',
                            borderBottomRightRadius: mio ? 4 : 14,
                            borderBottomLeftRadius: mio ? 14 : 4,
                          }}>
                            <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif' }}>{m.body}</div>
                            <div className="num" style={{ font: "500 9.5px 'IBM Plex Mono',monospace", color: 'var(--mu)', marginTop: 4, textAlign: 'right' }}>
                              {m.author === 'ia' ? 'IA · ' : ''}{hace(m.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 9, paddingTop: 12, borderTop: '1px solid var(--bd2)' }}>
                    <input
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && respuesta.trim()) responder(respuesta.trim()); }}
                      placeholder="Escribe una respuesta…"
                      style={{ flex: 1, height: 42, padding: '0 14px', borderRadius: 11, background: 'var(--sf)', font: '600 13px Manrope,sans-serif' }}
                    />
                    <Button icon="send" onClick={() => respuesta.trim() && responder(respuesta.trim())} style={{ height: 42 }}>
                      Enviar
                    </Button>
                  </div>
                </>
              )}
            </Card>

            {/* Panel de la IA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activa && !borrador && (
                <Card style={{ textAlign: 'center', padding: 22 }}>
                  <Icon name="auto_awesome" size={26} color="var(--green)" />
                  <div style={{ font: '800 14px Manrope,sans-serif', marginTop: 10 }}>Leer con IA</div>
                  <div style={{ font: '500 12px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginTop: 6, marginBottom: 14 }}>
                    La IA lee el chat y arma el pedido. Tú solo confirmas.
                  </div>
                  <Button variant="green" icon="auto_awesome" onClick={leerConIA} disabled={leyendo} style={{ width: '100%' }}>
                    {leyendo ? 'Leyendo…' : 'Leer conversación'}
                  </Button>
                </Card>
              )}

              {borrador && (
                <Borrador borrador={borrador} onCrear={crearPedido} creando={creando} onResponder={responder} />
              )}

              {error && (
                <Card style={{ background: 'var(--redS)', padding: 14 }}>
                  <div style={{ display: 'flex', gap: 9, font: '600 12px/1.45 Manrope,sans-serif', color: 'var(--red)' }}>
                    <Icon name="error" size={17} fill /> {error}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
