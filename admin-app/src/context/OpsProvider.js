'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAppMode } from './AppModeProvider';
import { buildDemoData, DEMO_COURIERS, makeIncomingRequest } from '../lib/demo';
import { HOME_BRANCH } from '../lib/cities';
import { DEFAULT_RULES, autoSurgeFor } from '../lib/pricing';
import { fetchRequests, fetchCouriers, fetchBranches, assignCourier, setRequestStatus, createRequestFromAdmin, saveBranchRules, subscribeOps, OPEN_STATUSES } from '../lib/ops';
import { pushNotify } from '../lib/notify';
import { contarPendientes } from '../lib/pagos';

const OpsContext = createContext(null);
const RULES_KEY = 'domix_rules';

export function OpsProvider({ children }) {
  const { isDemo, ready } = useAppMode();
  const [porResolver, setPorResolver] = useState(0);
  const recargaPendiente = useRef(null);
  const flotaRef = useRef([]);
  const prevRequestsRef = useRef(null);

  const [requests, setRequests] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState(DEFAULT_RULES);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RULES_KEY);
      if (saved) setRules({ ...DEFAULT_RULES, ...JSON.parse(saved) });
    } catch { /* ignorar */ }
  }, []);

  const saveRules = useCallback((next) => {
    setRules(next);
    try { localStorage.setItem(RULES_KEY, JSON.stringify(next)); } catch { /* ignorar */ }
    const sedeId = branches[0]?.id;
    if (sedeId && !String(sedeId).startsWith('demo-')) {
      saveBranchRules(sedeId, next).catch(() => {});
    }
  }, [branches]);

  /* ---------- Carga según el modo ---------- */
  const loadLive = useCallback(async () => {
    try {
      const [r, c, b, pend] = await Promise.all([
        fetchRequests(), fetchCouriers(), fetchBranches().catch(() => []), contarPendientes().catch(() => 0),
      ]);
      setPorResolver(pend);

      if (prevRequestsRef.current !== null) {
        const viejosIds = new Set(prevRequestsRef.current.map((x) => x.id));
        const nuevos = (r || []).filter((x) => !viejosIds.has(x.id) && x.status === 'requested');
        for (const nuevo of nuevos) {
          pushNotify('Nuevo pedido en Domix', {
            body: `${nuevo.contact_name || 'Cliente'} · ${nuevo.dropoff_address || ''}`,
            tag: `admin-${nuevo.id}`,
          });
        }
      }
      prevRequestsRef.current = r || [];

      setRequests(r);
      setCouriers(c.map((x) => ({
        id: x.id,
        first_name: x.profiles?.first_name, last_name: x.profiles?.last_name, phone_number: x.profiles?.phone_number,
        status: x.status, work_zone: x.work_zone, rating: x.rating, total_deliveries: x.total_deliveries,
        payout_account: x.payout_account, branch_id: x.branch_id,
        lat: x.last_lat, lon: x.last_lon,
      })));
      setBranches(b.length ? b : [HOME_BRANCH]);
      if (b[0]?.pricing_rules && Object.keys(b[0].pricing_rules).length > 0) {
        setRules((prev) => ({ ...prev, ...b[0].pricing_rules }));
      }
    } catch { /* sin red */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isDemo) {
      setRequests(buildDemoData());
      setCouriers(DEMO_COURIERS);
      setBranches([
        { ...HOME_BRANCH, id: 'demo-b1' },
        { id: 'demo-b2', name: 'Cali', city: 'Cali', department: 'Valle del Cauca', center_lat: 3.4516, center_lon: -76.532, coverage_radius_km: 10, whatsapp: '573157924906', is_active: false, opened_at: null },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadLive();

    /* Los avisos en vivo llegan en ráfagas: cada repartidor en la calle
       escribe su posición varias veces por minuto, y antes cada una de
       esas escrituras disparaba una recarga completa del panel. Con la
       flota trabajando eso eran varias recargas por segundo, cada una
       de cuatro consultas. Aquí se juntan: pase lo que pase, se recarga
       una vez cada medio segundo como mucho. */
    const programarRecarga = () => {
      if (recargaPendiente.current) return;
      recargaPendiente.current = setTimeout(() => {
        recargaPendiente.current = null;
        loadLive();
      }, 500);
    };

    const stop = subscribeOps({
      onRequest: (payload) => {
        programarRecarga();
        if (payload.eventType === 'INSERT') {
          const r = payload.new;
          pushNotify('Nuevo pedido en Domix', {
            body: `${r.contact_name || 'Cliente'} · ${r.dropoff_address || ''}`,
            tag: `admin-${r.id}`,
          });
        }
      },

      /* Si lo único que cambió es dónde está el repartidor, se mueve el
         punto en el mapa y ya: no hace falta volver a bajar los pedidos,
         las sedes ni los pendientes.

         La comparación se hace contra lo que ya está en pantalla y no
         contra payload.old, porque Supabase solo manda la fila anterior
         si la tabla está en REPLICA IDENTITY FULL; sin eso llega vacía
         y esta rama no se tomaría nunca. */
      onCourier: (payload) => {
        const ahora = payload.new || {};
        const antes = flotaRef.current.find((c) => c.id === ahora.id);

        const soloPosicion = payload.eventType === 'UPDATE'
          && antes
          && antes.status === ahora.status
          && antes.branch_id === ahora.branch_id;

        if (soloPosicion) {
          setCouriers((filas) => filas.map((c) => (c.id === ahora.id
            ? { ...c, lat: ahora.last_lat, lon: ahora.last_lon } : c)));
          return;
        }
        programarRecarga();
      },
    });

    /* Con la seguridad por rol, el canal en vivo no lleva la sesión del
       panel y la base no le entrega filas: el panel se mantiene al día
       consultando cada pocos segundos (solo con la pestaña visible). */
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') loadLive();
    }, 8000);
    return () => {
      stop();
      clearInterval(t);
      if (recargaPendiente.current) clearTimeout(recargaPendiente.current);
    };
  }, [isDemo, ready, loadLive]);

  /* ---------- Acciones ---------- */
  const assign = useCallback(async (requestId, courierId) => {
    if (isDemo) {
      setRequests((rows) => rows.map((r) => (r.id === requestId
        ? { ...r, courier_id: courierId, status: 'assigned', assigned_at: new Date().toISOString() } : r)));
      return;
    }
    await assignCourier(requestId, courierId);
    loadLive();
  }, [isDemo, loadLive]);

  const advance = useCallback(async (requestId, status) => {
    if (isDemo) {
      const stamps = { picked_up: { picked_up_at: new Date().toISOString() }, delivered: { delivered_at: new Date().toISOString() } };
      setRequests((rows) => rows.map((r) => (r.id === requestId ? { ...r, status, ...(stamps[status] || {}) } : r)));
      return;
    }
    await setRequestStatus(requestId, status);
    loadLive();
  }, [isDemo, loadLive]);

  const createRequest = useCallback(async (payload) => {
    if (isDemo) {
      const req = { ...makeIncomingRequest(), ...payload, id: `demo-${Math.random().toString(36).slice(2, 10)}` };
      setRequests((rows) => [req, ...rows]);
      return { data: req };
    }
    const res = await createRequestFromAdmin(payload);
    loadLive();
    return res;
  }, [isDemo, loadLive]);

  /* Simulador: entra un pedido como si lo acabara de pedir un cliente. */
  const simulateIncoming = useCallback((opts = {}) => {
    const req = makeIncomingRequest(opts);
    setRequests((rows) => [req, ...rows]);
    pushNotify(opts.turbo ? 'Nuevo pedido TURBO' : 'Nuevo pedido', {
      body: `${req.contact_name} · ${req.dropoff_address}`,
      tag: `sim-${req.id}`,
    });
    return req;
  }, []);

  /* Surge automático a partir de la carga real de la flota. */
  const online = couriers.filter((c) => c.status === 'online').length;
  const busy = couriers.filter((c) => c.status === 'busy').length;
  const pending = requests.filter((r) => r.status === 'requested').length;
  /* Espejo de la flota para poder comparar dentro de los avisos en vivo
     sin volver a suscribirse cada vez que cambia. */
  flotaRef.current = couriers;

  const suggestedSurge = autoSurgeFor({ online, busy, pending });
  const effectiveRules = { ...rules, surge: rules.autoSurge ? suggestedSurge : rules.surge };

  return (
    <OpsContext.Provider
      value={{
        requests, couriers, branches, loading, isDemo,
        rules, effectiveRules, saveRules, suggestedSurge,
        assign, advance, createRequest, simulateIncoming, reload: loadLive,
        setBranches, setCouriers,
        stats: { online, busy, pending, porResolver, open: requests.filter((r) => OPEN_STATUSES.includes(r.status)).length },
      }}
    >
      {children}
    </OpsContext.Provider>
  );
}

export function useOps() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOps debe usarse dentro de OpsProvider');
  return ctx;
}
