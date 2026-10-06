/* ============================================================
   Geolocalización con servicios gratuitos y sin API key:
   - Nominatim (OpenStreetMap) para buscar y normalizar direcciones
   - OSRM público para la ruta real por calles
   - Haversine como respaldo si la red falla
   ============================================================ */

export const BUENAVENTURA = { lat: 3.8801, lon: -77.0312, label: 'Buenaventura, Valle del Cauca' };

import { buscarLugaresLocales } from './lugares';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org';

export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(h))).toFixed(2);
}

/* Sugerencias de dirección mientras el usuario escribe.
   Primero el listado local de Buenaventura (instantáneo y siempre
   disponible), después lo que encuentre OpenStreetMap. El listado local
   existe porque OSM no tiene mapeada toda la ciudad. */
export async function searchAddress(query, { signal } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const locales = buscarLugaresLocales(q);
  if (q.length < 3) return locales;

  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=co&addressdetails=1`
    + `&viewbox=-77.20,3.98,-76.88,3.78&bounded=1&q=${encodeURIComponent(q + ', Buenaventura')}`;

  let remotos = [];
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (res.ok) {
      const rows = await res.json();
      remotos = rows.map((r) => ({
        label: shortLabel(r.display_name),
        full: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon),
      }));
    }
  } catch {
    // Sin red o búsqueda cancelada: quedan las sugerencias locales.
  }

  // Se descartan los repetidos, dando prioridad a los locales.
  const vistos = new Set(locales.map((l) => l.label.toLowerCase()));
  return [...locales, ...remotos.filter((r) => !vistos.has(r.label.toLowerCase()))];
}

/* Dirección aproximada a partir de coordenadas (para "usar mi ubicación"). */
export async function reverseGeocode({ lat, lon }) {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const r = await res.json();
    return { label: shortLabel(r.display_name), full: r.display_name, lat: Number(r.lat), lon: Number(r.lon) };
  } catch {
    return null;
  }
}

/* Ubicación actual del navegador. */
export function currentPosition({ timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(new Error('Sin geolocalización'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 }
    );
  });
}

/* GPS del repartidor. Entrega solo posiciones fiables (precisión de 150 m
   o mejor), avisa del estado del permiso y mantiene la pantalla activa
   para que el sistema no duerma el seguimiento mientras trabaja. */
export function watchPosition(onUpdate, onEstado) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onEstado?.('no-soportado');
    return () => {};
  }
  let wake = null;
  const pedirWake = async () => {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch { /* ignorar */ }
  };
  const alVolver = () => { if (document.visibilityState === 'visible') pedirWake(); };
  document.addEventListener('visibilitychange', alVolver);
  pedirWake();

  const id = navigator.geolocation.watchPosition(
    (p) => {
      if (p.coords.accuracy != null && p.coords.accuracy > 150) { onEstado?.('impreciso'); return; }
      onEstado?.('ok');
      onUpdate({
        lat: p.coords.latitude, lon: p.coords.longitude,
        heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
        accuracy: p.coords.accuracy,
      });
    },
    (e) => onEstado?.(e.code === 1 ? 'denegado' : 'sin-senal'),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  return () => {
    navigator.geolocation.clearWatch(id);
    document.removeEventListener('visibilitychange', alVolver);
    try { wake?.release(); } catch { /* ignorar */ }
  };
}

/* Ruta real por calles. Devuelve distancia, duración y la polilínea. */
export async function routeBetween(from, to) {
  const fallback = { distanceKm: haversineKm(from, to) * 1.3, durationMin: null, coords: [from, to].filter(Boolean) };
  if (!from || !to) return { distanceKm: 0, durationMin: null, coords: [] };
  try {
    const url = `${OSRM}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return fallback;
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) return fallback;
    return {
      distanceKm: +(r.distance / 1000).toFixed(2),
      durationMin: Math.round(r.duration / 60),
      coords: r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
    };
  } catch {
    return fallback;
  }
}

/* Punto intermedio de una ruta, para simular el avance del repartidor. */
export function pointAlong(coords, progress) {
  if (!coords?.length) return null;
  const p = Math.min(1, Math.max(0, progress));
  const i = Math.min(coords.length - 1, Math.floor(p * (coords.length - 1)));
  return coords[i];
}

function shortLabel(displayName = '') {
  const parts = displayName.split(',').map((s) => s.trim());
  return parts.slice(0, 3).join(', ');
}
