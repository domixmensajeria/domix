import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notificarConfirmacionRegistro } from '../../../../lib/resend';

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

    const { nombre, email, telefono, rol = 'client', password } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Debes ingresar un correo electrónico válido' }, { status: 400 });
    }

    if (!nombre) {
      return NextResponse.json({ error: 'Debes ingresar un nombre completo' }, { status: 400 });
    }

    // Generar código de 6 dígitos y token aleatorio
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomUUID();

    const supabase = getSupabaseAdmin();

    // Guardar en tabla de verificaciones de email
    const { error: insertError } = await supabase.from('auth_verificaciones_email').insert({
      email: email.trim().toLowerCase(),
      telefono: telefono || null,
      codigo_verificacion: codigo,
      token_enlace: token,
      rol,
      confirmado: false,
    });

    if (insertError) {
      console.error('[Error insert auth_verificaciones_email]:', insertError);
      return NextResponse.json({ error: 'Error al registrar intento de verificación', details: insertError.message }, { status: 500 });
    }

    // Enviar correo con plantilla PRO a través de Resend
    const resendRes = await notificarConfirmacionRegistro({
      email: email.trim().toLowerCase(),
      nombre,
      codigo,
      rol,
      token,
    });

    return NextResponse.json({
      ok: true,
      mensaje: `Código de verificación de 6 dígitos enviado exitosamente a ${email}`,
      email: email.trim().toLowerCase(),
      rol,
      resend_status: resendRes.ok ? 'enviado' : 'error_envio',
    }, { status: 200 });

  } catch (err) {
    console.error('[Excepcion /api/auth/registro]:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
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
