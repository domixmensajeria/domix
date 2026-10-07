/* ============================================================
   Motor de despacho Domix — tarifas dinámicas
   Base + km + demanda (surge) + recargos (clima/noche) + Turbo.
   Se usa igual en cliente, repartidor y panel para que el precio
   que ve el cliente sea exactamente el que ve la empresa.
   ============================================================ */

export const DEFAULT_RULES = {
  baseFare: 6000,          // tarifa base (hasta baseKm)
  baseKm: 2,               // km incluidos en la base
  perKm: 1200,             // costo por km adicional
  minFare: 6000,           // piso garantizado
  surge: 1,                // multiplicador por demanda
  autoSurge: true,         // sube solo cuando la flota está ocupada
  rainSurcharge: 2500,     // recargo fijo por lluvia
  rainActive: false,
  nightSurchargePct: 20,   // % adicional 10 p.m. – 6 a.m.
  nightActive: true,
  turboFee: 3500,          // recargo de entrega prioritaria
  turboRadiusKm: 3,        // cobertura máxima para Turbo
  coverageRadiusKm: 8,     // cobertura general
  courierSharePct: 70,     // % de la tarifa que se lleva el repartidor (70% repartidor / 30% Domix)
  autoAssign: true,        // asignación automática al más cercano
};

/* Recargo por tipo de servicio: unos exigen trámite o espera. */
export const SERVICE_SURCHARGE = {
  mensajeria: 0,
  domicilio: 0,
  encomienda: 2000,
  mandado: 1000,
  autorizacion_medica: 2000,
};

export const SURGE_STEPS = [
  { value: 1, label: '1,0×', hint: 'Normal' },
  { value: 1.2, label: '1,2×', hint: '+20%' },
  { value: 1.4, label: '1,4×', hint: '+40%' },
  { value: 1.7, label: '1,7×', hint: '+70%' },
  { value: 2, label: '2,0×', hint: '+100%' },
];

export function isNightNow(date = new Date()) {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

/* Calcula la tarifa completa y devuelve el desglose para mostrarlo. */
export function quote({ distanceKm = 0, serviceType = 'mensajeria', turbo = false, rules = DEFAULT_RULES, now = new Date() }) {
  const r = { ...DEFAULT_RULES, ...rules };
  const km = Math.max(0, Number(distanceKm) || 0);

  const extraKm = Math.max(0, km - r.baseKm);
  const distanceFee = Math.round(extraKm * r.perKm);
  const serviceFee = SERVICE_SURCHARGE[serviceType] || 0;

  const subtotal = r.baseFare + distanceFee + serviceFee;
  const surgeAmount = Math.round(subtotal * (r.surge - 1));

  const night = r.nightActive && isNightNow(now);
  const nightAmount = night ? Math.round((subtotal + surgeAmount) * (r.nightSurchargePct / 100)) : 0;
  const rainAmount = r.rainActive ? r.rainSurcharge : 0;
  const turboAmount = turbo ? r.turboFee : 0;

  const raw = subtotal + surgeAmount + nightAmount + rainAmount + turboAmount;
  const total = Math.max(r.minFare, Math.round(raw / 100) * 100);

  const courierPay = Math.round((total * r.courierSharePct) / 100 / 100) * 100;

  return {
    total,
    courierPay,
    companyMargin: total - courierPay,
    distanceKm: km,
    breakdown: [
      { label: `Tarifa base (hasta ${r.baseKm} km)`, amount: r.baseFare },
      ...(distanceFee > 0 ? [{ label: `${extraKm.toFixed(1)} km adicionales`, amount: distanceFee }] : []),
      ...(serviceFee > 0 ? [{ label: 'Recargo por tipo de servicio', amount: serviceFee }] : []),
      ...(surgeAmount > 0 ? [{ label: `Alta demanda (${r.surge.toFixed(1)}×)`, amount: surgeAmount, tone: 'surge' }] : []),
      ...(nightAmount > 0 ? [{ label: `Horario nocturno (+${r.nightSurchargePct}%)`, amount: nightAmount, tone: 'surge' }] : []),
      ...(rainAmount > 0 ? [{ label: 'Recargo por lluvia', amount: rainAmount, tone: 'surge' }] : []),
      ...(turboAmount > 0 ? [{ label: 'Domix Turbo · entrega prioritaria', amount: turboAmount, tone: 'turbo' }] : []),
    ],
    flags: { night, rain: r.rainActive, turbo, surge: r.surge > 1 },
  };
}

/* Tiempo estimado: 22 km/h promedio en moto urbana + alistamiento. */
export function etaMinutes(distanceKm, turbo = false) {
  const travel = (Number(distanceKm) || 0) / 22 * 60;
  const prep = turbo ? 4 : 9;
  return Math.max(turbo ? 8 : 12, Math.round(travel + prep));
}

/* Surge automático según qué tanta flota está ocupada. */
export function autoSurgeFor({ online = 0, busy = 0, pending = 0 }) {
  if (!online) return pending > 0 ? 1.4 : 1;
  const load = (busy + pending) / online;
  if (load >= 1.5) return 2;
  if (load >= 1) return 1.7;
  if (load >= 0.7) return 1.4;
  if (load >= 0.4) return 1.2;
  return 1;
}

export const money = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;
