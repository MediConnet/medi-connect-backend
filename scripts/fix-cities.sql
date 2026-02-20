-- Script para corregir el error de "Queti" en la tabla cities
-- Fecha: 20 de febrero de 2026

-- 1. Verificar si existe "Queti"
SELECT * FROM cities WHERE name = 'Queti';

-- 2. Verificar si existe "Quito"
SELECT * FROM cities WHERE name = 'Quito';

-- 3. Si existe "Queti" y NO existe "Quito", actualizar:
UPDATE cities 
SET name = 'Quito', state = 'Pichincha' 
WHERE name = 'Queti';

-- 4. Si existe "Queti" Y existe "Quito", eliminar "Queti":
DELETE FROM cities WHERE name = 'Queti';

-- 5. Verificar que las ciudades principales existan
-- Si no existen, crearlas:

-- Quito
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Quito',
  'Pichincha',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Quito');

-- Guayaquil
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Guayaquil',
  'Guayas',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Guayaquil');

-- Cuenca
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Cuenca',
  'Azuay',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Cuenca');

-- 6. Agregar más ciudades principales de Ecuador (opcional)

-- Manta
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Manta',
  'Manabí',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Manta');

-- Machala
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Machala',
  'El Oro',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Machala');

-- Santo Domingo
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Santo Domingo',
  'Santo Domingo de los Tsáchilas',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Santo Domingo');

-- Ambato
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Ambato',
  'Tungurahua',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Ambato');

-- Riobamba
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Riobamba',
  'Chimborazo',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Riobamba');

-- Loja
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Loja',
  'Loja',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Loja');

-- Esmeraldas
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Esmeraldas',
  'Esmeraldas',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Esmeraldas');

-- Ibarra
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Ibarra',
  'Imbabura',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Ibarra');

-- Portoviejo
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Portoviejo',
  'Manabí',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Portoviejo');

-- Quevedo
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Quevedo',
  'Los Ríos',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Quevedo');

-- Latacunga
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Latacunga',
  'Cotopaxi',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Latacunga');

-- Salinas
INSERT INTO cities (id, name, state, country, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Salinas',
  'Santa Elena',
  'Ecuador',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Salinas');

-- 7. Verificar resultado final
SELECT name, state, country FROM cities ORDER BY name;

-- 8. Contar ciudades
SELECT COUNT(*) as total_ciudades FROM cities;
