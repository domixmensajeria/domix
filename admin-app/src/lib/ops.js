import { supabase } from './supabaseClient';

export const SERVICE_LABELS = {
  mensajeria: 'Mensajería',
  encomienda: 'Encomienda',
  domicilio: 'Domicilio',
  mandado: 'Mandado',
  taxi: 'Taxi Urbano',
  placa_blanca: 'Placa Blanca (Cali)',
  intermunicipal_encomienda: 'Encomienda Buenaventura ⇄ Cali',
  autorizacion_medica: 'Autorización médica',
};

export const SERVICE_ICON = {
  mensajeria: 'mail',
  encomienda: 'inventory_2',
  domicilio: 'moped',
  mandado: 'shopping_bag',
  taxi: 'local_taxi',
  placa_blanca: 'directions_bus',
  intermunicipal_encomienda: 'local_shipping',
  autorizacion_medica: 'medical_information',
};

export const STATUS_META = {
  requested: { label: 'Sin asignar', bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)', dot: 'var(--tertiary)' },
  assigned: { label: 'Asignado', bg: 'var(--primary-container)', fg: 'var(--on-primary-container)', dot: 'var(--primary)' },
  picked_up: { label: 'Recogido', bg: 'var(--primary-container)', fg: 'var(--on-primary-container)', dot: 'var(--primary)' },
  in_progress: { label: 'En camino', bg: 'var(--primary-container)', fg: 'var(--on-primary-container)', dot: 'var(--primary)' },
  delivered: { label: 'Entregado', bg: 'var(--secondary-container)', fg: 'var(--on-secondary-container)', dot: 'var(--secondary)' },
  cancelled: { label: 'Cancelado', bg: 'var(--error-container)', fg: 'var(--on-error-container)', dot: 'var(--error)' },
};

export const OPEN_STATUSES = ['requested', 'assigned', 'picked_up', 'in_progress'];

/* Columnas del tablero de pedidos en vivo. */
export const BOARD_COLUMNS = [
  { id: 'requested', label: 'Sin asignar', icon: 'pending_actions', tono: 'orange',
    vacio: 'Todo asignado. Cuando entre un pedido, aparece aquí.' },
  { id: 'assigned', label: 'Por recoger', icon: 'assignment_ind', tono: 'navy',
    vacio: 'Nadie va en camino a recoger ahora mismo.' },
  { id: 'picked_up', label: 'Recogidos', icon: 'inventory', tono: 'purple',
    vacio: 'Sin paquetes en mano.' },
  { id: 'in_progress', label: 'En camino', icon: 'moped', tono: 'green',
    vacio: 'Ninguna entrega en la calle.' },
];

export async function fetchRequests({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('service_requests').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchCouriers() {
  const { data, error } = await supabase
    .from('courier_profiles').select('*, profiles(first_name, last_name, phone_number)').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function fetchBranches() {
  const { data, error } = await supabase.from('branches').select('*').order('opened_at');
  if (error) throw error;
  return data || [];
}

export async function createBranch(branch) {
  return supabase.from('branches').insert(branch).select().single();
}

export async function toggleBranch(id, is_active) {
  return supabase.from('branches').update({ is_active }).eq('id', id).select().maybeSingle();
}

export async function saveBranchRules(id, pricing_rules) {
  const { data, error } = await supabase.rpc('guardar_tarifas_sede', {
    p_branch_id: id,
    p_rules: pricing_rules,
  });
  if (error) {
    return supabase.from('branches').update({ pricing_rules }).eq('id', id).select().maybeSingle();
  }
  return { data };
}

export async function assignCourierPassword(profileId, password) {
  const { data, error } = await supabase.rpc('admin_asignar_clave', {
    p_profile_id: profileId,
    p_clave: password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function assignCourier(requestId, courierId) {
  return supabase.from('service_requests')
    .update({ courier_id: courierId, status: 'assigned', assigned_at: new Date().toISOString() })
    .eq('id', requestId).select().maybeSingle();
}

export async function setRequestStatus(requestId, status) {
  const stamps = {
    picked_up: { picked_up_at: new Date().toISOString() },
    delivered: { delivered_at: new Date().toISOString() },
  };
  return supabase.from('service_requests').update({ status, ...(stamps[status] || {}) }).eq('id', requestId).select().maybeSingle();
}

export async function createCourier({ first_name, last_name, phone_number, work_zone, branch_id, password }) {
  const { data: profile, error: e1 } = await supabase
    .from('profiles').insert({ first_name, last_name, phone_number, role: 'courier' }).select().single();
  if (e1) return { error: e1 };
  const { error: e2 } = await supabase.from('courier_profiles')
    .insert({ id: profile.id, work_zone: work_zone || 'Centro', branch_id: branch_id || null });
  if (e2) return { error: e2 };

  if (password?.trim()) {
    const res = await assignCourierPassword(profile.id, password.trim());
    if (!res.ok) return { data: profile, error: { message: `Repartidor creado, pero falló la asignación de clave: ${res.error}` } };
  }

  return { data: profile };
}

/* Salida de emergencia: cuando el cliente no tiene el código a la mano,
   soporte lo consulta desde el panel y se lo dicta al repartidor. */
export async function fetchDeliveryPin(requestId) {
  const { data, error } = await supabase.rpc('admin_delivery_pin', { p_request_id: requestId });
  if (error) return null;
  return data || null;
}

export async function createRequestFromAdmin(payload) {
  return supabase.from('service_requests').insert({ ...payload, source: 'admin' }).select().single();
}

/* Escucha en tiempo real: pedidos nuevos y movimiento de la flota. */
export function subscribeOps({ onRequest, onCourier }) {
  const channel = supabase
    .channel('domix-ops')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, (p) => onRequest?.(p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_profiles' }, (p) => onCourier?.(p))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
