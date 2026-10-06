'use client';

import { useEffect, useState, useCallback } from 'react';
import TopBar from '../../components/TopBar';
import GuiaSeccion from '../../components/GuiaSeccion';
import { Icon, Card, Overline, Button, Chip, Field, Spinner, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function CaliAdminPage() {
  const [tab, setTab] = useState('salidas'); // 'salidas' | 'encomiendas' | 'playeros'
  const [salidas, setSalidas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [encomiendas, setEncomiendas] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Modales
  const [modalSalida, setModalSalida] = useState(false);
  const [modalReserva, setModalReserva] = useState(null); // salida obj
  const [modalTraslado, setModalTraslado] = useState(null); // reserva obj
  const [modalPlayero, setModalPlayero] = useState(null); // salida obj

  // Formularios
  const [nuevaSalida, setNuevaSalida] = useState({
    placa: '',
    origen: 'Buenaventura',
    destino: 'Cali',
    hora_programada: '',
    puestos_totales: 4,
    minimo_pasajeros: 3,
    precio_por_puesto: 60000,
    playero_nombre: '',
  });

  const [nuevaReserva, setNuevaReserva] = useState({
    pasajero_nombre: '',
    pasajero_telefono: '',
    pasajero_email: '',
    puesto_numero: 1,
    abono_pagado: 18000,
    saldo_pendiente: 42000,
    metodo_pago: 'efectivo',
  });

  const [destinoTrasladoId, setDestinoTrasladoId] = useState('');
  const [nombrePlayeroLiq, setNombrePlayeroLiq] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resSalidas, resReservas, resEncomiendas, resChoferes] = await Promise.all([
        supabase.from('cali_salidas').select('*').order('created_at', { ascending: false }),
        supabase.from('cali_reservas').select('*').order('created_at', { ascending: false }),
        supabase.from('cali_encomiendas').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, first_name, last_name, phone_number').eq('role', 'courier'),
      ]);

      if (resSalidas.data) setSalidas(resSalidas.data);
      if (resReservas.data) setReservas(resReservas.data);
      if (resEncomiendas.data) setEncomiendas(resEncomiendas.data);
      if (resChoferes.data) setConductores(resChoferes.data);
    } catch (e) {
      console.error('Error cargando datos de Cali:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleCrearSalida = async (e) => {
    e.preventDefault();
    try {
      const hora = nuevaSalida.hora_programada || new Date(Date.now() + 3600000).toISOString();
      const { error } = await supabase.from('cali_salidas').insert([
        {
          placa: nuevaSalida.placa.trim().toUpperCase(),
          origen: nuevaSalida.origen,
          destino: nuevaSalida.destino,
          hora_programada: hora,
          puestos_totales: Number(nuevaSalida.puestos_totales),
          puestos_ocupados: 0,
          minimo_pasajeros: Number(nuevaSalida.minimo_pasajeros),
          precio_por_puesto: Number(nuevaSalida.precio_por_puesto),
          playero_nombre: nuevaSalida.playero_nombre || null,
          comision_playero: 10000,
          estado: 'en_turno',
        },
      ]);
      if (error) throw error;
      setModalSalida(false);
      setMsg({ tipo: 'ok', texto: 'Salida de camioneta programada con éxito en el turno.' });
      cargarDatos();
    } catch (err) {
      setMsg({ tipo: 'err', texto: err.message });
    }
  };

  const handleCrearReserva = async (e) => {
    e.preventDefault();
    if (!modalReserva) return;
    try {
      const puesto = (modalReserva.puestos_ocupados || 0) + 1;
      const { error } = await supabase.from('cali_reservas').insert([
        {
          salida_id: modalReserva.id,
          pasajero_nombre: nuevaReserva.pasajero_nombre.trim(),
          pasajero_telefono: nuevaReserva.pasajero_telefono.trim(),
          pasajero_email: nuevaReserva.pasajero_email.trim() || null,
          puesto_numero: puesto,
          abono_pagado: Number(nuevaReserva.abono_pagado),
          saldo_pendiente: Number(nuevaReserva.saldo_pendiente),
          metodo_pago: nuevaReserva.metodo_pago,
          estado: 'confirmada',
        },
      ]);
      if (error) throw error;

      // Incrementar cupo en la salida
      const nuevosOcupados = (modalReserva.puestos_ocupados || 0) + 1;
      const estadoNuevo = nuevosOcupados >= modalReserva.minimo_pasajeros ? 'lista_para_salir' : 'en_turno';
      await supabase.from('cali_salidas').update({
        puestos_ocupados: nuevosOcupados,
        estado: estadoNuevo,
      }).eq('id', modalReserva.id);

      setModalReserva(null);
      setMsg({ tipo: 'ok', texto: `Pasajero registrado en puesto #${puesto}. Puestos ocupados: ${nuevosOcupados}` });
      cargarDatos();
    } catch (err) {
      setMsg({ tipo: 'err', texto: err.message });
    }
  };

  const handleEjecutarTraslado = async () => {
    if (!modalTraslado || !destinoTrasladoId) return;
    try {
      const { data, error } = await supabase.rpc('trasladar_pasajero_cali', {
        p_reserva_id: Number(modalTraslado.id),
        p_nueva_salida_id: Number(destinoTrasladoId),
      });
      if (error) throw error;
      setModalTraslado(null);
      setDestinoTrasladoId('');
      setMsg({ tipo: 'ok', texto: `Pasajero ${modalTraslado.pasajero_nombre} trasladado con urgencia al vehículo ${data?.nueva_placa || 'destino'}.` });
      cargarDatos();
    } catch (err) {
      setMsg({ tipo: 'err', texto: err.message });
    }
  };

  const handleLiquidarPlayero = async () => {
    if (!modalPlayero) return;
    try {
      const { data, error } = await supabase.rpc('liquidar_playero', {
        p_salida_id: Number(modalPlayero.id),
        p_playero_nombre: nombrePlayeroLiq || modalPlayero.playero_nombre || 'Playero de Turno',
        p_monto: 10000,
      });
      if (error) throw error;
      setModalPlayero(null);
      setNombrePlayeroLiq('');
      setMsg({ tipo: 'ok', texto: `Comisión de $10,000 liquidada exitosamente al playero ${data?.playero || ''}.` });
      cargarDatos();
    } catch (err) {
      setMsg({ tipo: 'err', texto: err.message });
    }
  };

  // Stats
  const vansListas = salidas.filter((s) => s.puestos_ocupados >= s.minimo_pasajeros && s.estado !== 'completada');
  const totalPasajeros = reservas.filter((r) => r.estado !== 'cancelada').length;
  const playerosPagados = salidas.filter((s) => s.comision_playero_pagada).length * 10000;

  return (
    <>
      <TopBar title="Transporte Intermunicipal Placa Blanca (Buenaventura ⇄ Cali)" />

      <div className="dx-page sc" style={{ padding: '24px 32px' }}>
        <GuiaSeccion
          titulo="Lanzamiento Operativo: Vans Buenaventura ⇄ Cali & Encomiendas"
          subtitulo="Control de turnos, mínimo de 3 pasajeros por camioneta, traslado de pasajeros por urgencia y liquidación inmediata de playeros ($10,000 por vehículo despachado)."
        />

        {msg && (
          <div style={{
            margin: '16px 0', padding: '12px 16px', borderRadius: 12,
            background: msg.tipo === 'ok' ? 'rgba(95,191,69,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${msg.tipo === 'ok' ? 'var(--secondary)' : 'var(--error)'}`,
            color: msg.tipo === 'ok' ? '#2e7d32' : '#c62828',
            fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{msg.texto}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* Tarjetas de Métricas Clave */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '20px 0' }}>
          <Card elevation={2} style={{ padding: '16px 20px' }}>
            <Overline>Camionetas en Turno</Overline>
            <div style={{ font: '800 28px Manrope,sans-serif', marginTop: 4 }}>{salidas.filter((s) => s.estado === 'en_turno').length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>Placa Blanca en terminal/playa</div>
          </Card>

          <Card elevation={2} style={{ padding: '16px 20px', borderLeft: '4px solid #5FBF45' }}>
            <Overline>Listas para Salir (≥ 3 pax)</Overline>
            <div style={{ font: '800 28px Manrope,sans-serif', color: '#2e7d32', marginTop: 4 }}>{vansListas.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>Cumplen cupo mínimo de salida</div>
          </Card>

          <Card elevation={2} style={{ padding: '16px 20px' }}>
            <Overline>Pasajeros Registrados</Overline>
            <div style={{ font: '800 28px Manrope,sans-serif', marginTop: 4 }}>{totalPasajeros}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>Abono 30% / Saldo en terminal</div>
          </Card>

          <Card elevation={2} style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
            <Overline>Comisiones Playeros Liquidadas</Overline>
            <div style={{ font: '800 28px Manrope,sans-serif', color: '#b45309', marginTop: 4 }}>{money(playerosPagados)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mu)', marginTop: 2 }}>$10,000 por van despachada</div>
          </Card>
        </div>

        {/* Barra de Tabs y Acciones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bd)', paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setTab('salidas')}
              style={{
                padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                background: tab === 'salidas' ? 'var(--inv)' : 'var(--sf)',
                color: tab === 'salidas' ? 'var(--invtx)' : 'var(--tx)',
                border: 'none', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Icon name="directions_bus" size={18} />
              Vans & Turnos de Salida ({salidas.length})
            </button>

            <button
              onClick={() => setTab('encomiendas')}
              style={{
                padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                background: tab === 'encomiendas' ? 'var(--inv)' : 'var(--sf)',
                color: tab === 'encomiendas' ? 'var(--invtx)' : 'var(--tx)',
                border: 'none', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Icon name="local_shipping" size={18} />
              Encomiendas Cali ⇄ B/tura ({encomiendas.length})
            </button>

            <button
              onClick={() => setTab('playeros')}
              style={{
                padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                background: tab === 'playeros' ? 'var(--inv)' : 'var(--sf)',
                color: tab === 'playeros' ? 'var(--invtx)' : 'var(--tx)',
                border: 'none', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Icon name="payments" size={18} />
              Liquidación a Playeros ($10K)
            </button>
          </div>

          <Button icon="add" onClick={() => setModalSalida(true)}>
            Programar Van en Turno
          </Button>
        </div>

        {/* TAB 1: SALIDAS Y TURNOS */}
        {tab === 'salidas' && (
          <div>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
            ) : salidas.length === 0 ? (
              <EmptyState
                icon="directions_bus"
                title="No hay salidas programadas"
                body="Programa la primera van placa blanca para la ruta Buenaventura ⇄ Cali."
                action={<Button icon="add" onClick={() => setModalSalida(true)}>Crear Turno</Button>}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {salidas.map((s) => {
                  const tieneMinimo = s.puestos_ocupados >= s.minimo_pasajeros;
                  const resSalida = reservas.filter((r) => r.salida_id === s.id);

                  return (
                    <Card key={s.id} elevation={2} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            background: '#FFFFFF', color: '#000000', border: '2px solid #000000',
                            borderRadius: 6, padding: '2px 8px', font: "800 14px 'IBM Plex Mono',monospace",
                            letterSpacing: '1px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {s.placa}
                          </span>
                          <span style={{ font: '800 14px Manrope,sans-serif' }}>
                            {s.origen} ➔ {s.destino}
                          </span>
                        </div>
                        <Chip bg={tieneMinimo ? 'rgba(95,191,69,0.2)' : 'rgba(245,158,11,0.2)'} color={tieneMinimo ? '#2e7d32' : '#b45309'}>
                          {tieneMinimo ? 'LISTA PARA SALIR' : `FALTAN ${s.minimo_pasajeros - s.puestos_ocupados} PAX`}
                        </Chip>
                      </div>

                      {/* Progreso de Puestos */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                          <span>Ocupación de la Van</span>
                          <span>{s.puestos_ocupados} de {s.puestos_totales} puestos (Mínimo: {s.minimo_pasajeros})</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 5, background: 'var(--sf)', overflow: 'hidden', display: 'flex' }}>
                          <div style={{
                            width: `${(s.puestos_ocupados / s.puestos_totales) * 100}%`,
                            background: tieneMinimo ? '#5FBF45' : '#F59E0B',
                            borderRadius: 5,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>

                      {/* Pasajeros de la Van */}
                      <div style={{ background: 'var(--sf)', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--mu)', letterSpacing: '.06em', marginBottom: 8 }}>
                          PASAJEROS CONFIRMADOS ({resSalida.length})
                        </div>
                        {resSalida.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--mu)', fontStyle: 'italic' }}>Ningún pasajero registrado aún.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {resSalida.map((r) => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
                                <div>
                                  <span style={{ fontWeight: 700 }}>#{r.puesto_numero} {r.pasajero_nombre}</span>
                                  <span style={{ color: 'var(--mu)', marginLeft: 6 }}>({r.pasajero_telefono})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    title="Trasladar por urgencia a otra van"
                                    onClick={() => setModalTraslado(r)}
                                    style={{
                                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                      background: 'rgba(59,130,246,0.15)', color: '#1d4ed8', border: 'none', cursor: 'pointer',
                                    }}
                                  >
                                    Trasladar ➔
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botones de acción */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                        <Button
                          full
                          variant="outline"
                          icon="person_add"
                          onClick={() => setModalReserva(s)}
                          disabled={s.puestos_ocupados >= s.puestos_totales}
                          style={{ height: 38, fontSize: 12 }}
                        >
                          + Pasajero
                        </Button>

                        {!s.comision_playero_pagada ? (
                          <Button
                            full
                            icon="payments"
                            onClick={() => { setModalPlayero(s); setNombrePlayeroLiq(s.playero_nombre || ''); }}
                            style={{ height: 38, fontSize: 12, background: '#F59E0B' }}
                          >
                            Pagar Playero $10K
                          </Button>
                        ) : (
                          <div style={{ padding: '0 12px', height: 38, borderRadius: 10, background: 'rgba(95,191,69,0.15)', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5 }}>
                            <Icon name="check_circle" size={16} /> Playero Pago
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ENCOMIENDAS INTERMUNICIPALES */}
        {tab === 'encomiendas' && (
          <div>
            {encomiendas.length === 0 ? (
              <EmptyState
                icon="local_shipping"
                title="No hay encomiendas Cali ⇄ Buenaventura"
                body="Las encomiendas enviadas o solicitadas por clientes en la ruta Cali-Buenaventura aparecerán aquí para asignarse a conductores placa blanca."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                {encomiendas.map((e) => (
                  <Card key={e.id} elevation={2} style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>
                        {e.tipo_ruta === 'enviar_a_cali' ? '📦 Enviar Buenaventura ➔ Cali' : '📥 Traer Cali ➔ Buenaventura'}
                      </span>
                      <Chip bg="var(--sf)" color="var(--tx)">{e.estado.toUpperCase()}</Chip>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 8 }}>
                      <strong>Paquete:</strong> {e.descripcion_paquete}
                    </div>

                    <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 6 }}>
                      <strong>Remitente:</strong> {e.remitente_nombre} ({e.remitente_telefono})
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 10 }}>
                      <strong>Destinatario:</strong> {e.destinatario_nombre} ({e.destinatario_telefono})
                    </div>

                    <div style={{ background: 'var(--sf)', padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
                      <div>📍 <strong>Recogida:</strong> {e.direccion_recogida}</div>
                      <div style={{ marginTop: 4 }}>🏁 <strong>Entrega:</strong> {e.direccion_entrega}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ font: '800 16px Manrope,sans-serif' }}>{money(e.tarifa_envio || 25000)}</span>
                      <span style={{ font: "700 12px 'IBM Plex Mono',monospace", background: 'var(--bd)', padding: '2px 8px', borderRadius: 6 }}>
                        PIN: {e.codigo_entrega}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PLAYEROS */}
        {tab === 'playeros' && (
          <Card elevation={2} style={{ padding: 24 }}>
            <h3 style={{ font: '800 18px Manrope,sans-serif', marginBottom: 8 }}>Regla de Negocio: Liquidación de Playeros</h3>
            <p style={{ fontSize: 13.5, color: 'var(--mu)', lineHeight: 1.5, marginBottom: 20 }}>
              Por cada camioneta despachada con el mínimo de 3 pasajeros hacia o desde Cali, el playero encargado de turno recibe una comisión fija de $10,000 COP. Las liquidaciones se auditan de forma atómica en base de datos.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--bd)', color: 'var(--mu)' }}>
                    <th style={{ padding: '10px 14px' }}>Fecha</th>
                    <th style={{ padding: '10px 14px' }}>Placa Van</th>
                    <th style={{ padding: '10px 14px' }}>Ruta</th>
                    <th style={{ padding: '10px 14px' }}>Playero</th>
                    <th style={{ padding: '10px 14px' }}>Monto</th>
                    <th style={{ padding: '10px 14px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {salidas.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                      <td style={{ padding: '12px 14px' }}>{new Date(s.created_at).toLocaleDateString('es-CO')}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{s.placa}</td>
                      <td style={{ padding: '12px 14px' }}>{s.origen} ➔ {s.destino}</td>
                      <td style={{ padding: '12px 14px' }}>{s.playero_nombre || 'Playero Asignado'}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800 }}>$10,000</td>
                      <td style={{ padding: '12px 14px' }}>
                        {s.comision_playero_pagada ? (
                          <span style={{ color: '#2e7d32', fontWeight: 700 }}>✓ LIQUIDADO</span>
                        ) : (
                          <Button
                            style={{ height: 28, fontSize: 11, padding: '0 10px', background: '#F59E0B' }}
                            onClick={() => { setModalPlayero(s); setNombrePlayeroLiq(s.playero_nombre || ''); }}
                          >
                            Liquidar $10K
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* MODAL CREAR SALIDA */}
        {modalSalida && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={4} style={{ width: 440, padding: 24, borderRadius: 20 }}>
              <h3 style={{ font: '800 18px Manrope,sans-serif', marginBottom: 14 }}>Programar Salida Buenaventura ⇄ Cali</h3>
              <form onSubmit={handleCrearSalida} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Placa del Vehículo (Placa Blanca)">
                  <input
                    required
                    placeholder="Ej: WBG123"
                    value={nuevaSalida.placa}
                    onChange={(e) => setNuevaSalida({ ...nuevaSalida, placa: e.target.value })}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Origen">
                    <select value={nuevaSalida.origen} onChange={(e) => setNuevaSalida({ ...nuevaSalida, origen: e.target.value, destino: e.target.value === 'Buenaventura' ? 'Cali' : 'Buenaventura' })}>
                      <option value="Buenaventura">Buenaventura</option>
                      <option value="Cali">Cali</option>
                    </select>
                  </Field>
                  <Field label="Destino">
                    <input disabled value={nuevaSalida.destino} />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Puestos Totales">
                    <input type="number" min="3" max="8" value={nuevaSalida.puestos_totales} onChange={(e) => setNuevaSalida({ ...nuevaSalida, puestos_totales: e.target.value })} />
                  </Field>
                  <Field label="Mínimo Salida">
                    <input type="number" min="3" max="8" value={nuevaSalida.minimo_pasajeros} onChange={(e) => setNuevaSalida({ ...nuevaSalida, minimo_pasajeros: e.target.value })} />
                  </Field>
                </div>

                <Field label="Nombre del Playero Responsable">
                  <input placeholder="Ej: Carlos Murillo" value={nuevaSalida.playero_nombre} onChange={(e) => setNuevaSalida({ ...nuevaSalida, playero_nombre: e.target.value })} />
                </Field>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <Button full variant="outline" type="button" onClick={() => setModalSalida(false)}>Cancelar</Button>
                  <Button full type="submit">Guardar Turno</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* MODAL REGISTRAR PASAJERO */}
        {modalReserva && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={4} style={{ width: 440, padding: 24, borderRadius: 20 }}>
              <h3 style={{ font: '800 18px Manrope,sans-serif', marginBottom: 6 }}>Registrar Pasajero en Van {modalReserva.placa}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--mu)', marginBottom: 14 }}>
                Ruta {modalReserva.origen} ➔ {modalReserva.destino} · Puesto #{(modalReserva.puestos_ocupados || 0) + 1}
              </div>
              <form onSubmit={handleCrearReserva} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Nombre del Pasajero">
                  <input required placeholder="Nombre y Apellidos" value={nuevaReserva.pasajero_nombre} onChange={(e) => setNuevaReserva({ ...nuevaReserva, pasajero_nombre: e.target.value })} />
                </Field>
                <Field label="Teléfono / WhatsApp">
                  <input required placeholder="Ej: 3151234567" value={nuevaReserva.pasajero_telefono} onChange={(e) => setNuevaReserva({ ...nuevaReserva, pasajero_telefono: e.target.value })} />
                </Field>
                <Field label="Email para Boleta de Viaje (Opcional)">
                  <input type="email" placeholder="cliente@correo.com" value={nuevaReserva.pasajero_email} onChange={(e) => setNuevaReserva({ ...nuevaReserva, pasajero_email: e.target.value })} />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Abono Pagado (30%)">
                    <input type="number" value={nuevaReserva.abono_pagado} onChange={(e) => setNuevaReserva({ ...nuevaReserva, abono_pagado: e.target.value })} />
                  </Field>
                  <Field label="Saldo en Abordaje">
                    <input type="number" value={nuevaReserva.saldo_pendiente} onChange={(e) => setNuevaReserva({ ...nuevaReserva, saldo_pendiente: e.target.value })} />
                  </Field>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <Button full variant="outline" type="button" onClick={() => setModalReserva(null)}>Cancelar</Button>
                  <Button full type="submit">Confirmar Pasajero</Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* MODAL TRASLADAR PASAJERO POR URGENCIA */}
        {modalTraslado && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={4} style={{ width: 440, padding: 24, borderRadius: 20 }}>
              <h3 style={{ font: '800 18px Manrope,sans-serif', marginBottom: 6 }}>Traslado de Pasajero por Urgencia</h3>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 14 }}>
                Reasignar a <strong>{modalTraslado.pasajero_nombre}</strong> a otra camioneta con cupo que vaya a salir primero.
              </p>

              <Field label="Seleccionar Van Destino">
                <select value={destinoTrasladoId} onChange={(e) => setDestinoTrasladoId(e.target.value)}>
                  <option value="">-- Selecciona una van con cupos libres --</option>
                  {salidas
                    .filter((s) => s.id !== modalTraslado.salida_id && s.puestos_ocupados < s.puestos_totales)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.placa} ({s.origen} ➔ {s.destino}) - Cupos: {s.puestos_totales - s.puestos_ocupados} libres
                      </option>
                    ))}
                </select>
              </Field>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <Button full variant="outline" onClick={() => setModalTraslado(null)}>Cancelar</Button>
                <Button full disabled={!destinoTrasladoId} onClick={handleEjecutarTraslado}>
                  Ejecutar Traslado
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* MODAL LIQUIDAR PLAYERO */}
        {modalPlayero && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Card elevation={4} style={{ width: 420, padding: 24, borderRadius: 20 }}>
              <h3 style={{ font: '800 18px Manrope,sans-serif', marginBottom: 6 }}>Liquidar Comisión a Playero</h3>
              <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 14 }}>
                Vehículo <strong>{modalPlayero.placa}</strong> ({modalPlayero.origen} ➔ {modalPlayero.destino}).
              </p>

              <Field label="Nombre del Playero">
                <input
                  required
                  placeholder="Nombre del playero de turno"
                  value={nombrePlayeroLiq}
                  onChange={(e) => setNombrePlayeroLiq(e.target.value)}
                />
              </Field>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: 800, fontSize: 16, textAlign: 'center', margin: '14px 0' }}>
                Total a Entregar: $10,000 COP
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button full variant="outline" onClick={() => setModalPlayero(null)}>Cancelar</Button>
                <Button full onClick={handleLiquidarPlayero}>Registrar Pago</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
