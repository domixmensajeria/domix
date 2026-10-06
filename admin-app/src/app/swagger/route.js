import { NextResponse } from 'next/server';

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Domix / TuraFood API Server · Swagger UI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=IBM+Plex+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0d0e;
      --card-bg: #141719;
      --border: #22272b;
      --text: #e2e8f0;
      --primary: #5FBF45;
      --primary-hover: #4ea836;
      --accent: #38bdf8;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .topbar-header {
      background: #111315;
      border-bottom: 1px solid var(--border);
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 34px;
      height: 34px;
      background: #fff;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #0b0d0e;
      font-size: 19px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .brand-title span {
      color: var(--primary);
    }
    .brand-subtitle {
      font-size: 11px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .badge-env {
      background: rgba(95, 191, 69, 0.15);
      border: 1px solid rgba(95, 191, 69, 0.3);
      color: #8FD46E;
      padding: 5px 12px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      font-family: 'IBM Plex Mono', monospace;
    }
    /* Estilos personalizados para Swagger UI en modo oscuro */
    .swagger-ui {
      color: #c9d1d9;
    }
    .swagger-ui .info {
      margin: 24px 0;
    }
    .swagger-ui .info .title {
      color: #f0f6fc;
      font-family: 'Manrope', sans-serif;
      font-weight: 800;
    }
    .swagger-ui .info p, .swagger-ui .info li {
      color: #8b949e;
    }
    .swagger-ui .scheme-container {
      background: #111315;
      box-shadow: none;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin: 20px 0;
      padding: 18px;
    }
    .swagger-ui .opblock {
      background: #141719 !important;
      border-radius: 10px !important;
      border: 1px solid var(--border) !important;
      margin-bottom: 14px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    }
    .swagger-ui .opblock .opblock-summary {
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 12px 16px;
    }
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 6px;
      font-weight: 800;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      min-width: 70px;
      text-align: center;
    }
    .swagger-ui .opblock-body {
      background: #101214 !important;
      color: #e2e8f0;
    }
    .swagger-ui .opblock-tag {
      color: #f0f6fc !important;
      border-bottom: 1px solid #22272b !important;
      font-size: 17px !important;
      font-weight: 700 !important;
      padding: 16px 0 !important;
    }
    .swagger-ui .opblock-tag small {
      color: #8b949e !important;
    }
    .swagger-ui .btn.execute {
      background-color: var(--primary) !important;
      border-color: var(--primary) !important;
      color: #0b0d0e !important;
      font-weight: 800 !important;
      border-radius: 8px !important;
      padding: 8px 24px !important;
    }
    .swagger-ui .btn.execute:hover {
      background-color: var(--primary-hover) !important;
    }
    .swagger-ui .btn.authorize {
      border-color: var(--primary) !important;
      color: var(--primary) !important;
      border-radius: 8px !important;
      font-weight: 700 !important;
    }
    .swagger-ui .btn.authorize svg {
      fill: var(--primary) !important;
    }
    .swagger-ui select, .swagger-ui input[type=text] {
      background: #1a1e22 !important;
      border: 1px solid #2e353b !important;
      color: #fff !important;
      border-radius: 6px !important;
      font-family: 'IBM Plex Mono', monospace !important;
    }
    .swagger-ui textarea {
      background: #090a0b !important;
      color: #a5d6a7 !important;
      border: 1px solid #22272b !important;
      border-radius: 8px !important;
      font-family: 'IBM Plex Mono', monospace !important;
    }
    .swagger-ui table thead tr th {
      color: #8b949e !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .swagger-ui .response-col_status {
      color: #8FD46E !important;
      font-family: 'IBM Plex Mono', monospace !important;
    }
    .swagger-ui .microlight {
      background: #070809 !important;
      border: 1px solid #1f2327 !important;
      border-radius: 8px !important;
      color: #c9d1d9 !important;
      font-family: 'IBM Plex Mono', monospace !important;
    }
  </style>
</head>
<body>
  <div class="topbar-header">
    <div class="brand">
      <div class="brand-logo">D</div>
      <div>
        <div class="brand-title">Domi<span>X</span> · API Explorer</div>
        <div class="brand-subtitle">turafood.com · swagger server engine</div>
      </div>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span class="badge-env">TURAFOOD CLOUD SERVER</span>
      <a href="/api-docs" style="color: var(--primary); font-size: 13px; text-decoration: none; font-weight: 700; margin-left: 12px;">Ir a Consola Panel &rarr;</a>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(SWAGGER_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
