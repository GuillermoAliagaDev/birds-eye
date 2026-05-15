-- Crear tabla de ubicaciones en tiempo real
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT DEFAULT '',
  plate TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único por device_id para upsert
CREATE UNIQUE INDEX idx_locations_device_id ON locations (device_id);

-- Crear tabla de rutas
CREATE TABLE routes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT DEFAULT 'Ruta principal',
  stops JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar ruta demo inicial
INSERT INTO routes (name, stops) VALUES ('Ruta principal', '[
  {"name":"Partida: Av. 28 de Julio 1014","lng":-77.0315,"lat":-12.1202},
  {"name":"Av. Jos\u00e9 Larco","lng":-77.0299,"lat":-12.1178},
  {"name":"Av. Arequipa","lng":-77.0298,"lat":-12.1120},
  {"name":"Av. Arequipa (keep left)","lng":-77.0320,"lat":-12.1070},
  {"name":"Av. Arequipa \u2192 Jir\u00f3n Torre Ugarte","lng":-77.0310,"lat":-12.1015},
  {"name":"Av. C\u00e9sar Vallejo","lng":-77.0330,"lat":-12.0985},
  {"name":"Av. Jorge Basadre","lng":-77.0300,"lat":-12.0955},
  {"name":"Av. Camino Real","lng":-77.0265,"lat":-12.0955},
  {"name":"Av. Los Conquistadores","lng":-77.0240,"lat":-12.0990},
  {"name":"C. La Rep\u00fablica","lng":-77.0250,"lat":-12.1040},
  {"name":"Av. Angamos Oeste","lng":-77.0260,"lat":-12.1055},
  {"name":"Av. Angamos Este","lng":-77.0300,"lat":-12.1045},
  {"name":"Av. Petit Thouars (N)","lng":-77.0335,"lat":-12.1010},
  {"name":"Av. Javier Prado Este","lng":-77.0355,"lat":-12.0985},
  {"name":"Av. Ricardo Rivera","lng":-77.0325,"lat":-12.0950},
  {"name":"Av. Rep\u00fablica de Colombia","lng":-77.0295,"lat":-12.0935},
  {"name":"Av. Paseo de la Rep\u00fablica","lng":-77.0340,"lat":-12.0980},
  {"name":"V\u00eda Expresa (S)","lng":-77.0365,"lat":-12.1050},
  {"name":"Exit Benavides","lng":-77.0365,"lat":-12.1095},
  {"name":"Av. Alfredo Benavides","lng":-77.0345,"lat":-12.1160},
  {"name":"Ca. San Mart\u00edn","lng":-77.0320,"lat":-12.1185},
  {"name":"Av. Armend\u00e1riz","lng":-77.0295,"lat":-12.1200},
  {"name":"Av. Jos\u00e9 Larco (return)","lng":-77.0285,"lat":-12.1185},
  {"name":"Av. Reducto","lng":-77.0310,"lat":-12.1190},
  {"name":"Av. 28 de Julio 1014 \u2014 Llegada","lng":-77.0305,"lat":-12.1195}
]'::jsonb);

-- Habilitar Realtime para la tabla locations
ALTER PUBLICATION supabase_realtime ADD TABLE locations;

-- Permitir lectura/anónima (RLS básico)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert" ON locations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update" ON locations FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous select" ON locations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous delete" ON locations FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anonymous select routes" ON routes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert routes" ON routes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update routes" ON routes FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous delete routes" ON routes FOR DELETE TO anon USING (true);
