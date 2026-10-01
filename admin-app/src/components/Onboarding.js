'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Button } from './ui';
import { requestNotificationPermission, notificationPermission } from '../lib/notify';

const KEY = 'domix_onboarding_done';

const STEPS = [
  {
    icon: 'waving_hand',
    title: 'Bienvenido al panel de Domix',
    body: 'Desde aquí controlas toda la operación de Mensajería & Logística: pedidos que entran, repartidores en la calle y el dinero del día. Todo lo que ves aquí es real: lo que entra por la app de clientes aparece en segundos.',
    tint: 'var(--primary-container)',
    fg: 'var(--on-primary-container)',
  },
  {
    icon: 'receipt_long',
    title: 'Pedidos en vivo',
    body: 'Cada servicio que piden por la app o que cargas tú desde WhatsApp aparece en el tablero. Lo asignas al repartidor más cercano y sigues su recorrido paso a paso hasta la entrega.',
    tint: 'var(--tertiary-container)',
    fg: 'var(--on-tertiary-container)',
  },
  {
    icon: 'tune',
    title: 'Motor de despacho',
    body: 'Define la tarifa base, el costo por kilómetro y los recargos por lluvia, horario nocturno o alta demanda. El precio se calcula solo y es el mismo que ve el cliente al pedir.',
    tint: 'var(--secondary-container)',
    fg: 'var(--on-secondary-container)',
  },
  {
    icon: 'location_city',
    title: 'Crece a otras ciudades',
    body: 'Hoy operas en Buenaventura. Cuando quieras abrir Cali, Tumaco o cualquier ciudad, creas la sede, defines su cobertura y sus tarifas, y registras a sus repartidores. Todo desde el mismo panel.',
    tint: 'var(--primary-container)',
    fg: 'var(--on-primary-container)',
  },
  {
    icon: 'notifications_active',
    title: 'Que no se te escape un pedido',
    body: 'Activa las alertas del navegador y te avisamos con sonido cada vez que entre un servicio nuevo, incluso si tienes el panel en otra pestaña.',
    tint: 'var(--tertiary-container)',
    fg: 'var(--on-tertiary-container)',
    action: 'notifications',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [perm, setPerm] = useState('default');

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* ignorar */ }
    setPerm(notificationPermission());
  }, []);

  const close = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignorar */ }
    setOpen(false);
  };

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'dxFadeIn .18s ease' }}>
      <div style={{ width: '100%', maxWidth: 520, borderRadius: 'var(--sh-xl)', background: 'var(--surface-lowest)', boxShadow: 'var(--elev-4)', overflow: 'hidden', animation: 'dxPop .22s var(--ease-out)' }}>
        <div style={{ height: 132, background: 'linear-gradient(140deg,#2A241E 0%,#17140F 60%,#12100D 100%)', position: 'relative', display: 'flex', alignItems: 'center', padding: '0 28px' }}>
          <div style={{ position: 'absolute', right: -40, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(87,168,47,.36),transparent 70%)' }} />
          <span style={{ position: 'relative', width: 62, height: 62, borderRadius: 'var(--sh-md)', background: step.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--elev-2)' }}>
            <Icon name={step.icon} size={31} fill color={step.fg} />
          </span>
          <span style={{ position: 'relative', marginLeft: 16, color: '#fff' }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.11em', opacity: .6 }}>
              PASO {i + 1} DE {STEPS.length}
            </span>
            <span className="dsp" style={{ display: 'block', fontWeight: 800, fontSize: 22, marginTop: 4 }}>{step.title}</span>
          </span>
        </div>

        <div style={{ padding: 26 }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--on-surface-variant)' }}>{step.body}</p>

          {step.action === 'notifications' && (
            <Button
              icon={perm === 'granted' ? 'check_circle' : 'notifications_active'}
              color={perm === 'granted' ? 'var(--secondary)' : 'var(--tertiary)'}
              onClick={async () => setPerm(await requestNotificationPermission())}
              style={{ marginTop: 18 }}
              disabled={perm === 'granted'}
            >
              {perm === 'granted' ? 'Alertas activadas' : 'Activar alertas'}
            </Button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 26 }}>
            {STEPS.map((_, idx) => (
              <span key={idx} style={{ width: idx === i ? 22 : 7, height: 7, borderRadius: 999, background: idx === i ? 'var(--tertiary)' : 'var(--outline-variant)', transition: 'width .22s var(--ease)' }} />
            ))}
            <span style={{ flex: 1 }} />
            <button onClick={close} style={{ height: 42, padding: '0 14px', fontSize: 13.5, fontWeight: 700, color: 'var(--on-surface-variant)' }}>
              Saltar
            </button>
            <Button
              icon={last ? 'rocket_launch' : 'arrow_forward'}
              onClick={() => (last ? (close(), router.push('/pedidos')) : setI(i + 1))}
            >
              {last ? 'Empezar' : 'Siguiente'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
