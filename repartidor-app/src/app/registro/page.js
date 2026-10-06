'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Button, Card, Field, Spinner } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

const TIPOS_VEHICULO = [
  { id: 'taxi', label: 'Taxi Urbano', desc: 'Transporte urbano en Buenaventura', icon: 'local_taxi' },
  { id: 'placa_blanca', label: 'Placa Blanca (Cali)', desc: 'Intermunicipal Buenaventura ⇄ Cali', icon: 'directions_bus' },
  { id: 'moto', label: 'Motocicleta', desc: 'Mensajería, domicilios y encomiendas', icon: 'two_wheeler' },
  { id: 'bicicleta', label: 'Bicicleta', desc: 'Entregas locales zona céntrica', icon: 'pedal_bike' },
];

export default function RegistroConductorPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(1); // 1: Datos, 2: Código 6 dígitos, 3: Éxito
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exitoMsg, setExitoMsg] = useState('');

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    celular: '',
    email: '',
    cedula: '',
    tipoVehiculo: 'taxi',
    placa: '',
    modelo: '',
  });

  const [codigoOtp, setCodigoOtp] = useState(['', '', '', '', '', '']);

  const handleEnviarRegistro = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Llamar al API de registro con envío de correo OTP
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          telefono: form.celular.trim(),
          nombre: `${form.nombre.trim()} ${form.apellido.trim()}`.trim(),
          rol: form.tipoVehiculo === 'taxi' ? 'driver_taxi' : form.tipoVehiculo === 'placa_blanca' ? 'driver_placa_blanca' : 'courier',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar código de verificación');

      setPaso(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, valor) => {
    if (valor.length > 1) valor = valor.slice(-1);
    const nuevo = [...codigoOtp];
    nuevo[index] = valor;
    setCodigoOtp(nuevo);

    // Auto foco siguiente input
    if (valor && index < 5) {
      const siguiente = document.getElementById(`otp-input-${index + 1}`);
      if (siguiente) siguiente.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codigoOtp[index] && index > 0) {
      const previo = document.getElementById(`otp-input-${index - 1}`);
      if (previo) previo.focus();
    }
  };

  const handleConfirmarCodigo = async (e) => {
    e.preventDefault();
    const codigoStr = codigoOtp.join('');
    if (codigoStr.length < 6) return setError('Por favor ingresa los 6 dígitos completos.');

    setError('');
    setLoading(true);

    try {
      // 1. Validar código en API de confirmación
      const res = await fetch('/api/auth/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          codigo: codigoStr,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto o vencido');

      // 2. Crear o actualizar perfil y vehículo en Supabase
      const { data: perfil, error: errPerfil } = await supabase.from('profiles').insert([
        {
          first_name: form.nombre.trim(),
          last_name: form.apellido.trim(),
          phone_number: form.celular.trim(),
          email: form.email.trim(),
          role: 'courier',
          email_confirmado: true,
        },
      ]).select().single();

      if (perfil) {
        // Crear courier_profile
        await supabase.from('courier_profiles').insert([
          {
            id: perfil.id,
            document_id: form.cedula.trim(),
            status: 'offline',
            is_active: true,
          },
        ]);

        // Registrar vehículo si aplica
        if (form.placa) {
          await supabase.from('vehicles').insert([
            {
              courier_id: perfil.id,
              vehicle_type: form.tipoVehiculo,
              plate: form.placa.trim().toUpperCase(),
              model: form.modelo.trim(),
              is_active: true,
            },
          ]);
        }
      }

      setPaso(3);
      setExitoMsg('¡Cuenta y vehículo verificados exitosamente!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface)', color: 'var(--on-surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'Manrope,sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/domix-logo-dark-sm.webp" alt="Domix" style={{ width: 68, height: 68, objectFit: 'contain', margin: '0 auto' }} />
          <h1 style={{ font: '800 24px Manrope,sans-serif', letterSpacing: '-.03em', marginTop: 12 }}>
            {paso === 1 && 'Registro de Conductor'}
            {paso === 2 && 'Confirmar tu Correo'}
            {paso === 3 && '¡Bienvenido a Domix!'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            {paso === 1 && 'Únete a la flota oficial de taxis, placa blanca y mensajería en Buenaventura'}
            {paso === 2 && `Hemos enviado un código de 6 dígitos a ${form.email}`}
            {paso === 3 && 'Tu registro fue completado y tu correo está verificado'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid var(--error)', color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* PASO 1: DATOS PERSONALES Y VEHÍCULO */}
        {paso === 1 && (
          <Card elevation={2} style={{ padding: 22 }}>
            <form onSubmit={handleEnviarRegistro} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nombre(s)">
                  <input required placeholder="Ej: Andrés" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </Field>
                <Field label="Apellido(s)">
                  <input required placeholder="Ej: Riascos" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Celular / WhatsApp">
                  <input required placeholder="315 123 4567" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
                </Field>
                <Field label="Cédula de Ciudadanía">
                  <input required placeholder="Número de C.C." value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
                </Field>
              </div>

              <Field label="Correo Electrónico (para verificación)">
                <input required type="email" placeholder="tucorreo@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>

              {/* Selector de Tipo de Servicio */}
              <div>
                <label style={{ display: 'block', font: '700 11.5px Manrope,sans-serif', color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                  TIPO DE VEHÍCULO / SERVICIO
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TIPOS_VEHICULO.map((t) => {
                    const sel = form.tipoVehiculo === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setForm({ ...form, tipoVehiculo: t.id })}
                        style={{
                          cursor: 'pointer', padding: '12px 10px', borderRadius: 12,
                          border: sel ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                          background: sel ? 'var(--primary-container)' : 'var(--surface-container)',
                          color: sel ? 'var(--on-primary-container)' : 'var(--on-surface)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}>
                          <Icon name={t.icon} size={18} />
                          {t.label}
                        </div>
                        <div style={{ fontSize: 10.5, marginTop: 4, opacity: 0.8 }}>{t.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Placa del Vehículo">
                  <input required placeholder="Ej: WBG123" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Modelo / Marca">
                  <input placeholder="Ej: Chevrolet 2021" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
                </Field>
              </div>

              <Button full type="submit" disabled={loading} style={{ height: 46, fontSize: 14, marginTop: 6 }}>
                {loading ? <Spinner /> : 'Continuar y Enviar Código ➔'}
              </Button>

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                >
                  ¿Ya tienes cuenta de conductor? Inicia sesión aquí
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* PASO 2: CÓDIGO OTP DE 6 DÍGITOS */}
        {paso === 2 && (
          <Card elevation={2} style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-container)', color: 'var(--on-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="mail" size={28} />
            </div>

            <div style={{ font: '700 13px Manrope,sans-serif', color: 'var(--on-surface-variant)', marginBottom: 20 }}>
              Ingresa el código numérico de 6 dígitos que enviamos a <strong>{form.email}</strong>
            </div>

            <form onSubmit={handleConfirmarCodigo}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                {codigoOtp.map((dig, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={dig}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: 44, height: 54, borderRadius: 12, textAlign: 'center',
                      font: "800 24px 'IBM Plex Mono',monospace",
                      background: 'var(--surface-container)',
                      border: dig ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                      color: 'var(--on-surface)',
                    }}
                  />
                ))}
              </div>

              <Button full type="submit" disabled={loading} style={{ height: 46, fontSize: 14 }}>
                {loading ? <Spinner /> : 'Verificar y Activar Cuenta'}
              </Button>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', fontSize: 12, cursor: 'pointer' }}
                >
                  ← Corregir datos o correo electrónico
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* PASO 3: ÉXITO */}
        {paso === 3 && (
          <Card elevation={2} style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(95,191,69,0.18)', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="check_circle" size={36} />
            </div>

            <h2 style={{ font: '800 20px Manrope,sans-serif', marginBottom: 8 }}>{exitoMsg}</h2>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: 24 }}>
              Tu registro como conductor de <strong>{form.tipoVehiculo === 'taxi' ? 'Taxi Urbano' : form.tipoVehiculo === 'placa_blanca' ? 'Placa Blanca Buenaventura ⇄ Cali' : 'Mensajería'}</strong> ha sido verificado. Puedes ingresar a la app con tu número de celular.
            </p>

            <Button full onClick={() => router.push('/')} style={{ height: 46, fontSize: 14 }}>
              Ingresar a la App de Conductor ➔
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
