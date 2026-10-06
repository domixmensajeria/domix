import { NextResponse } from 'next/server';
import { openApiSpec } from '../../../lib/openapi-spec';

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-domix-token',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-domix-token',
    },
  });
}
