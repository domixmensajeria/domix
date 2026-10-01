'use client';

import { useEffect, useState } from 'react';
import { Icon, Button } from './ui';
import ThemeToggle from './ThemeToggle';
import IdiomaToggle from './IdiomaToggle';
import { useIdioma } from '../context/IdiomaProvider';
import { useOps } from '../context/OpsProvider';
import { useAppMode } from '../context/AppModeProvider';
import { requestNotificationPermission, notificationPermission } from '../lib/notify';

/* Barra superior fija, con buscador global y estado de la flota,
   como la del panel de Turapp. */
export default function TopBar({ title, subtitle, actions, onSearch, searchPlaceholder }) {
  const { simulateIncoming, stats, branches } = useOps();
  const { isDemo } = useAppMode();
  const [perm, setPerm] = useState('default');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { t } = useIdioma();

  useEffect(() => { setPerm(notificationPermission()); }, []);

  const activeBranches = branches.filter((b) => b.is_active);

  return (
    <div style={{ flex: 'none', background: 'var(--bg)', borderBottom: '1px solid var(--bd2)' }}>
      {/* Fila superior: buscador + estado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 14px', borderRadius: 99, background: 'var(--sf)', flex: 1, maxWidth: 420 }}>
          <Icon name="search" size={17} color="var(--mu)" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            placeholder={searchPlaceholder || t('comun.buscar')}
            style={{ flex: 1, font: '600 12.5px Manrope,sans-serif' }}
          />
        </span>

        <span style={{ flex: 1 }} />

        {activeBranches.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, background: 'var(--sf)', flex: 'none' }}>
            <Icon name="location_city" size={14} color="var(--mu)" />
            <span style={{ font: '700 11.5px Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap' }}>
              {activeBranches.length === 1 ? activeBranches[0].city : `${activeBranches.length} sedes`}
            </span>
          </span>
        )}

        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: stats.online ? 'var(--greenS)' : 'var(--sf)', flex: 'none' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: stats.online ? 'var(--green)' : 'var(--mu)', animation: stats.online ? 'trBlink 1.6s ease-in-out infinite' : 'none' }} />
          <span style={{ font: '700 11.5px Manrope,sans-serif', color: stats.online ? 'var(--green)' : 'var(--mu)', whiteSpace: 'nowrap' }}>
            {stats.online} repartidores en línea
          </span>
        </span>

        <IdiomaToggle compact />
        <ThemeToggle compact />

        <button
          onClick={async () => setPerm(await requestNotificationPermission())}
          title={perm === 'granted' ? 'Alertas activas' : 'Activar alertas'}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flex: 'none' }}
        >
          <Icon name={perm === 'granted' ? 'notifications' : 'notifications_off'} size={17} color="var(--tx)" />
          {perm !== 'granted' && (
            <span style={{ position: 'absolute', top: 6, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--sf)' }} />
          )}
        </button>

      </div>

      {/* Fila del título + acciones de la pantalla */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '4px 22px 16px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ font: '800 24px Manrope,sans-serif', letterSpacing: '-.035em', margin: 0 }}>{title}</h1>
          {subtitle && <div style={{ font: '500 12.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: 4 }}>{subtitle}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          {isDemo && (
            <div style={{ position: 'relative' }}>
              <Button variant="outline" icon="bolt" onClick={() => setOpen((o) => !o)}>Simular pedido</Button>
              {open && (
                <div
                  onMouseLeave={() => setOpen(false)}
                  style={{ position: 'absolute', right: 0, top: '100%', marginTop: 7, zIndex: 70, width: 218, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--bd)', boxShadow: 'var(--sh)', overflow: 'hidden', animation: 'dxDrop .16s ease' }}
                >
                  <button
                    onClick={() => { simulateIncoming({ turbo: false }); setOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', textAlign: 'left' }}
                  >
                    <Icon name="add_alert" size={18} color="var(--green)" />
                    <span style={{ font: '700 12.5px Manrope,sans-serif' }}>Pedido normal</span>
                  </button>
                  <button
                    onClick={() => { simulateIncoming({ turbo: true }); setOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', textAlign: 'left', borderTop: '1px solid var(--bd2)' }}
                  >
                    <Icon name="bolt" size={18} fill color="var(--navy)" />
                    <span style={{ font: '700 12.5px Manrope,sans-serif' }}>Pedido Turbo</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}
