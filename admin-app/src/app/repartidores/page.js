'use client';

import { useState } from 'react';
import TopBar from '../../components/TopBar';
import GuiaSeccion from '../../components/GuiaSeccion';
import { Icon, Card, Overline, Button, Chip, Field, Spinner, EmptyState } from '../../components/ui';
import { useOps } from '../../context/OpsProvider';
import { createCourier, assignCourierPassword, OPEN_STATUSES } from '../../lib/ops';
import { zonesFor } from '../../lib/cities';

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

function CambiarClaveModal({ courier, onClose, isDemo }) {
  const [clave, setClave] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (!clave || clave.trim().length < 6) {
      return setError('La clave debe tener al menos 6 caracteres.');
    }
    setBusy(true);
    setError('');
    if (isDemo) {
      setBusy(false);
      setListo(true);
      setTimeout(onClose, 1200);
      return;
    }
    const res = await assignCourierPassword(courier.id, clave.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error || 'No se pudo asignar la clave.');
    setListo(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button aria-label="Cerrar" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(6,10,16,.6)', backdropFilter: 'blur(4px)' }} />
      <Card elevation={3} style={{ position: 'relative', width: 'min(380px,100%)', padding: 22, animation: 'trUp .26s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span className="dsp" style={{ fontWeight: 800, fontSize: 17 }}>
            Clave para {courier.first_name}
          </span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={17} />
          </button>
        </div>
        {listo ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--secondary)' }}>
            <Icon name="check_circle" size={36} fill />
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>¡Clave actualizada correctamente!</div>
          </div>
        ) : (
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              required
              label="Nueva clave de acceso"
              icon="key"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
            {error && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--error)' }}>{error}</span>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
              <Button type="submit" icon="check" disabled={busy}>{busy ? 'Guardando…' : 'Guardar clave'}</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

function NuevoRepartidor({ onCreated, onClose, branches, isDemo, setCouriers }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '', work_zone: 'Centro', branch_id: branches[0]?.id || '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password && form.password.trim().length < 6) {
      return setError('Si asignas clave, debe tener al menos 6 caracteres.');
    }
    setBusy(true);
    setError('');
    if (isDemo) {
      setCouriers((rows) => [...rows, {
        id: `demo-${Date.now()}`, ...form, status: 'offline', rating: 5, total_deliveries: 0,
      }]);
      setBusy(false);
      return onCreated();
    }
    const { error: err } = await createCourier(form);
    setBusy(false);
    if (err) return setError(err.message);
    onCreated();
  };

  return (
    <Card elevation={3} style={{ padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="dsp" style={{ fontWeight: 800, fontSize: 18 }}>Registrar repartidor</span>
        <button aria-label="Cerrar" onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={19} />
        </button>
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Field required label="Nombre" icon="person" placeholder="Yeison" value={form.first_name} onChange={set('first_name')} />
        <Field required label="Apellido" icon="badge" placeholder="Mosquera" value={form.last_name} onChange={set('last_name')} />
        <Field required label="Celular" icon="call" type="tel" placeholder="+573157924906" value={form.phone_number} onChange={set('phone_number')} />
        <Field label="Clave de acceso (opcional)" icon="key" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} />
        <label>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', marginBottom: 6 }}>Sede</span>
          <select value={form.branch_id} onChange={set('branch_id')} style={{ width: '100%', height: 52, padding: '0 14px', borderRadius: 'var(--sh-sm)', background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)', fontSize: 14.5, fontWeight: 600 }}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.city}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', marginBottom: 6 }}>Zona de trabajo</span>
          <select value={form.work_zone} onChange={set('work_zone')} style={{ width: '100%', height: 52, padding: '0 14px', borderRadius: 'var(--sh-sm)', background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)', fontSize: 14.5, fontWeight: 600 }}>
            {zonesFor(branches.find((b) => b.id === form.branch_id)?.city).map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--error)' }}>{error}</span>}
          <span style={{ flex: 1 }} />
          <Button variant="outlined" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon="check" disabled={busy}>{busy ? 'Guardando…' : 'Registrar'}</Button>
        </div>
      </form>
    </Card>
  );
}

export default function RepartidoresPage() {
  const { couriers, requests, branches, loading, isDemo, setCouriers, reload } = useOps();
  const [nuevo, setNuevo] = useState(false);
  const [claveModal, setClaveModal] = useState(null);

  const online = couriers.filter((c) => c.status === 'online');

  return (
    <>
      <TopBar
        title="Repartidores"
        subtitle={`${couriers.length} registrados · ${online.length} en línea ahora`}
        actions={<Button icon="person_add" onClick={() => setNuevo(true)} style={{ height: 44 }}>Registrar repartidor</Button>}
      />

      <div className="dx-content sb" style={{ animation: 'trFade .3s ease' }}>
        <GuiaSeccion
          id="repartidores"
          tono="green"
          titulo="Tu equipo en la calle"
          frase="Registra a tu gente, dale su clave y sigue cómo le va: entregas del día, calificación y cuánto ha generado."
          puntos={[{ i: 'person_add', t: 'Registrar', s: 'Queda listo para entrar a su app' }, { i: 'key', t: 'Su clave', s: 'Sin clave no puede entrar' }, { i: 'star', t: 'Rendimiento', s: 'Ves quién está rindiendo' }]}
        />


      {nuevo && (
        <NuevoRepartidor
          branches={branches} isDemo={isDemo} setCouriers={setCouriers}
          onClose={() => setNuevo(false)}
          onCreated={() => { setNuevo(false); if (!isDemo) reload(); }}
        />
      )}

      {claveModal && (
        <CambiarClaveModal
          courier={claveModal}
          isDemo={isDemo}
          onClose={() => setClaveModal(null)}
        />
      )}

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>}

      {!loading && couriers.length === 0 && (
        <EmptyState
          icon="two_wheeler"
          title="Sin repartidores"
          body="Registra a tu equipo para que puedan entrar a la app de repartidor y recibir pedidos."
          action={<Button icon="person_add" onClick={() => setNuevo(true)}>Registrar el primero</Button>}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {couriers.map((c) => {
          const mine = requests.filter((r) => r.courier_id === c.id);
          const activos = mine.filter((r) => OPEN_STATUSES.includes(r.status)).length;
          const entregados = mine.filter((r) => r.status === 'delivered');
          const generado = entregados.reduce((s, r) => s + Number(r.price || 0), 0);
          const on = c.status === 'online';
          return (
            <Card key={c.id} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <span style={{ position: 'relative', width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-container)', color: 'var(--on-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flex: 'none' }}>
                  {(c.first_name?.[0] || 'D').toUpperCase()}
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: '50%', border: '2.5px solid var(--surface-lowest)', background: on ? 'var(--secondary)' : 'var(--outline)' }} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="dsp" style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>
                    {c.first_name} {c.last_name}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>{c.phone_number}</span>
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Chip
                  icon={on ? 'bolt' : 'bedtime'}
                  bg={on ? 'var(--secondary-container)' : 'var(--surface-container)'}
                  color={on ? 'var(--on-secondary-container)' : 'var(--on-surface-variant)'}
                >
                  {on ? 'En línea' : 'Desconectado'}
                </Chip>
                <Chip icon="map">{c.work_zone || 'Centro'}</Chip>
                {activos > 0 && <Chip icon="local_shipping" bg="var(--tertiary-container)" color="var(--on-tertiary-container)">{activos} en curso</Chip>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 15, paddingTop: 15, borderTop: '1px solid var(--outline-variant)' }}>
                {[
                  { v: Number(c.rating || 5).toFixed(1), l: 'Calificación' },
                  { v: entregados.length, l: 'Entregas' },
                  { v: money(generado), l: 'Generado' },
                ].map((s) => (
                  <span key={s.l} style={{ textAlign: 'center' }}>
                    <span className="dsp" style={{ display: 'block', fontWeight: 800, fontSize: 16 }}>{s.v}</span>
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--on-surface-variant)', marginTop: 2 }}>{s.l}</span>
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <Button variant="outlined" icon="key" onClick={() => setClaveModal(c)} style={{ height: 36, width: '100%', fontSize: 12 }}>
                  Asignar o cambiar clave
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      </div>
    </>
  );
}

