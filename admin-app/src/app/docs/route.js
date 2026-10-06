import { NextResponse } from 'next/server';

export async function GET(request) {
  const url = new URL('/swagger', request.url);
  return NextResponse.redirect(url);
}
