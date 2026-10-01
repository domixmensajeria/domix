'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, Spinner } from './ui';
import { useIdioma } from '../context/IdiomaProvider';
import MarcarEnMapa from './MarcarEnMapa';
import { searchAddress, currentPosition, reverseGeocode } from '../lib/geo';
import { buscarLugaresLocales } from '../lib/lugares';
import { leerRecientes, guardarReciente } from '../lib/recientes';

/* Campo de dirección con autocompletado de OpenStreetMap y botón
   "usar mi ubicación". Devuelve texto + coordenadas para calcular tarifa. */
export default function AddressField({ label, icon = 'location_on', placeholder, value, point, onChange, allowLocate = false, required }) {
  const [text, setText] = useState(value || '');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [recientes, setRecientes] = useState([]);
  const { t } = useIdioma();

  useEffect(() => { setRecientes(leerRecientes()); }, []);
  const timer = useRef(null);
  const controller = useRef(null);
  const secuencia = useRef(0);

  useEffect(() => { setText(value || ''); }, [value]);

  /* Dos velocidades: el listado local de Buenaventura aparece con la
     primera letra, sin esperar nada; la búsqueda en el mapa, que sí sale
     a internet, va detrás con una pausa corta. Así la app responde de
     inmediato aunque la señal esté lenta. */
  const handleType = (e) => {
    const v = e.target.value;
    setText(v);
    onChange({ address: v, point: null });
    clearTimeout(timer.current);
    controller.current?.abort();

    const locales = buscarLugaresLocales(v);
    setItems(locales);
    setOpen(locales.length > 0);

    if (v.trim().length < 3) return setBusy(false);

    setBusy(true);
    const mio = ++secuencia.current;
    timer.current = setTimeout(async () => {
      controller.current = new AbortController();
      const res = await searchAddress(v, { signal: controller.current.signal });
      // Una búsqueda cancelada o ya superada no puede pisar a la vigente.
      if (res === null || mio !== secuencia.current) return;
      setItems(res);
      setOpen(true);
      setBusy(false);
    }, 420);
  };

  const choose = (item) => {
    setItems([]);
    setOpen(false);
    // Barrio que OpenStreetMap no conoce: el cliente marca el punto exacto
    // en vez de que le asignemos un centro aproximado.
    if (item.requierePin || item.lat == null) {
      setText(item.label);
      return setMarcando(true);
    }
    setText(item.label);
    onChange({ address: item.label, point: { lat: item.lat, lon: item.lon } });
    guardarReciente({ address: item.label, point: { lat: item.lat, lon: item.lon } });
  };

  const confirmarPin = ({ address, point: p }) => {
    setMarcando(false);
    setText(address);
    onChange({ address, point: p });
    guardarReciente({ address, point: p });
  };

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      const found = await reverseGeocode(pos);
      const label = found?.label || `Mi ubicación (${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)})`;
      setText(label);
      onChange({ address: label, point: { lat: pos.lat, lon: pos.lon } });
    } catch {
      onChange({ address: text, point: null });
    } finally {
      setLocating(false);
    }
  };

  return (
    <label style={{ display: 'block', position: 'relative' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--on-surface-variant)', letterSpacing: '.02em' }}>{label}</span>
        {allowLocate && (
          <button type="button" onClick={locate} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: 'var(--secondary)' }}>
            <Icon name={locating ? 'sync' : 'my_location'} size={15} fill />
            {locating ? t('direccion.ubicando') : t('direccion.usarUbicacion')}
          </button>
        )}
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 52, borderRadius: 'var(--sh-sm)', background: 'var(--surface-lowest)', border: `1px solid ${point ? 'var(--secondary)' : 'var(--outline-variant)'}` }}>
        <Icon name={icon} size={19} color={point ? 'var(--secondary)' : 'var(--on-surface-variant)'} fill={!!point} />
        <input
          required={required}
          value={text}
          onChange={handleType}
          onFocus={() => { if (items.length) return setOpen(true); if (!text.trim() && recientes.length) { setItems(recientes.map((d) => ({ label: d.address, lat: d.point.lat, lon: d.point.lon, reciente: true }))); setOpen(true); } }}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}
        />
        {busy && <Spinner size={18} />}
        {point && !busy && <Icon name="check_circle" size={18} fill color="var(--secondary)" />}
      </span>

      {text.trim().length >= 3 && !point && !busy && (
        <button
          type="button"
          onClick={() => setMarcando(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, fontSize: 11.5, fontWeight: 800, color: 'var(--secondary)' }}
        >
          <Icon name="add_location_alt" size={15} fill />
          {t('direccion.noAparece')}
        </button>
      )}

      {marcando && (
        <MarcarEnMapa
          titulo={label || t('direccion.marcarDireccion')}
          inicial={point}
          onConfirmar={confirmarPin}
          onCerrar={() => setMarcando(false)}
        />
      )}

      {open && items.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6, zIndex: 60, borderRadius: 'var(--sh-md)', background: 'var(--surface-lowest)', border: '1px solid var(--outline-variant)', boxShadow: 'var(--elev-3)', overflow: 'hidden', animation: 'dxDrop .16s var(--ease-out)' }}>
          {items.map((it, i) => (
            <button
              key={`${it.lat}-${it.lon}-${i}`}
              type="button"
              onClick={() => choose(it)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', textAlign: 'left', borderTop: i ? '1px solid var(--outline-variant)' : 'none', background: 'transparent' }}
            >
              <Icon
                name={it.reciente ? 'history' : it.requierePin ? 'add_location_alt' : 'location_on'}
                size={17}
                color={it.local ? 'var(--secondary)' : 'var(--on-surface-variant)'}
                fill={it.local}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{it.libre ? `Usar «${it.label}»` : it.label}</span>
                {it.requierePin && (
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--secondary)', marginTop: 2 }}>
                    {it.libre ? 'Tal como la escribí — marco el punto en el mapa' : 'Marca el punto en el mapa'}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
