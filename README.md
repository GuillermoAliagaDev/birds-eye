# Birds Eye

GIS en tiempo real para seguimiento de ubicación multidispositivo.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 18 + Vite |
| Lenguaje | JavaScript (JSX) |
| Estilos | Tailwind CSS |
| Mapa | MapLibre GL JS + react-map-gl |
| Backend | Supabase (PostgreSQL + Realtime + REST) |
| Íconos | Lucide React |
| Fuente | Inter (Google Fonts) |

## Funcionalidades

- **Ubicación en tiempo real**: GPS compartido vía `watchPosition` con alta precisión
- **Mapa interactivo**: MapLibre con controles de navegación y tooltips
- **Rutas**: Creación, edición, eliminación de rutas con paradas; vista previa OSRM
- **Sidebar**: Dispositivos conectados (admin), rutas, ajustes de Supabase
- **Admin**: Panel para ver todos los dispositivos en el mapa con nombre y placa
- **Placa vehicular**: Input opcional con formato alfanumérico (ABC-123), visible solo para admin
- **Persistencia local**: Nombre, placa, ID de dispositivo y sesión admin guardados en localStorage
- **Supabase Realtime**: Suscripción a cambios en la tabla `locations` para actualización instantánea

## Cómo empezar

```bash
npm install
npm run dev
```

### Variables de entorno

Crea un archivo `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### Base de datos

Ejecuta `supabase-schema.sql` en el SQL Editor de tu proyecto Supabase para crear las tablas `locations` y `routes`, el índice único por `device_id`, las políticas RLS, y la ruta demo inicial.

## Despliegue

La app está configurada para Vercel (`vercel.json`). Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben configurarse en Vercel → Settings → Environment Variables.

## Estructura

```
src/
├── App.jsx                     # Estado global, auto-share, rutas, layout
├── main.jsx                    # Entry point
├── index.css                   # Tailwind + estilos base
├── lib/
│   └── supabase.js             # Cliente Supabase, helpers device ID/name/plate
└── components/
    ├── MapView.jsx             # Mapa, GPS, sharing loop, cleanup, markers
    ├── Sidebar.jsx             # Navegación: rutas, dispositivos, ajustes
    ├── QuickActionButton.jsx   # Botón flotante para centrar mapa
    └── MapErrorBoundary.jsx    # Error boundary del mapa
```

## Flujo de uso

1. El usuario abre la app e ingresa su nombre (y placa opcional)
2. Se solicita permiso de ubicación GPS
3. La app se conecta a Supabase (desde env vars o config manual)
4. La ubicación se envía cada 3 segundos a la tabla `locations`
5. Los demás dispositivos conectados con Supabase ven las ubicaciones en el mapa
6. Un admin puede ver todos los dispositivos y gestionar rutas
