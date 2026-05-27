-- Esquema SQL para el Sistema de Asistencia - Primer Encuentro de Condominios

-- 1. Tabla de Tipos de Servicios
CREATE TABLE IF NOT EXISTS servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Mesas de Trabajo
CREATE TABLE IF NOT EXISTS mesas_trabajo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INTEGER UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Relación Muchos a Muchos: mesas_trabajo <-> servicios
CREATE TABLE IF NOT EXISTS mesa_servicio (
    mesa_id UUID REFERENCES mesas_trabajo(id) ON DELETE CASCADE,
    servicio_id UUID REFERENCES servicios(id) ON DELETE CASCADE,
    PRIMARY KEY (mesa_id, servicio_id)
);

-- 4. Tabla de Asistentes (Invitados y Registro de Asistencia)
CREATE TABLE IF NOT EXISTS asistentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    telefono TEXT NOT NULL,
    condominio TEXT NOT NULL,
    estado TEXT,
    municipio TEXT NOT NULL,
    parroquia TEXT,
    mesa_preasignada_id UUID REFERENCES mesas_trabajo(id) ON DELETE SET NULL, -- Deprecado a favor de asistente_mesa, pero mantenido para compatibilidad
    asistio BOOLEAN DEFAULT FALSE NOT NULL,
    fecha_registro TIMESTAMPTZ,
    whatsapp_status TEXT DEFAULT 'no_enviado', -- 'no_enviado', 'enviado', 'error'
    whatsapp_error TEXT,
    es_acompanante BOOLEAN DEFAULT FALSE,
    invitado_por_id UUID REFERENCES asistentes(id) ON DELETE CASCADE,
    es_directivo BOOLEAN DEFAULT FALSE,
    cargo_directivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4b. Relación Muchos a Muchos: asistentes <-> mesas_trabajo
CREATE TABLE IF NOT EXISTS asistente_mesa (
    asistente_id UUID REFERENCES asistentes(id) ON DELETE CASCADE,
    mesa_id UUID REFERENCES mesas_trabajo(id) ON DELETE CASCADE,
    PRIMARY KEY (asistente_id, mesa_id)
);

-- Habilitar Row Level Security (RLS) si es necesario, o deshabilitar para simplificar el acceso local directo
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistente_mesa ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso libre para lectura y escritura (simplificado para el encuentro)
CREATE POLICY "Permitir todo a servicios" ON servicios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a mesas_trabajo" ON mesas_trabajo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a mesa_servicio" ON mesa_servicio FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a asistentes" ON asistentes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a asistente_mesa" ON asistente_mesa FOR ALL USING (true) WITH CHECK (true);

-- Insertar Datos Semilla de Prueba

-- Servicios iniciales
INSERT INTO servicios (nombre, descripcion) VALUES
('manto', 'Mantenimiento preventivo e impermeabilización de estructuras'),
('ascensores', 'Mantenimiento y reparación de ascensores'),
('agua y plomería', 'Sistemas de bombas, tuberías y distribución hídrica'),
('asfalto', 'Asfaltado y bacheo de vías internas del condominio'),
('poda', 'Control de áreas verdes y poda de árboles'),
('iluminación', 'Instalación y mantenimiento de luminarias de postes y pasillos')
ON CONFLICT (nombre) DO NOTHING;

-- Mesas de trabajo iniciales
INSERT INTO mesas_trabajo (numero, nombre) VALUES
(1, 'Mesa 1: Impermeabilización'),
(2, 'Mesa 2: Ascensores'),
(3, 'Mesa 3: Hídrica'),
(4, 'Mesa 4: Asfalto'),
(5, 'Mesa 5: Poda y tala'),
(6, 'Mesa 6: Luminarias')
ON CONFLICT (numero) DO NOTHING;

-- 5. Tabla de Casos de Infraestructura
CREATE TABLE IF NOT EXISTS casos_infraestructura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio TEXT NOT NULL,
    municipio TEXT NOT NULL,
    parroquia TEXT,
    problematica TEXT NOT NULL,
    prioridad TEXT DEFAULT 'Media', -- 'Baja', 'Media', 'Alta'
    estado TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'En progreso', 'Resuelto'
    fecha_reporte DATE DEFAULT CURRENT_DATE,
    notas_resolucion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE casos_infraestructura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a casos_infraestructura" ON casos_infraestructura FOR ALL USING (true) WITH CHECK (true);

-- Insertar Casos Semilla de Prueba
INSERT INTO casos_infraestructura (condominio, municipio, parroquia, problematica, prioridad, estado, fecha_reporte) VALUES
('URBANIZACION EL LAGO 1 EDIFICIO 6', 'Girardot', 'José Casanova Godoy', '- Reemplazo de canales de lluvia\n- Pintura de fachada y estructura interna (rejas)\n- Reemplazo techo\n- Luminaria y poda de árboles.', 'Media', 'Pendiente', '2026-03-23'),
('LA MONTAÑA EDIFICIO', 'Santiago Mariño', 'Turmero', 'Filtración en los tanques de agua subterráneos.', 'Alta', 'Pendiente', '2026-03-25'),
('Edificio Cunasinhe', 'Girardot', 'Madre María de San José', 'Las principales problemáticas son:\nimpermeabilización, pintura del edificio, filtraciones...', 'Media', 'Pendiente', '2026-03-26'),
('Residencias Nuevo Bosque alto', 'Girardot', 'Madre María de San José', 'Necesitamos el asfaltado de las calles.', 'Media', 'Pendiente', '2026-03-27'),
('RESIDENCIAS EDIFICIO CARABOBO', 'Girardot', 'Andrés Eloy Blanco', 'Impermeabilización, Ascensor fuera de servicio, paredes con grietas, fisuras, moho, hongos, etc.', 'Alta', 'Pendiente', '2026-03-27'),
('RESIDENCIAS COSTA DEL SOL', 'Santiago Mariño', 'Turmero', 'Los ascensores, fachadas e impermeabilizar los azoteas.', 'Alta', 'Pendiente', '2026-03-28'),
('URBANIZACION EL TREBOL EDIFICIO 10', 'Girardot', 'Joaquín Crespo', 'Caída de pared perimetral salida a la Av. Aragua, pintura a la fachada exterior.', 'Media', 'Pendiente', '2026-03-28'),
('CONJUNTO RESIDENCIAL VALLE LINDO', 'Santiago Mariño', 'Pedro Arévalo Aponte', 'Exteriores del bloque en ruinas, fachada, escaleras, pasamanos oxidados, techos de las torres A, B y C.', 'Alta', 'Pendiente', '2026-03-28')
ON CONFLICT DO NOTHING;


