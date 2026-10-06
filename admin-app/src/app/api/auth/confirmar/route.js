import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwgofasontumxgzahuph.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
    }

    const { email, codigo, token } = body;

    if (!email && !token) {
      return NextResponse.json({ error: 'Falta email o token de verificación' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase.from('auth_verificaciones_email').select('*');

    if (token) {
      query = query.eq('token_enlace', token);
    } else {
      query = query.eq('email', email.trim().toLowerCase()).eq('codigo_verificacion', (codigo || '').trim());
    }

    const { data: verifList, error: queryError } = await query
      .eq('confirmado', false)
      .gt('expira_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError || !verifList || verifList.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Código inválido o expirado. Por favor solicita uno nuevo.',
      }, { status: 400 });
    }

    const verif = verifList[0];

    // Marcar como confirmado
    await supabase.from('auth_verificaciones_email').update({
      confirmado: true,
      confirmado_at: new Date().toISOString(),
    }).eq('id', verif.id);

    // Actualizar perfil si ya existe o crear
    const { data: profile } = await supabase.from('profiles')
      .select('id')
      .eq('phone_number', verif.telefono)
      .maybeSingle();

    if (profile?.id) {
      await supabase.from('profiles').update({
        email: verif.email,
        email_confirmado: true,
      }).eq('id', profile.id);
    }

    return NextResponse.json({
      ok: true,
      verificado: true,
      email: verif.email,
      rol: verif.rol,
      mensaje: '¡Correo verificado con éxito! Tu cuenta ha sido activada.',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[Excepcion /api/auth/confirmar]:', err);
    return NextResponse.json({ error: err.message || 'Error interno al confirmar cuenta' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
