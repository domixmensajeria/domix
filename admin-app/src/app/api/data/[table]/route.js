import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = new Set([
  'pedidos',
  'repartidores',
  'branches',
  'chat_messages',
  'courier_locations',
  'historial_estados',
]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwgofasontumxgzahuph.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request, { params }) {
  const { table } = await params;
  const startedAt = Date.now();

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({
      error: `Tabla no autorizada o no disponible: ${table}`,
      tablas_permitidas: Array.from(ALLOWED_TABLES),
    }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const estado = searchParams.get('estado');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from(table).select('*').limit(limit);

    if (estado && table === 'pedidos') {
      query = query.eq('estado', estado);
    }

    if (table === 'pedidos') {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    const latencyMs = Date.now() - startedAt;

    if (error) {
      return NextResponse.json({
        ok: false,
        table,
        error: error.message,
        latency_ms: latencyMs,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      table,
      total_items: data?.length || 0,
      data,
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        'x-execution-latency': `${latencyMs}ms`,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      table,
      error: err.message,
      latency_ms: Date.now() - startedAt,
    }, { status: 500 });
  }
}
