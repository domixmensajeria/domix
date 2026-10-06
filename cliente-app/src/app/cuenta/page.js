'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '../../components/BottomNav';
import { Icon, Row, Field, Button, Pill, SectionTitle } from '../../components/ui';
import { useClientSession } from '../../context/ClientSessionProvider';
import { useTheme } from '../../context/ThemeProvider';
import { useIdioma } from '../../context/IdiomaProvider';
import { notificationPermission, requestNotificationPermission } from '../../lib/notify';

const WHATSAPP = 'https://wa.me/573157924906';

/* Dos opciones de tema y dos de idioma. En ambos casos se quitó el
   "automático": un ajuste que decide solo no se puede comprobar de un
   vistazo, y la gente lo tocaba dos veces creyendo que no funcionaba. */
const TEMAS = [
  { id: 'light', clave: 'claro', icon: 'light_mode' },
  { id: 'dark', clave: 'oscuro', icon: 'dark_mode' },
];

const IDIOMAS = [
  { id: 'es', clave: 'espanol', corto: 'ES' },
  { id: 'en', clave: 'ingles', corto: 'EN' },
];

/* Selector de dos posiciones, el mismo dibujo para tema e idioma: la
   pantalla se lee más rápido cuando dos ajustes parecidos se ven igual. */
function Duo({ opciones, valor, onChange, render }) {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {opciones.map((o) => {
        const on = valor === o.id;
        return (
          <button
            key={o.id}
            className="dx-toque"
            onClick={() => onChange(o.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 8px',
              borderRadius: 15, font: '700 13px Manrope,sans-serif',
              background: on ? 'var(--inv)' : 'var(--sf)',
              color: on ? 'var(--invtx)' : 'var(--tx)',
              transition: 'background .2s var(--ease), color .2s var(--ease)',
            }}
          >
            {render(o, on)}
          </button>
        );
      })}
    </div>
  );
}

export default function CuentaPage() {
  const router = useRouter();
  const { client, saveClient, clearClient } = useClientSession();
  const { theme, changeTheme } = useTheme();
  const { idioma, cambiarIdioma, t } = useIdioma();

  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saved, setSaved] = useState(false);
  const [perm, setPerm] = useState('default');
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [mostrandoOtp, setMostrandoOtp] = useState(false);
  const [codigoOtp, setCodigoOtp] = useState('');
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [otpMensaje, setOtpMensaje] = useState('');

  useEffect(() => {
    setForm({ name: client?.name || '', phone: client?.phone || '', email: client?.email || '' });
    setEmailVerificado(Boolean(client?.email_confirmado));
    setPerm(notificationPermission());
  }, [client]);

  const guardar = (e) => {
    e.preventDefault();
    saveClient({ name: form.name, phone: form.phone, email: form.email, email_confirmado: emailVerificado });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const enviarOtp = async () => {
    if (!form.email || !form.email.includes('@')) {
      return setOtpMensaje('Ingresa un correo electrónico válido');
    }
    setEnviandoOtp(true);
    setOtpMensaje('');
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), telefono: form.phone.trim(), nombre: form.name.trim(), rol: 'client' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al enviar código');
      setMostrandoOtp(true);
      setOtpMensaje('Código de 6 dígitos enviado a tu correo');
    } catch (err) {
      setOtpMensaje(err.message);
    } finally {
      setEnviandoOtp(false);
    }
  };

  const confirmarOtp = async () => {
    if (codigoOtp.trim().length !== 6) return setOtpMensaje('Ingresa el código de 6 dígitos');
    setEnviandoOtp(true);
    setOtpMensaje('');
    try {
      const res = await fetch('/api/auth/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), codigo: codigoOtp.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Código incorrecto o expirado');
      setEmailVerificado(true);
      setMostrandoOtp(false);
      saveClient({ name: form.name, phone: form.phone, email: form.email, email_confirmado: true });
      setOtpMensaje('¡Correo verificado con éxito!');
    } catch (err) {
      setOtpMensaje(err.message);
    } finally {
      setEnviandoOtp(false);
    }
  };

  const entra = (n) => ({ animation: `dxSube .34s cubic-bezier(.2,.8,.2,1) ${n * 45}ms both` });

  return (
    <>
      <div className="sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '10px 0 104px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 18px', ...entra(0) }}>
          <div style={{ font: '800 26px Manrope,sans-serif', letterSpacing: '-.035em' }}>{t('cuenta.titulo')}</div>
        </div>

        <div style={{ padding: '0 16px 22px', ...entra(1) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 17, borderRadius: 18, background: 'var(--sf)' }}>
            <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 19px Manrope,sans-serif', flex: 'none', boxShadow: 'var(--sh2)' }}>
              {(client?.name?.[0] || 'D').toUpperCase()}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '800 17px Manrope,sans-serif', letterSpacing: '-.02em' }}>
                {client?.name || t('cuenta.sinNombre')}
              </span>
              <span style={{ display: 'block', font: '500 12.5px/1.4 Manrope,sans-serif', color: 'var(--mu)', marginTop: 3 }}>
                {client?.phone || t('cuenta.subtitulo')}
              </span>
            </span>
          </div>
        </div>

        <div style={entra(2)}>
          <SectionTitle>{t('cuenta.misDatos')}</SectionTitle>
          <form onSubmit={guardar} style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
            <Field
              label={t('cuenta.nombre')} icon="person"
              placeholder={t('cuenta.nombre')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Field
              label={t('cuenta.celular')} icon="call" type="tel"
              placeholder="315 792 4906"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />

            <div>
              <Field
                label="Correo electrónico" icon="mail" type="email"
                placeholder="cliente@correo.com"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setEmailVerificado(false); }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, padding: '0 4px' }}>
                {emailVerificado ? (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check_circle" size={15} /> Correo verificado con código
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--mu)' }}>
                    Para recibir recibos y boletas de viaje
                  </span>
                )}
                {!emailVerificado && form.email && (
                  <button
                    type="button"
                    onClick={enviarOtp}
                    disabled={enviandoOtp}
                    style={{
                      background: 'none', border: 'none', color: 'var(--primary)',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {enviandoOtp ? 'Enviando…' : 'Verificar correo'}
                  </button>
                )}
              </div>
            </div>

            {mostrandoOtp && (
              <div style={{ background: 'var(--sf)', padding: 14, borderRadius: 14, border: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--tx)' }}>
                  Ingresa el código de 6 dígitos enviado a tu correo:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={codigoOtp}
                    onChange={(e) => setCodigoOtp(e.target.value)}
                    style={{
                      flex: 1, height: 42, borderRadius: 10, border: '1px solid var(--bd)',
                      padding: '0 12px', fontSize: 18, fontWeight: 800, textAlign: 'center',
                      fontFamily: 'monospace', letterSpacing: '4px',
                    }}
                  />
                  <Button
                    type="button"
                    onClick={confirmarOtp}
                    disabled={enviandoOtp}
                    style={{ height: 42, padding: '0 16px', fontSize: 12.5 }}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {otpMensaje && (
              <div style={{ fontSize: 12, fontWeight: 600, color: emailVerificado ? '#2e7d32' : 'var(--accent)', textAlign: 'center' }}>
                {otpMensaje}
              </div>
            )}

            <Button type="submit" variant={saved ? 'green' : 'solid'} icon={saved ? 'check' : 'save'}>
              {saved ? t('comun.listo') : t('comun.guardar')}
            </Button>
            <div style={{ font: '500 11.5px/1.5 Manrope,sans-serif', color: 'var(--mu)', textAlign: 'center' }}>
              {t('cuenta.privacidad')}
            </div>
          </form>
        </div>

        <div style={entra(3)}>
          <SectionTitle>{t('cuenta.apariencia')}</SectionTitle>
          <div style={{ padding: '0 16px', marginBottom: 26 }}>
            <Duo
              opciones={TEMAS}
              valor={theme}
              onChange={changeTheme}
              render={(o, on) => (<><Icon name={o.icon} size={21} fill={on} />{t(`cuenta.${o.clave}`)}</>)}
            />
          </div>
        </div>

        <div style={entra(4)}>
          <SectionTitle>{t('cuenta.idioma')}</SectionTitle>
          <div style={{ padding: '0 16px', marginBottom: 26 }}>
            <Duo
              opciones={IDIOMAS}
              valor={idioma}
              onChange={cambiarIdioma}
              render={(o, on) => (
                <>
                  <span style={{ font: '800 15px Manrope,sans-serif', letterSpacing: '.06em', opacity: on ? 1 : 0.55 }}>{o.corto}</span>
                  {t(`cuenta.${o.clave}`)}
                </>
              )}
            />
          </div>
        </div>

        <div style={entra(5)}>
          <SectionTitle>{t('cuenta.ayuda')}</SectionTitle>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
            <Row
              icon={perm === 'granted' ? 'notifications_active' : 'notifications_off'}
              iconBg={perm === 'granted' ? 'var(--greenS)' : undefined}
              title={t('seguimiento.titulo')}
              subtitle={t('pedir.celularPista')}
              onClick={async () => setPerm(await requestNotificationPermission())}
              right={perm === 'granted' ? <Pill tone="green" icon="check">{t('comun.listo')}</Pill> : <Pill>{t('comun.continuar')}</Pill>}
            />
            <a href={WHATSAPP} target="_blank" rel="noreferrer" style={{ color: 'var(--tx)' }}>
              <Row
                icon="support_agent"
                title={t('cuenta.ayuda')}
                subtitle={`${t('cuenta.ayudaSub')} · 315 792 4906`}
                right={<Icon name="open_in_new" size={18} color="var(--mu)" />}
              />
            </a>
          </div>
        </div>

        {client?.phone && (
          <div style={{ padding: '0 16px', ...entra(6) }}>
            <Button variant="outline" icon="delete" onClick={() => { clearClient(); router.push('/'); }} style={{ color: 'var(--red)' }}>
              {t('cuenta.borrar')}
            </Button>
          </div>
        )}

        <div style={{ textAlign: 'center', font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginTop: 26 }}>
          {t('cuenta.acercaDe')}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
