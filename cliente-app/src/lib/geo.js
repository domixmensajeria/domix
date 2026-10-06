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

/* ------------------------------------------------------------
   Sugerencias de dirección mientras el usuario escribe.

   Tres capas, de la más rápida a la más lenta:
   1. Listado local de Buenaventura (instantáneo, sin red).
   2. Photon (komoot): buscador de OpenStreetMap hecho PARA autocompletar.
   3. Nominatim, solo como respaldo.

   Por qué no solo Nominatim: su política de uso prohíbe el
   autocompletado tecla por tecla y responde 429 cuando se le pide más
   de una búsqueda por segundo. El código anterior se tragaba ese error
   y al cliente simplemente "no le salían" las direcciones.

   Por qué se separa el número: OpenStreetMap casi no tiene números de
   casa en Buenaventura. "Calle 5 #10-20" no existe como tal, pero
   "Calle 5" sí. Se busca la calle y se le devuelve al cliente SU número,
   para que el repartidor lea la dirección completa; el punto exacto lo
   afina el pin del mapa.
   ------------------------------------------------------------ */
const PHOTON = 'https://photon.komoot.io/api/';
const BBOX = '-77.20,3.78,-76.88,3.98'; // minLon,minLat,maxLon,maxLat
const cache = new Map();

const ABREVIATURAS = [
  [/\b(cra|kra|krr|cr|carr)\b\.?/gi, 'Carrera'],
  [/\b(cll|cl|cal)\b\.?/gi, 'Calle'],
  [/\b(av|avda|avd)\b\.?/gi, 'Avenida'],
  [/\b(dg|diag)\b\.?/gi, 'Diagonal'],
  [/\b(tv|trans|transv)\b\.?/gi, 'Transversal'],
];

/* "cra 5 # 10-20" -> { calle: "Carrera 5", numero: "#10-20" } */
export function separarDireccion(texto) {
  let t = (texto || '').replace(/\s+/g, ' ').trim();
  for (const [re, nombre] of ABREVIATURAS) t = t.replace(re, nombre);
  const m = t.match(/\s*(?:#|n[oº°]\.?|num\.?)\s*(\d[\w\s\-–]*)$/i) || t.match(/\s+(\d+\s*[-–]\s*\d+\w*)$/);
  if (!m) return { calle: t, numero: '' };
  return { calle: t.slice(0, m.index).trim(), numero: `#${m[1].replace(/\s+/g, '')}` };
}

function conTiempo(signal, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  signal?.addEventListener('abort', () => c.abort());
  return { signal: c.signal, fin: () => clearTimeout(t) };
}

async function buscarPhoton(calle, numero, signal) {
  const { signal: sg, fin } = conTiempo(signal, 5000);
  try {
    const res = await fetch(`${PHOTON}?q=${encodeURIComponent(calle)}&lat=3.88&lon=-77.03&limit=7&bbox=${BBOX}`, { signal: sg });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const base = p.name || [p.street, p.housenumber].filter(Boolean).join(' ');
      const zona = [p.district, p.suburb, p.locality].find((z) => z && !/^Localidad /i.test(z)) || p.district || '';
      const partes = [`${base}${numero ? ' ' + numero : ''}`, zona && zona !== 'Buenaventura' ? zona : null, 'Buenaventura'];
      return {
        label: partes.filter(Boolean).join(', '),
        full: partes.filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    }).filter((r) => r.label && !Number.isNaN(r.lat));
  } catch {
    return null;
  } finally { fin(); }
}

async function buscarNominatim(calle, numero, signal) {
  const { signal: sg, fin } = conTiempo(signal, 6000);
  try {
    const res = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=co&addressdetails=1`
      + `&viewbox=-77.20,3.98,-76.88,3.78&q=${encodeURIComponent(calle + ', Buenaventura')}`, { signal: sg, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()).map((r) => {
      const label = `${shortLabel(r.display_name)}${numero ? ' ' + numero : ''}`;
      return { label, full: r.display_name, lat: Number(r.lat), lon: Number(r.lon) };
    });
  } catch {
    return null;
  } finally { fin(); }
}

export async function searchAddress(query, { signal } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const locales = buscarLugaresLocales(q);
  if (q.length < 3) return locales;

  const { calle, numero } = separarDireccion(q);
  const clave = `${calle}|${numero}`.toLowerCase();
  let remotos = cache.get(clave);

  if (!remotos) {
    remotos = await buscarPhoton(calle, numero, signal);
    if (signal?.aborted) return null;                       // se siguió escribiendo: no cuenta
    if (!remotos || !remotos.length) {
      const respaldo = await buscarNominatim(calle, numero, signal);
      if (signal?.aborted) return null;
      remotos = respaldo || remotos || [];
    }
    if (remotos.length) cache.set(clave, remotos);
  }

  // Sin repetidos, locales primero. Siempre al final: usar lo escrito tal
  // cual y ubicarlo con el pin — nunca se deja al cliente sin salida.
  const vistos = new Set(locales.map((l) => l.label.toLowerCase()));
  const lista = [...locales];
  for (const r of remotos) {
    const k = r.label.toLowerCase();
    if (!vistos.has(k)) { vistos.add(k); lista.push(r); }
  }
  lista.push({ label: q, lat: null, lon: null, requierePin: true, libre: true });
  return lista;
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

export function watchPosition(onUpdate, onError) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => onUpdate({ lat: p.coords.latitude, lon: p.coords.longitude, heading: p.coords.heading }),
    onError,
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
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
