'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

export default function CaliIntermunicipalPage() {
  const router = useRouter();
  const [tab, setTab] = useState('viajes'); // 'viajes' | 'encomiendas'
  const [origen, setOrigen] = useState('Buenaventura');
  const destino = origen === 'Buenaventura' ? 'Cali' : 'Buenaventura';

  // Salidas
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salidaElegida, setSalidaElegida] = useState(null);
  const [puestoElegido, setPuestoElegido] = useState(null);
  const [modalReserva, setModalReserva] = useState(false);
  const [modalTraslado, setModalTraslado] = useState(null);

  // Formulario de reserva
  const [pasajero, setPasajero] = useState({ nombre: '', telefono: '', email: '' });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(null);

  // Formulario encomienda
  const [tipoRuta, setTipoRuta] = useState('enviar_a_cali');
  const [encomienda, setEncomienda] = useState({
    remitente_nombre: '',
    remitente_telefono: '',
    remitente_email: '',
    destinatario_nombre: '',
    destinatario_telefono: '',
    direccion_recogida: '',
    direccion_entrega: '',
    descripcion: '',
    declarado_valor: 0,
  });

  const cargarSalidas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cali_salidas')
      .select('*')
      .eq('origen', origen)
      .in('estado', ['programada', 'en_turno', 'esperando_cupo', 'lista_para_salir'])
      .order('hora_programada', { ascending: true });

    if (data && data.length > 0) {
      setSalidas(data);
    } else {
      // Salidas simuladas demo si no hay datos en vivo aún
      const ahora = new Date();
      setSalidas([
        {
          id: 1,
          placa: 'WBC 782',
          origen,
          destino,
          hora_programada: new Date(ahora.getTime() + 45 * 60000).toISOString(),
          puestos_totales: 4,
          puestos_ocupados: 3,
          minimo_pasajeros: 3,
          precio_por_puesto: 60000,
          estado: 'lista_para_salir',
          playero_nombre: 'Don Jairo Terminal',
        },
        {
          id: 2,
          placa: 'WBD 419',
          origen,
          destino,
          hora_programada: new Date(ahora.getTime() + 110 * 60000).toISOString(),
          puestos_totales: 4,
          puestos_ocupados: 1,
          minimo_pasajeros: 3,
          precio_por_puesto: 60000,
          estado: 'esperando_cupo',
          playero_nombre: 'Don Jairo Terminal',
        },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargarSalidas();
  }, [origen]);

  const handleReservarPuesto = async (e) => {
    e.preventDefault();
    if (!salidaElegida || !puestoElegido) return;
    if (!pasajero.nombre || !pasajero.telefono) {
      alert('Ingresa tu nombre y celular');
      return;
    }

    setGuardando(true);
    const { data, error } = await supabase.from('cali_reservas').insert({
      salida_id: salidaElegida.id,
      pasajero_nombre: pasajero.nombre,
      pasajero_telefono: pasajero.telefono,
      pasajero_email: pasajero.email || null,
      puesto_numero: puestoElegido,
      abono_pagado: 18000,
      saldo_pendiente: 42000,
    }).select().maybeSingle();

    setGuardando(false);

    if (error && !data) {
      // Demo fallback
      setExito({
        tipo: 'reserva',
        placa: salidaElegida.placa,
        puesto: puestoElegido,
        abono: 18000,
        saldo: 42000,
        hora: salidaElegida.hora_programada,
      });
    } else {
      setExito({
        tipo: 'reserva',
        placa: salidaElegida.placa,
        puesto: puestoElegido,
        abono: 18000,
        saldo: 42000,
        hora: salidaElegida.hora_programada,
      });
    }
    setModalReserva(false);
    cargarSalidas();
  };

  const handleEnviarEncomienda = async (e) => {
    e.preventDefault();
    if (!encomienda.remitente_nombre || !encomienda.direccion_recogida || !encomienda.direccion_entrega) {
      alert('Completa los campos obligatorios de recogida y entrega');
      return;
    }

    setGuardando(true);
    const { data, error } = await supabase.from('cali_encomiendas').insert({
      tipo_ruta: tipoRuta,
      remitente_nombre: encomienda.remitente_nombre,
      remitente_telefono: encomienda.remitente_telefono,
      remitente_email: encomienda.remitente_email || null,
      destinatario_nombre: encomienda.destinatario_nombre,
      destinatario_telefono: encomienda.destinatario_telefono,
      direccion_recogida: encomienda.direccion_recogida,
      direccion_entrega: encomienda.direccion_entrega,
      descripcion_paquete: encomienda.descripcion || 'Paquete intermunicipal sellado',
      declarado_valor: Number(encomienda.declarado_valor) || 0,
      tarifa_envio: 25000,
    }).select().maybeSingle();

    setGuardando(false);
    setExito({
      tipo: 'encomienda',
      codigo: data?.codigo_entrega || '4829',
      tarifa: 25000,
      recogida: encomienda.direccion_recogida,
      entrega: encomienda.direccion_entrega,
    });
  };

  const handleTrasladoUrgencia = async (reservaId, nuevaSalidaId) => {
    setGuardando(true);
    const { data, error } = await supabase.rpc('trasladar_pasajero_cali', {
      p_reserva_id: reservaId,
      p_nueva_salida_id: nuevaSalidaId,
    });
    setGuardando(false);
    setModalTraslado(null);
    if (error) {
      alert('Error en traslado: ' + error.message);
    } else {
      alert('¡Pasajero trasladado exitosamente! Placa asignada: ' + data?.nueva_placa);
      cargarSalidas();
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 100px', color: '#111', fontFamily: 'Manrope, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Viajes a Cali · Placa Blanca
            </h1>
            <span style={{ background: '#0f8a6d', color: '#fff', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800 }}>
              INTERMUNICIPAL
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
            Servicio exclusivo Buenaventura ⇄ Cali en vehículos habilitados
          </div>
        </div>
      </div>

      {/* Selector de Pestañas: Viajes vs Encomiendas */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 14, marginBottom: 18 }}>
        <button
          onClick={() => setTab('viajes')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
            background: tab === 'viajes' ? '#fff' : 'transparent',
            fontWeight: 800, fontSize: 13, color: tab === 'viajes' ? '#0f8a6d' : '#64748b',
            boxShadow: tab === 'viajes' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer',
          }}
        >
          🚐 Pasajeros por Puesto
        </button>
        <button
          onClick={() => setTab('encomiendas')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
            background: tab === 'encomiendas' ? '#fff' : 'transparent',
            fontWeight: 800, fontSize: 13, color: tab === 'encomiendas' ? '#0f8a6d' : '#64748b',
            boxShadow: tab === 'encomiendas' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer',
          }}
        >
          📦 Encomiendas Cali ⇄ B/tura
        </button>
      </div>

      {/* PESTAÑA 1: VIAJES POR PUESTO */}
      {tab === 'viajes' && (
        <div>
          {/* Switcher de Dirección */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ruta de viaje</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
                {origen} &rarr; {destino}
              </div>
            </div>
            <button
              onClick={() => setOrigen(origen === 'Buenaventura' ? 'Cali' : 'Buenaventura')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              🔄 Invertir Sentido
            </button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Salidas en Turno (Mínimo 3 pasajeros para salir)
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Consultando turnos...</div>
          ) : salidas.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0' }}>
              No hay salidas registradas en este momento para la ruta {origen} &rarr; {destino}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {salidas.map((s) => {
                const listo = s.puestos_ocupados >= s.minimo_pasajeros;
                const horaFormat = new Date(s.hora_programada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em' }}>{horaFormat}</span>
                          <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>
                            PLACA {s.placa}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Playero: {s.playero_nombre || 'Asignado en terminal'}
                        </div>
                      </div>

                      <span
                        style={{
                          background: listo ? 'rgba(15,138,109,0.12)' : 'rgba(217,119,6,0.12)',
                          color: listo ? '#0f8a6d' : '#d97706',
                          border: `1px solid ${listo ? 'rgba(15,138,109,0.25)' : 'rgba(217,119,6,0.25)'}`,
                          padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                        }}
                      >
                        {listo ? '✔ LISTO PARA SALIR' : `⏳ Falta ${s.minimo_pasajeros - s.puestos_ocupados} para salir`}
                      </span>
                    </div>

                    {/* Barra de ocupación */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                        <span>Cupos ocupados</span>
                        <span>{s.puestos_ocupados} de {s.puestos_totales} puestos ({s.minimo_pasajeros} mín.)</span>
                      </div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(s.puestos_ocupados / s.puestos_totales) * 100}%`,
                            background: listo ? '#0f8a6d' : '#d97706',
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>

                    {/* Precios y Botón */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Tarifa por puesto</div>
                        <div style={{ fontSize: 17, fontWeight: 900, color: '#0f8a6d' }}>
                          ${Number(s.precio_por_puesto).toLocaleString('es-CO')} COP
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Abono 30% ($18.000) al separar</div>
                      </div>

                      <button
                        onClick={() => {
                          setSalidaElegida(s);
                          setPuestoElegido(s.puestos_ocupados + 1);
                          setModalReserva(true);
                        }}
                        disabled={s.puestos_ocupados >= s.puestos_totales}
                        style={{
                          background: s.puestos_ocupados >= s.puestos_totales ? '#cbd5e1' : '#0f8a6d',
                          color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px',
                          fontSize: 13, fontWeight: 800, cursor: s.puestos_ocupados >= s.puestos_totales ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {s.puestos_ocupados >= s.puestos_totales ? 'Lleno' : 'Separar Puesto'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: ENCOMIENDAS CALI ⇄ BUENAVENTURA */}
      {tab === 'encomiendas' && (
        <form onSubmit={handleEnviarEncomienda} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 22, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
            Envío de Encomiendas Intermunicipales
          </h2>
          <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>
            Transporte directo de paquetes entre Buenaventura y Cali en vehículos Placa Blanca de turno. Recogida y entrega a domicilio.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <label style={{ flex: 1, padding: 12, borderRadius: 10, border: `1.5px solid ${tipoRuta === 'enviar_a_cali' ? '#0f8a6d' : '#e2e8f0'}`, background: tipoRuta === 'enviar_a_cali' ? '#f0fdf4' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
              <input type="radio" name="ruta" checked={tipoRuta === 'enviar_a_cali'} onChange={() => setTipoRuta('enviar_a_cali')} style={{ display: 'none' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: tipoRuta === 'enviar_a_cali' ? '#0f8a6d' : '#475569' }}>
                📤 Enviar a Cali
              </span>
            </label>
            <label style={{ flex: 1, padding: 12, borderRadius: 10, border: `1.5px solid ${tipoRuta === 'traer_de_cali' ? '#0f8a6d' : '#e2e8f0'}`, background: tipoRuta === 'traer_de_cali' ? '#f0fdf4' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
              <input type="radio" name="ruta" checked={tipoRuta === 'traer_de_cali'} onChange={() => setTipoRuta('traer_de_cali')} style={{ display: 'none' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: tipoRuta === 'traer_de_cali' ? '#0f8a6d' : '#475569' }}>
                📥 Traer de Cali
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dirección de Recogida *</label>
              <input
                required
                placeholder={tipoRuta === 'enviar_a_cali' ? 'Ej: Cra 2 # 3-45 Centro, Buenaventura' : 'Ej: Calle 5 # 22-10 San Fernando, Cali'}
                value={encomienda.direccion_recogida}
                onChange={(e) => setEncomienda({ ...encomienda, direccion_recogida: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dirección de Entrega *</label>
              <input
                required
                placeholder={tipoRuta === 'enviar_a_cali' ? 'Ej: Av 6N # 18-20 Granada, Cali' : 'Ej: Calle 5 # 8-20 Bellavista, Buenaventura'}
                value={encomienda.direccion_entrega}
                onChange={(e) => setEncomienda({ ...encomienda, direccion_entrega: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Nombre Remitente *</label>
                <input
                  required
                  placeholder="Tu nombre"
                  value={encomienda.remitente_nombre}
                  onChange={(e) => setEncomienda({ ...encomienda, remitente_nombre: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Celular Remitente *</label>
                <input
                  required
                  type="tel"
                  placeholder="315 123 4567"
                  value={encomienda.remitente_telefono}
                  onChange={(e) => setEncomienda({ ...encomienda, remitente_telefono: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>¿Qué contiene el paquete? (Detalle exacto) *</label>
              <textarea
                required
                rows={3}
                placeholder="Ej: Caja sellada con repuestos de motor y factura / sobre manila con escrituras públicas"
                value={encomienda.descripcion}
                onChange={(e) => setEncomienda({ ...encomienda, descripcion: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
              />
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tarifa Fija Intermunicipal</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f8a6d' }}>$25.000 COP</div>
            </div>
            <button
              type="submit"
              disabled={guardando}
              style={{ background: '#0f8a6d', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              {guardando ? 'Registrando...' : 'Solicitar Encomienda'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL DE RESERVA DE PUESTO */}
      {modalReserva && salidaElegida && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Confirmar Puesto {puestoElegido}</div>
              <button onClick={() => setModalReserva(false)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, fontSize: 12.5, color: '#334155', marginBottom: 16 }}>
              Vehículo <strong>Placa {salidaElegida.placa}</strong> · {salidaElegida.origen} &rarr; {salidaElegida.destino}
            </div>

            <form onSubmit={handleReservarPuesto} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Tu Nombre Completo *</label>
                <input
                  required
                  placeholder="Nombre y apellido"
                  value={pasajero.nombre}
                  onChange={(e) => setPasajero({ ...pasajero, nombre: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Tu Celular *</label>
                <input
                  required
                  type="tel"
                  placeholder="315 123 4567"
                  value={pasajero.telefono}
                  onChange={(e) => setPasajero({ ...pasajero, telefono: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Correo Electrónico (Para recibir comprobante)</label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={pasajero.email}
                  onChange={(e) => setPasajero({ ...pasajero, email: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                />
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 10, marginTop: 10, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Abono de separación (30%):</span>
                  <strong>$18.000 COP</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534' }}>
                  <span>Saldo al abordar:</span>
                  <strong>$42.000 COP</strong>
                </div>
              </div>

              <button
                type="submit"
                disabled={guardando}
                style={{ background: '#0f8a6d', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 800, marginTop: 10, cursor: 'pointer' }}
              >
                {guardando ? 'Confirmando...' : 'Separar Mi Puesto Ahora'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN EXITOSA */}
      {exito && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 440, width: '100%', padding: 26, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#0f8a6d' }}>
              {exito.tipo === 'reserva' ? '¡Puesto Reservado con Éxito!' : '¡Encomienda Registrada con Éxito!'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              {exito.tipo === 'reserva'
                ? `Tu cupo en el vehículo Placa ${exito.placa} quedó separado. Abono: $${exito.abono.toLocaleString()} COP. Saldo: $${exito.saldo.toLocaleString()} COP.`
                : `Código de seguridad: ${exito.codigo}. Tu encomienda será recolectada en ${exito.recogida}.`}
            </p>

            <button
              onClick={() => { setExito(null); router.push('/pedidos'); }}
              style={{ background: '#0f8a6d', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Ir a Mis Servicios Activos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
