/**
 * Especificación OpenAPI 3.0 para la plataforma Domix / TuraFood
 * Cubre endpoints de Next.js, Webhooks de WhatsApp, IA (Claude 3.5 Sonnet)
 * y funciones RPC de la base de datos Supabase.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Domix / TuraFood API Server',
    version: '1.0.0',
    description: `### Servidor de APIs y Explorador Interactivo Domix / TuraFood
Plataforma logística y de domicilios de última milla.
Este servidor Swagger documenta y permite ejecutar en tiempo real:
- **Webhooks & Mensajería:** Integración oficial con Meta WhatsApp Cloud API.
- **Motor de IA:** Extracción semántica de pedidos y generación de respuestas con Anthropic Claude 3.5 Sonnet.
- **RPCs de Base de Datos:** Algoritmos atómicos en PostgreSQL (liquidación 80/20, confirmación de entregas, asignación de pedidos, autenticación bcrypt).
- **Consultas REST:** Monitoreo operativo de carreras, flota de repartidores y reglas de tarificación por sede.`,
    contact: {
      name: 'Soporte Técnico Domix / TuraFood',
      email: 'sophieai.tech@gmail.com',
      url: 'https://turafood.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3002',
      description: 'Servidor Local de Desarrollo (Next.js)',
    },
    {
      url: 'https://panel.turafood.com',
      description: 'Producción Cloudflare Worker (Panel Admin)',
    },
    {
      url: 'https://admin.turafood.com',
      description: 'Producción Cloudflare Worker (Alias Admin)',
    },
    {
      url: 'https://pwgofasontumxgzahuph.supabase.co',
      description: 'Motor Supabase PostgREST Directo',
    },
  ],
  tags: [
    {
      name: 'WhatsApp & Meta',
      description: 'Webhooks de eventos entrantes y verificación de Meta WhatsApp Cloud API',
    },
    {
      name: 'Operaciones e IA',
      description: 'Procesamiento de lenguaje natural con Claude 3.5 Sonnet y despacho de mensajes',
    },
    {
      name: 'Despacho & Pedidos (RPC)',
      description: 'Lógica transaccional de órdenes, cotización, toma de carreras y entregas',
    },
    {
      name: 'Finanzas & Flota (RPC)',
      description: 'Liquidación de saldos 70/30 (70% conductor / 30% Domix), comisiones y telemetría de repartidores',
    },
    {
      name: 'Autenticación & Seguridad',
      description: 'Gestión de credenciales con hash bcrypt y control de acceso',
    },
    {
      name: 'Consultas de Datos',
      description: 'Acceso a entidades maestras (pedidos, repartidores, sedes y tarifas)',
    },
    {
      name: 'Notificaciones & Emails (Resend)',
      description: 'Secuencia automatizada de correos modernos y adaptables con la API de Resend (pedido registrado y servicio finalizado)',
    },
  ],
  components: {
    securitySchemes: {
      AdminTokenAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-domix-token',
        description: 'Token de sesión de administrador o despachador',
      },
      SupabaseAnonKey: {
        type: 'apiKey',
        in: 'header',
        name: 'apikey',
        description: 'Clave pública anónima de Supabase',
      },
      SupabaseBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de usuario autenticado o service_role',
      },
    },
    schemas: {
      CrearSolicitudPayload: {
        type: 'object',
        required: [
          'p_cliente_telefono',
          'p_cliente_nombre',
          'p_origen_direccion',
          'p_destino_direccion',
          'p_costo_envio',
        ],
        properties: {
          p_cliente_telefono: {
            type: 'string',
            example: '+573001234567',
            description: 'Número telefónico en formato internacional E.164',
          },
          p_cliente_nombre: {
            type: 'string',
            example: 'María Mercedes',
            description: 'Nombre completo del cliente remitente',
          },
          p_origen_direccion: {
            type: 'string',
            example: 'Cra 2 # 3-45 Centro',
            description: 'Dirección de recogida del paquete',
          },
          p_destino_direccion: {
            type: 'string',
            example: 'Calle 5 # 8-20 Bellavista',
            description: 'Dirección de entrega final',
          },
          p_origen_lat: {
            type: 'number',
            format: 'double',
            example: 3.8821,
            description: 'Latitud geográfica de recogida',
          },
          p_origen_lng: {
            type: 'number',
            format: 'double',
            example: -77.0312,
            description: 'Longitud geográfica de recogida',
          },
          p_destino_lat: {
            type: 'number',
            format: 'double',
            example: 3.8895,
            description: 'Latitud geográfica de entrega',
          },
          p_destino_lng: {
            type: 'number',
            format: 'double',
            example: -77.0254,
            description: 'Longitud geográfica de entrega',
          },
          p_descripcion: {
            type: 'string',
            example: 'Paquete de comida y medicamentos sellados',
            description: 'Detalle del contenido del envío',
          },
          p_valor_declarado: {
            type: 'number',
            example: 35000,
            description: 'Valor del producto en COP (si aplica cobro contraentrega)',
          },
          p_costo_envio: {
            type: 'number',
            example: 8000,
            description: 'Tarifa del servicio de transporte en COP',
          },
          p_metodo_pago: {
            type: 'string',
            enum: ['efectivo', 'transferencia', 'nequi', 'daviplata'],
            example: 'efectivo',
            description: 'Forma de pago acordada',
          },
          p_canal: {
            type: 'string',
            enum: ['web', 'whatsapp', 'call_center', 'app'],
            example: 'web',
            description: 'Canal de origen de la solicitud',
          },
        },
      },
      ConfirmDeliveryPayload: {
        type: 'object',
        required: ['p_pedido_id', 'p_codigo_entrega', 'p_repartidor_id'],
        properties: {
          p_pedido_id: {
            type: 'integer',
            example: 104,
            description: 'Identificador del pedido en proceso de entrega',
          },
          p_codigo_entrega: {
            type: 'string',
            example: '8241',
            description: 'Código de seguridad de 4 dígitos proporcionado al cliente',
          },
          p_repartidor_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            description: 'UUID del repartidor asignado',
          },
        },
      },
      SaldoRepartidorPayload: {
        type: 'object',
        required: ['p_repartidor_id'],
        properties: {
          p_repartidor_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            description: 'UUID del repartidor a consultar',
          },
        },
      },
      TomarPedidoPayload: {
        type: 'object',
        required: ['p_pedido_id', 'p_repartidor_id'],
        properties: {
          p_pedido_id: {
            type: 'integer',
            example: 104,
            description: 'ID del pedido disponible',
          },
          p_repartidor_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            description: 'UUID del repartidor que toma la carrera',
          },
        },
      },
      ActualizarUbicacionPayload: {
        type: 'object',
        required: ['p_repartidor_id', 'p_lat', 'p_lng'],
        properties: {
          p_repartidor_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          },
          p_lat: {
            type: 'number',
            format: 'double',
            example: 3.8845,
          },
          p_lng: {
            type: 'number',
            format: 'double',
            example: -77.0298,
          },
        },
      },
      AdminAsignarClavePayload: {
        type: 'object',
        required: ['p_repartidor_id', 'p_hash'],
        properties: {
          p_repartidor_id: {
            type: 'string',
            format: 'uuid',
            example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          },
          p_hash: {
            type: 'string',
            example: '$2b$10$wN9aO7l5z6U7z8Q0.X9JyeO1n2m3k4l5...',
            description: 'Hash de contraseña generado con bcrypt',
          },
        },
      },
      ResponderPayload: {
        type: 'object',
        required: ['telefono', 'mensaje'],
        properties: {
          telefono: {
            type: 'string',
            example: '573157924906',
            description: 'Número de WhatsApp destino (formato numérico sin +)',
          },
          mensaje: {
            type: 'string',
            example: '¡Hola! Tu domicilio Domix ha sido asignado al repartidor Yeison.',
            description: 'Cuerpo del mensaje de texto a enviar',
          },
          pedido_id: {
            type: 'integer',
            example: 104,
            description: 'ID de pedido opcional para asociar al historial',
          },
        },
      },
      LeerChatPayload: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sender: { type: 'string', example: 'cliente' },
                texto: { type: 'string', example: 'Buenas tardes, necesito enviar un almuerzo de la Galería a Bellavista' },
                hora: { type: 'string', example: '14:30' },
              },
            },
          },
          cliente: {
            type: 'object',
            properties: {
              nombre: { type: 'string', example: 'Andrés Hurtado' },
              telefono: { type: 'string', example: '+573105559876' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/whatsapp': {
      get: {
        tags: ['WhatsApp & Meta'],
        summary: 'Verificación del Webhook de Meta',
        description: 'Endpoint de validación que Meta WhatsApp invoca al registrar el webhook con el challenge.',
        parameters: [
          {
            name: 'hub.mode',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'subscribe' },
          },
          {
            name: 'hub.verify_token',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'domix_meta_token_seguro' },
          },
          {
            name: 'hub.challenge',
            in: 'query',
            required: true,
            schema: { type: 'string', example: '1158201444' },
          },
        ],
        responses: {
          200: {
            description: 'Challenge aceptado y devuelto exitosamente',
            content: { 'text/plain': { schema: { type: 'string', example: '1158201444' } } },
          },
          403: {
            description: 'Token de verificación inválido',
          },
        },
      },
      post: {
        tags: ['WhatsApp & Meta'],
        summary: 'Recepción de mensajes entrantes de WhatsApp',
        description: 'Recibe eventos, mensajes de texto, estados de entrega y audios enviados por clientes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                example: {
                  object: 'whatsapp_business_account',
                  entry: [
                    {
                      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
                      changes: [
                        {
                          value: {
                            messaging_product: 'whatsapp',
                            metadata: { display_phone_number: '573150000000', phone_number_id: '1092837465' },
                            contacts: [{ profile: { name: 'Carlos' }, wa_id: '573001234567' }],
                            messages: [
                              {
                                from: '573001234567',
                                id: 'wamid.HBgLMTIzNDU2Nw==',
                                timestamp: '1728245000',
                                text: { body: 'Hola, ¿cuánto cuesta un envío a Juan XXIII?' },
                                type: 'text',
                              },
                            ],
                          },
                          field: 'messages',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Mensaje procesado correctamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },

    '/api/responder': {
      post: {
        tags: ['Operaciones e IA'],
        summary: 'Enviar mensaje de WhatsApp al cliente',
        description: 'Envía un mensaje de texto oficial al cliente a través de Meta WhatsApp Cloud API y lo guarda en el historial de chat.',
        security: [{ AdminTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResponderPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Mensaje enviado a través de Meta API',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message_id: { type: 'string', example: 'wamid.HBgLMTIzNDU2Nw==' },
                  },
                },
              },
            },
          },
          401: { description: 'No autorizado - Requiere x-domix-token de admin' },
        },
      },
    },

    '/api/leer-chat': {
      post: {
        tags: ['Operaciones e IA'],
        summary: 'Analizar conversación con Claude 3.5 Sonnet',
        description: 'Procesa el historial del chat con inteligencia artificial para extraer origen, destino, descripción de paquete y cotización sugerida.',
        security: [{ AdminTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LeerChatPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Estructura extraída por el motor de IA',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    intencion: { type: 'string', example: 'pedir' },
                    origen: { type: 'string', example: 'Galería Central' },
                    destino: { type: 'string', example: 'Barrio Bellavista' },
                    descripcion: { type: 'string', example: '1 almuerzo' },
                    tarifa_sugerida: { type: 'number', example: 8000 },
                    confianza: { type: 'number', example: 0.98 },
                  },
                },
              },
            },
          },
          401: { description: 'No autorizado' },
        },
      },
    },

    '/api/rpc/crear_solicitud': {
      post: {
        tags: ['Despacho & Pedidos (RPC)'],
        summary: 'Crear solicitud de pedido (RPC crear_solicitud)',
        description: 'Registra un nuevo pedido en el sistema, calcula cobertura por sede, genera el código de confirmación de 4 dígitos y emite evento en tiempo real.',
        security: [{ SupabaseAnonKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearSolicitudPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Pedido creado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pedido_id: { type: 'integer', example: 104 },
                    codigo_confirmacion: { type: 'string', example: '8241' },
                    estado: { type: 'string', example: 'pendiente' },
                    costo_envio: { type: 'number', example: 8000 },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/rpc/confirm_delivery': {
      post: {
        tags: ['Despacho & Pedidos (RPC)'],
        summary: 'Confirmar entrega de pedido (RPC confirm_delivery)',
        description: 'El repartidor o despachador valida el código de entrega de 4 dígitos. Actualiza el estado a "entregado" y liquida la carrera en el balance.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ConfirmDeliveryPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Entrega confirmada satisfactoriamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    mensaje: { type: 'string', example: 'Entrega confirmada exitosamente' },
                  },
                },
              },
            },
          },
          400: { description: 'Código inválido o pedido no asignado a este repartidor' },
        },
      },
    },

    '/api/rpc/tomar_pedido': {
      post: {
        tags: ['Despacho & Pedidos (RPC)'],
        summary: 'Asignar carrera a repartidor (RPC tomar_pedido)',
        description: 'Toma atómica de carrera. Evita condiciones de carrera entre múltiples repartidores asignándolo al primer solicitante.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TomarPedidoPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Resultado de la toma de pedido (true si fue exitoso, false si otro repartidor lo tomó primero)',
            content: {
              'application/json': {
                schema: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
    },

    '/api/rpc/saldo_repartidor': {
      post: {
        tags: ['Finanzas & Flota (RPC)'],
        summary: 'Calcular saldo y liquidación 80/20 (RPC saldo_repartidor)',
        description: 'Aplica el modelo financiero auditado de Domix: calcula ingresos brutos, comisión 80/20 de plataforma, retención de efectivo cobrado en mano y saldo neto a pagar o retener.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SaldoRepartidorPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Balance financiero detallado del repartidor',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_carreras: { type: 'integer', example: 12 },
                    ingresos_brutos: { type: 'number', example: 96000 },
                    comision_plataforma: { type: 'number', example: 3000, description: '30% correspondiente a Domix' },
                    ingresos_netos: { type: 'number', example: 7000, description: '70% correspondiente al repartidor' },
                    efectivo_cobrado: { type: 'number', example: 64000, description: 'Dinero en mano que el repartidor recaudó en efectivo' },
                    saldo_pendiente: { type: 'number', example: 12800, description: 'Diferencia a favor o en contra' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/rpc/actualizar_ubicacion_repartidor': {
      post: {
        tags: ['Finanzas & Flota (RPC)'],
        summary: 'Reportar telemetría GPS (RPC actualizar_ubicacion_repartidor)',
        description: 'Actualiza en tiempo real las coordenadas espaciales del repartidor en PostGIS y activa el rastreo en el mapa del despachador.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ActualizarUbicacionPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Coordenadas actualizadas',
            content: { 'application/json': { schema: { type: 'boolean', example: true } } },
          },
        },
      },
    },

    '/api/rpc/admin_asignar_clave': {
      post: {
        tags: ['Autenticación & Seguridad'],
        summary: 'Asignar contraseña bcrypt a repartidor (RPC admin_asignar_clave)',
        description: 'Permite al administrador o despachador registrar o renovar la contraseña encriptada de un repartidor en la base de datos.',
        security: [{ AdminTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminAsignarClavePayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Contraseña actualizada correctamente',
            content: { 'application/json': { schema: { type: 'boolean', example: true } } },
          },
          403: { description: 'Acceso denegado: solo administradores' },
        },
      },
    },

    '/api/data/pedidos': {
      get: {
        tags: ['Consultas de Datos'],
        summary: 'Listar pedidos del sistema',
        description: 'Obtiene las carreras activas o históricas con soporte de filtros por estado y paginación.',
        parameters: [
          {
            name: 'estado',
            in: 'query',
            schema: { type: 'string', enum: ['pendiente', 'asignado', 'en_camino', 'entregado', 'cancelado'], example: 'pendiente' },
            description: 'Filtrar por estado del pedido',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
            description: 'Número máximo de registros a retornar',
          },
        ],
        responses: {
          200: {
            description: 'Listado de pedidos',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },

    '/api/data/repartidores': {
      get: {
        tags: ['Consultas de Datos'],
        summary: 'Listar repartidores activos',
        description: 'Devuelve la flota de domiciliarios registrados, su estado de disponibilidad y última sede asociada.',
        responses: {
          200: {
            description: 'Listado de repartidores',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },

    '/api/data/branches': {
      get: {
        tags: ['Consultas de Datos'],
        summary: 'Sedes operativas y tarifas dinámicas',
        description: 'Consulta las sedes activas, perímetros geográficos y las reglas de recargo dinámico (nocturno, lluvia, alta demanda).',
        responses: {
          200: {
            description: 'Listado de sedes con tarifas',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },

    '/api/notificaciones/email': {
      post: {
        tags: ['Notificaciones & Emails (Resend)'],
        summary: 'Disparar correo de notificación (Resend API)',
        description: 'Envía correos electrónicos adaptables (diseño moderno responsive) para confirmación de pedido registrado (con PIN de entrega) o recibo de servicio finalizado.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipo', 'pedido'],
                properties: {
                  tipo: {
                    type: 'string',
                    enum: ['pedido_creado', 'pedido_entregado', 'personalizado'],
                    example: 'pedido_creado',
                    description: 'Tipo de secuencia a disparar',
                  },
                  destinatario: {
                    type: 'string',
                    format: 'email',
                    example: 'cliente@turafood.com',
                    description: 'Email del cliente (opcional, si se omite usa el del pedido o el buzón de operaciones)',
                  },
                  pedido: {
                    type: 'object',
                    example: {
                      id: 104,
                      cliente_nombre: 'María Camila Valencia',
                      origen_direccion: 'Cra 2 # 3-45 Centro',
                      destino_direccion: 'Calle 5 # 8-20 Bellavista',
                      codigo_entrega: '8241',
                      costo_envio: 8000,
                      metodo_pago: 'efectivo',
                      descripcion: 'Almuerzo ejecutivo sellado',
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Correo enviado a través de Resend API',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    tipo: { type: 'string', example: 'pedido_creado' },
                    email_id: { type: 'string', example: '01a11326-9ff0-7c51-91f3-79083907c390' },
                    destinatarios: { type: 'array', items: { type: 'string' }, example: ['domixmensajeriasas@gmail.com'] },
                    timestamp: { type: 'string', example: '2026-10-06T21:40:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
