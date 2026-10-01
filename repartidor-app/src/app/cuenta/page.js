'use client';

import { useCallback, useEffect, useState } from 'react';
import RequireSession from '../../components/RequireSession';
import BottomNav from '../../components/BottomNav';
import { Icon, Card, HeroCard, Button, Chip } from '../../components/ui';
import { useCourierSession } from '../../context/CourierSessionProvider';
import { useAppMode } from '../../context/AppModeProvider';
import { useTheme } from '../../context/ThemeProvider';
import { useIdioma } from '../../context/IdiomaProvider';
import ThemeToggle from '../../components/ThemeToggle';
import IdiomaToggle from '../../components/IdiomaToggle';
import HojaDocumento from '../../components/HojaDocumento';
import HojaVehiculo from '../../components/HojaVehiculo';
import HojaCuentaRetiro from '../../components/HojaCuentaRetiro';
import HojaPreferencias from '../../components/HojaPreferencias';
import { DEMO_DOCS, DEMO_VEHICLE } from '../../lib/demo';
import { DOCS, DOC_STATUS, VEHICULOS, METODOS_RETIRO, HORARIOS, fetchDocumentos, fetchVehiculo, enlaceSoporte } from '../../lib/cuenta';

function CuentaContent() {
  const { profile, courierProfile, signOut } = useCourierSession();
  const { isDemo } = useAppMode();
  const { theme, changeTheme } = useTheme();
  const { idioma, cambiarIdioma, t } = useIdioma();

  const [docs, setDocs] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [perfil, setPerfil] = useState(courierProfile);
  const [hoja, setHoja] = useState(null);       // 'vehiculo' | 'retiro' | null
  const [docAbierto, setDocAbierto] = useState(null);

  const courierId = courierProfile?.id;

  useEffect(() => { setPerfil(courierProfile); }, [courierProfile]);

  const recargar = useCallback(async () => {
    if (isDemo) {
      setDocs(DEMO_DOCS);
      setVehicle(DEMO_VEHICLE);
      return;
    }
    if (!courierId) return;
    const [d, v] = await Promise.all([fetchDocumentos(courierId), fetchVehiculo(courierId)]);
    setDocs(d);
    setVehicle(v);
  }, [courierId, isDemo]);

  useEffect(() => { recargar(); }, [recargar]);

  const aprobados = docs.filter((d) => d.status === 'approved').length;
  const porVencer = docs.find((d) => d.status === 'expiring_soon');
  const rechazado = docs.find((d) => d.status === 'rejected');
  const faltantes = DOCS.length - docs.length;
  const inits = ((profile?.first_name?.[0] || 'D') + (profile?.last_name?.[0] || '')).toUpperCase();

  const vehLabel = vehicle
    ? `${VEHICULOS.find((v) => v.id === vehicle.vehicle_type)?.label || vehicle.vehicle_type} ${vehicle.plate || ''}`.trim()
    : t('cuenta.sinRegistrar');
  const cuentaLabel = perfil?.payout_account
    ? `${METODOS_RETIRO.find((m) => m.id === perfil.payout_method)?.label || ''} ${perfil.payout_account}`.trim()
    : t('cuenta.sinRegistrar');

  const horarioLabel = perfil?.preferred_schedule
    ? (HORARIOS.find((h) => h.id === perfil.preferred_schedule)?.id || perfil.preferred_schedule)
    : t('cuenta.sinDefinir');

  /* Soporte abre WhatsApp con el mensaje ya escrito: el repartidor no
     debería tener que explicar quién es cada vez que escribe. */
  const abrirSoporte = () => {
    const nombre = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
    window.open(enlaceSoporte(perfil, nombre), '_blank', 'noopener');
  };

  /* En demo no se escribe nada en la base: se avisa en vez de fallar. */
  const abrir = (cual) => {
    if (isDemo) return;
    setHoja(cual);
  };

  const rows = [
    { icon: 'two_wheeler', label: t('cuenta.miVehiculo'), value: vehLabel, falta: !vehicle, onClick: () => abrir('vehiculo') },
    { icon: 'account_balance', label: t('cuenta.cuentaRetiros'), value: cuentaLabel, falta: !perfil?.payout_account, onClick: () => abrir('retiro') },
    { icon: 'map', label: t('cuenta.zonaTrabajo'), value: perfil?.work_zone || 'Centro', onClick: () => abrir('preferencias') },
    { icon: 'schedule', label: t('cuenta.horario'), value: horarioLabel, falta: !perfil?.preferred_schedule, onClick: () => abrir('preferencias') },
    { icon: 'support_agent', label: t('cuenta.ayuda'), value: 'WhatsApp', onClick: abrirSoporte },
  ];

  return (
    <>
      <header className="dx-topbar" style={{ justifyContent: 'space-between' }}>
        <span className="dsp" style={{ fontWeight: 800, fontSize: 25 }}>{t('cuenta.titulo')}</span>
        <IdiomaToggle compact />
        <ThemeToggle compact />
      </header>

      <div className="dx-page sc">
        <HeroCard glow="orange" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.14)', border: '2px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flex: 'none' }}>
              {inits}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="dsp" style={{ display: 'block', fontWeight: 700, fontSize: 19 }}>{profile?.first_name} {profile?.last_name}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{profile?.phone_number}</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {[
              { v: Number(perfil?.rating || 5).toFixed(1), l: 'Calificación' },
              { v: perfil?.total_deliveries || 0, l: 'Entregas' },
              { v: `${aprobados}/4`, l: 'Documentos' },
            ].map((s) => (
              <span key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,.09)', borderRadius: 'var(--sh-sm)', padding: '11px 8px', textAlign: 'center' }}>
                <span className="num" style={{ display: 'block', fontWeight: 700, fontSize: 17 }}>{s.v}</span>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{s.l}</span>
              </span>
            ))}
          </div>
        </HeroCard>

        {/* Documentos: cada fila abre su hoja para subir o reemplazar */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{t('cuenta.documentos')}</span>
            <Chip
              icon={aprobados === 4 ? 'verified' : 'pending'}
              bg={aprobados === 4 ? 'var(--secondary-container)' : 'var(--surface-container)'}
              color={aprobados === 4 ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)'}
            >
              {t('cuenta.deCuatro', { n: aprobados })}
            </Chip>
          </div>

          {DOCS.map((d) => {
            const doc = docs.find((x) => x.doc_type === d.type);
            const st = DOC_STATUS[doc ? doc.status : 'falta'];
            return (
              <button
                key={d.type}
                onClick={() => !isDemo && setDocAbierto(d)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--outline-variant)', textAlign: 'left', background: 'transparent' }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 'var(--sh-sm)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Icon name={d.icon} size={18} color="var(--on-surface-variant)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{d.label}</span>
                  {doc?.expires_at && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 1 }}>
                      Vence el {new Date(`${doc.expires_at}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </span>
                <Icon name={st.icon} size={19} fill color={st.color} />
                <span style={{ fontSize: 11.5, fontWeight: 800, color: st.color, minWidth: 62, textAlign: 'right' }}>{st.label}</span>
                <Icon name="chevron_right" size={18} color="var(--outline)" />
              </button>
            );
          })}

          {(porVencer || rechazado || faltantes > 0) && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, padding: 12, borderRadius: 'var(--sh-sm)', background: rechazado ? 'var(--error-container)' : 'var(--tertiary-container)' }}>
              <Icon name="error" size={19} fill color={rechazado ? 'var(--on-error-container)' : 'var(--on-tertiary-container)'} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: rechazado ? 'var(--on-error-container)' : 'var(--on-tertiary-container)', lineHeight: 1.45 }}>
                {rechazado
                  ? `Tu ${DOCS.find((d) => d.type === rechazado.doc_type)?.label} fue rechazada. Tócala para subirla otra vez.`
                  : porVencer
                    ? `Tu ${DOCS.find((d) => d.type === porVencer.doc_type)?.label} vence pronto. Súbela actualizada para no quedar inactivo.`
                    : `Te faltan ${faltantes} ${faltantes === 1 ? 'documento' : 'documentos'}. Con todos aprobados te llegan más pedidos.`}
              </span>
            </div>
          )}
        </Card>

        <Card style={{ padding: 0, marginTop: 14, overflow: 'hidden' }}>
          {rows.map((row, i) => (
            <button
              key={row.label}
              onClick={row.onClick}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px', borderTop: i ? '1px solid var(--outline-variant)' : 'none', textAlign: 'left', background: 'transparent' }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 'var(--sh-sm)', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name={row.icon} size={19} color="var(--on-primary-container)" />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>{row.label}</span>
              {row.value && (
                <span style={{ fontSize: 12.5, color: row.falta ? 'var(--tertiary)' : 'var(--on-surface-variant)', fontWeight: row.falta ? 800 : 600, textAlign: 'right', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.value}
                </span>
              )}
              <Icon name="chevron_right" size={20} color="var(--outline)" />
            </button>
          ))}
        </Card>

        {/* Apariencia */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{t('cuenta.apariencia')}</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {[
              { id: 'light', label: t('cuenta.claro'), icon: 'light_mode' },
              { id: 'dark', label: t('cuenta.oscuro'), icon: 'dark_mode' },
            ].map((t) => {
              const on = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px',
                    borderRadius: 'var(--sh-md)', fontSize: 12.5, fontWeight: 800,
                    background: on ? 'var(--primary)' : 'var(--surface-container)',
                    color: on ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                  }}
                >
                  <Icon name={t.icon} size={20} fill={on} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Idioma. Mismo dibujo que Apariencia: dos ajustes parecidos se
            leen más rápido cuando se ven igual. */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{t('cuenta.idioma')}</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {[
              { id: 'es', label: t('cuenta.espanol'), corto: 'ES' },
              { id: 'en', label: t('cuenta.ingles'), corto: 'EN' },
            ].map((o) => {
              const on = idioma === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => cambiarIdioma(o.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px',
                    borderRadius: 'var(--sh-md)', fontSize: 12.5, fontWeight: 800,
                    background: on ? 'var(--primary)' : 'var(--surface-container)',
                    color: on ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                    transition: 'background .2s var(--ease-out)',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.06em', opacity: on ? 1 : .6 }}>{o.corto}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Button full variant="outlined" icon="swap_horiz" color="var(--error)" onClick={signOut} style={{ marginTop: 14, borderColor: 'var(--outline-variant)' }}>
          {t('cuenta.cambiarRepartidor')}
        </Button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 16 }}>
          {t('cuenta.pie')}
        </div>
      </div>

      <HojaDocumento
        abierta={!!docAbierto}
        doc={docAbierto}
        actual={docs.find((x) => x.doc_type === docAbierto?.type)}
        courierId={courierId}
        onClose={() => setDocAbierto(null)}
        onGuardado={recargar}
      />

      <HojaVehiculo
        abierta={hoja === 'vehiculo'}
        actual={vehicle}
        courierId={courierId}
        onClose={() => setHoja(null)}
        onGuardado={setVehicle}
      />

      <HojaPreferencias
        abierta={hoja === 'preferencias'}
        perfil={perfil}
        courierId={courierId}
        onClose={() => setHoja(null)}
        onGuardado={setPerfil}
      />

      <HojaCuentaRetiro
        abierta={hoja === 'retiro'}
        perfil={perfil}
        courierId={courierId}
        onClose={() => setHoja(null)}
        onGuardado={setPerfil}
      />

      <BottomNav />
    </>
  );
}

export default function CuentaPage() {
  return <RequireSession><CuentaContent /></RequireSession>;
}
