'use client';

import { useState } from 'react';
import { iniciarSesion } from '../lib/auth';

/* Pantalla de acceso. Se usa igual en el panel y en la app de repartidor;
   cambian el título, el color y los roles que se admiten. */
export default function Login({
  titulo,
  subtitulo,
  rolesPermitidos,
  onEntrar,
  acento = '#2F7A24',
  logo = '/assets/domix-logo-dark-sm.webp',
}) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const res = await iniciarSesion(usuario.trim(), clave);
    setCargando(false);

    if (!res.ok) return setError(res.mensaje);

    if (rolesPermitidos && !rolesPermitidos.includes(res.sesion.rol)) {
      setError('Esta cuenta no tiene acceso aquí.');
      return;
    }
    onEntrar(res.sesion);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: '#0a0a0a', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'Manrope,system-ui,sans-serif',
    }}>
      <form onSubmit={enviar} style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Domix" width={104} height={104} style={{ width: 104, height: 104, objectFit: 'contain' }} />
          <div style={{ font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', marginTop: 10 }}>{titulo}</div>
          <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'rgba(255,255,255,.45)', marginTop: 6 }}>
            {subtitulo}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', font: '700 11.5px Manrope,sans-serif', color: 'rgba(255,255,255,.5)', marginBottom: 7 }}>
            Celular o correo
          </span>
          <input
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="+573157924906"
            style={{
              width: '100%', height: 52, padding: '0 15px', borderRadius: 13,
              background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)',
              color: '#fff', font: '600 15px Manrope,sans-serif', outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={{ display: 'block', font: '700 11.5px Manrope,sans-serif', color: 'rgba(255,255,255,.5)', marginBottom: 7 }}>
            Clave
          </span>
          <input
            required
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
            style={{
              width: '100%', height: 52, padding: '0 15px', borderRadius: 13,
              background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)',
              color: '#fff', font: '600 15px Manrope,sans-serif', outline: 'none',
            }}
          />
        </label>

        {error && (
          <div style={{
            padding: '11px 14px', borderRadius: 11, marginBottom: 14,
            background: 'rgba(240,112,94,.14)', color: '#F0705E',
            font: '600 12.5px/1.45 Manrope,sans-serif',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: '100%', height: 54, borderRadius: 14, border: 0,
            background: acento, color: '#fff', font: '700 15px Manrope,sans-serif',
            cursor: cargando ? 'default' : 'pointer', opacity: cargando ? 0.6 : 1,
          }}
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            href="/registro"
            style={{
              display: 'inline-block', color: '#5FBF45', fontWeight: 700,
              fontSize: 13, textDecoration: 'none',
            }}
          >
            ¿Nuevo conductor (Taxi / Placa Blanca / Moto)? Regístrate aquí ➔
          </a>
        </div>

        <div style={{ textAlign: 'center', font: '500 11px Manrope,sans-serif', color: 'rgba(255,255,255,.3)', marginTop: 16 }}>
          ¿Olvidaste tu clave? Escríbele a Domix al 315 792 4906
        </div>
      </form>
    </div>
  );
}
