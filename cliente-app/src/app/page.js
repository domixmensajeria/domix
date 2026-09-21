'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '../components/BottomNav';
import ThemeToggle from '../components/ThemeToggle';
import IdiomaToggle from '../components/IdiomaToggle';
import PedidoEnVivo from '../components/PedidoEnVivo';
import { Icon, Wordmark, SectionTitle, Row, ForYouItem, Segmento, Esqueleto } from '../components/ui';
import { useClientSession } from '../context/ClientSessionProvider';
import { useAppMode } from '../context/AppModeProvider';
import { useIdioma } from '../context/IdiomaProvider';
import { SERVICES, fetchMyRequests, listDemoRequests } from '../lib/services';
import { money } from '../lib/pricing';

const WHATSAPP = 'https://wa.me/573157924906';

/* Las dos formas de pedir: enviar algo, o que te traigan algo. */
const TABS = [
  { id: 'enviar', img: '/assets/svc-envio.webp' },
  { id: 'traer', img: '/assets/svc-moto.webp' },
];

/* "Para ti" muestra los cinco servicios del flyer. La fila se desliza,
   así que caben todos sin apretarlos. */
const PARA_TI = {
  enviar: [
    { tipo: 'mensajeria', img: '/assets/svc-moto.webp' },
    { tipo: 'autorizacion_medica', img: '/assets/svc-hora.webp' },
    { tipo: 'encomienda', img: '/assets/svc-envio.webp' },
    { tipo: 'domicilio', img: '/assets/svc-carro.webp' },
    { tipo: 'mandado', img: '/assets/svc-reserva.webp' },
  ],
  traer: [
    { tipo: 'domicilio', img: '/assets/svc-carro.webp' },
    { tipo: 'mandado', img: '/assets/svc-reserva.webp' },
    { tipo: 'encomienda', img: '/assets/svc-envio.webp' },
    { tipo: 'mensajeria', img: '/assets/svc-moto.webp' },
    { tipo: 'domicilio', img: '/assets/svc-hora.webp', turbo: true },
  ],
};

const ATAJOS = [
  { name: 'Terminal Marítimo', addr: 'Cra. 1 #1-50, Comuna 3, Buenaventura', icon: 'home' },
  { name: 'Hospital Departamental', addr: 'Cra. 2 #4-40', icon: 'local_hospital', nota: true },
];

export default function InicioPage() {
  const router = useRouter();
  const { client, ready } = useClientSession();
  const { isDemo } = useAppMode();
  const { t } = useIdioma();

  const [tab, setTab] = useState('enviar');
  const [activo, setActivo] = useState(null);
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!ready) return;

    const aplicar = (rows) => {
      const abiertos = rows.filter((r) => r.status !== 'delivered' && r.status !== 'cancelled');
      setActivo(abiertos[0] || null);
      setPendientes(abiertos.length);
      setCargando(false);
    };

    if (isDemo) {
      aplicar(listDemoRequests(client?.phone));
      const t2 = setInterval(() => aplicar(listDemoRequests(client?.phone)), 4000);
      return () => clearInterval(t2);
    }
    if (!client?.phone) return setCargando(false);
    fetchMyRequests(client.phone).then(aplicar).catch(() => setCargando(false));
  }, [ready, client?.phone, isDemo]);

  const go = (tipo, turbo) => router.push(`/pedir?tipo=${tipo}${turbo ? '&turbo=1' : ''}`);

  /* Cada sección entra un pelo después de la anterior. Es lo que hace
     que la pantalla se sienta armándose en vez de apareciendo de golpe. */
  const entra = (n) => ({ animation: `dxSube .34s cubic-bezier(.2,.8,.2,1) ${n * 45}ms both` });

  return (
    <>
      <div className="sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '4px 0 104px' }}>

        {/* Marca y ajustes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 16px 16px', ...entra(0) }}>
          <Wordmark />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
            <IdiomaToggle compact />
            <ThemeToggle compact />
          </div>
        </div>

        {/* Lo que está pasando ahora manda sobre todo lo demás */}
        {cargando && (
          <div style={{ padding: '0 16px 18px' }}>
            <Esqueleto h={104} r={20} />
          </div>
        )}
        {!cargando && activo && <div style={entra(1)}><PedidoEnVivo pedido={activo} /></div>}

        {/* Qué quieres hacer */}
        <div style={{ padding: '0 16px 14px', ...entra(2) }}>
          <Segmento
            valor={tab}
            onChange={setTab}
            opciones={TABS.map((x) => ({ ...x, label: t(`inicio.${x.id}`) }))}
          />
        </div>

        {/* La acción principal de la pantalla */}
        <div style={{ padding: '0 16px 22px', ...entra(3) }}>
          <button
            className="dx-toque"
            onClick={() => go(tab === 'enviar' ? 'encomienda' : 'domicilio')}
            style={{
              display: 'flex', alignItems: 'center', width: '100%', height: 62, borderRadius: 99,
              background: 'var(--sf)', padding: '0 6px 0 19px', gap: 12, boxShadow: 'var(--sh2)',
            }}
          >
            <Icon name="search" size={21} />
            <span style={{ flex: 1, textAlign: 'left', font: '700 17px Manrope,sans-serif', letterSpacing: '-.02em' }}>
              {tab === 'enviar' ? t('inicio.queEnvias') : t('inicio.queNecesitas')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 50, padding: '0 16px', borderRadius: 99, background: 'var(--bg)', boxShadow: 'var(--sh2)' }}>
              <Icon name="calendar_month" size={16} />
              <span style={{ font: '700 13.5px Manrope,sans-serif' }}>{t('inicio.despues')}</span>
            </span>
          </button>
        </div>

        {/* Para ti */}
        <div style={entra(4)}>
          <SectionTitle
            action={
              <button
                aria-label={t('inicio.verTodos')}
                onClick={() => router.push('/servicios')}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="arrow_forward" size={17} />
              </button>
            }
          >
            {t('inicio.paraTi')}
          </SectionTitle>

          <div className="sb" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 16px 24px' }}>
            {PARA_TI[tab].map((it, i) => (
              <ForYouItem
                key={`${it.tipo}-${i}`}
                image={it.img}
                label={it.turbo ? 'Turbo' : t(`servicios.${it.tipo}`)}
                onClick={() => go(it.tipo, it.turbo)}
              />
            ))}
          </div>
        </div>

        {/* Atajos */}
        <div style={entra(5)}>
          <SectionTitle>{t('inicio.atajos')}</SectionTitle>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 26 }}>
            {ATAJOS.map((a) => (
              <Row
                key={a.name}
                icon={a.icon}
                title={a.name}
                subtitle={a.addr}
                note={a.nota ? t('servicios.autorizacion_medica') : undefined}
                onClick={() => go(tab === 'enviar' ? 'encomienda' : 'domicilio')}
                style={{ transition: 'transform .16s var(--ease)' }}
              />
            ))}
            <Row icon="add" title={t('inicio.guardarLugar')} onClick={() => router.push('/cuenta')} />
          </div>
        </div>

        {/* Servicios con su precio de entrada */}
        <div style={entra(6)}>
          <SectionTitle>{t('inicio.servicios')}</SectionTitle>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 26 }}>
            {SERVICES.map((s) => (
              <Row
                key={s.value}
                image={s.img}
                title={t(`servicios.${s.value}`)}
                subtitle={t(`servicios.${s.value}Desc`)}
                right={
                  <span style={{ flex: 'none', textAlign: 'right' }}>
                    <span style={{ display: 'block', font: '700 9.5px Manrope,sans-serif', letterSpacing: '.08em', color: 'var(--mu)' }}>{t('comun.desde')}</span>
                    <span className="num" style={{ display: 'block', font: '800 15px Manrope,sans-serif', letterSpacing: '-.02em' }}>{money(s.from)}</span>
                  </span>
                }
                onClick={() => go(s.value)}
              />
            ))}
          </div>
        </div>

        {/* Otras formas de pedir */}
        <div style={entra(7)}>
          <SectionTitle>{t('inicio.masFormas')}</SectionTitle>
          <div className="sb" style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 16px 26px' }}>
            <button
              className="dx-toque"
              onClick={() => go('domicilio', true)}
              style={{ flex: 'none', width: 218, borderRadius: 18, overflow: 'hidden', background: 'var(--sf)', textAlign: 'left' }}
            >
              <div style={{ height: 100, background: 'linear-gradient(135deg,#F0882A,#E8720E)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: -24, bottom: -34, width: 164, height: 164, borderRadius: '50%', border: '13px solid rgba(255,255,255,.15)' }} />
                <Icon name="bolt" size={26} fill color="rgba(255,255,255,.95)" style={{ position: 'absolute', left: 16, top: 16 }} />
                <div style={{ position: 'absolute', right: 15, bottom: 14, font: '800 15px Manrope,sans-serif', color: '#fff', letterSpacing: '-.03em' }}>TURBO</div>
              </div>
              <div style={{ padding: '13px 15px 16px' }}>
                <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: 3 }}>{t('inicio.turboTitulo')}</div>
                <div style={{ font: '500 11.5px/1.45 Manrope,sans-serif', color: 'var(--mu)' }}>{t('inicio.turboTexto')}</div>
              </div>
            </button>

            <a
              className="dx-toque"
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              style={{ flex: 'none', width: 218, borderRadius: 18, overflow: 'hidden', background: 'var(--sf)', color: 'var(--tx)' }}
            >
              <div style={{ height: 100, background: 'linear-gradient(135deg,#3D9130,#2F7A24)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chat" size={40} fill color="rgba(255,255,255,.92)" />
              </div>
              <div style={{ padding: '13px 15px 16px' }}>
                <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: 3 }}>{t('inicio.whatsappTitulo')}</div>
                <div style={{ font: '500 11.5px/1.45 Manrope,sans-serif', color: 'var(--mu)' }}>{t('inicio.whatsappTexto')}</div>
              </div>
            </a>
          </div>
        </div>

        {/* Lo que promete la marca va al pie, donde no compite con pedir */}
        <div style={{ padding: '0 16px', ...entra(8) }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { i: 'verified_user', k: 'confiables' },
              { i: 'bolt', k: 'rapidos' },
              { i: 'location_on', k: 'locales' },
            ].map((c) => (
              <span key={c.k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '13px 6px', borderRadius: 14, background: 'var(--sf)', textAlign: 'center' }}>
                <Icon name={c.i} size={17} fill color="var(--orange)" />
                <span style={{ font: '700 11.5px Manrope,sans-serif' }}>{t(`inicio.${c.k}`)}</span>
                <span style={{ font: '500 10px/1.3 Manrope,sans-serif', color: 'var(--mu)' }}>{t(`inicio.${c.k}Sub`)}</span>
              </span>
            ))}
          </div>

          <div style={{ textAlign: 'center', padding: '4px 12px 0' }}>
            <div style={{ font: '800 15px/1.35 Manrope,sans-serif', letterSpacing: '-.02em' }}>
              {t('inicio.lema1')}<br />
              <span style={{ color: 'var(--green)' }}>{t('inicio.lema2')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginTop: 10 }}>
              <Icon name="location_on" size={13} fill />
              {t('inicio.cobertura')}
            </div>
          </div>
        </div>
      </div>

      <BottomNav badges={{ '/pedidos': pendientes }} />
    </>
  );
}
