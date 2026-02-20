-- Agregar sucursal faltante para "farmacia fybeca"
-- IMPORTANTE: Reemplaza los valores con los datos reales del registro

-- Primero, verifica el provider_id
SELECT id, commercial_name, verification_status 
FROM providers 
WHERE commercial_name LIKE '%fybeca%';

-- Luego, inserta la sucursal (ajusta los valores según sea necesario)
INSERT INTO provider_branches (
  id,
  provider_id,
  city_id,
  name,
  address_text,
  phone_contact,
  email_contact,
  is_main,
  is_active
) VALUES (
  gen_random_uuid(),  -- Genera un UUID aleatorio
  '0d1f3ed9-f3b7-4686-ad6d-146d600f43d2',  -- ⚠️ REEMPLAZA con el provider_id real
  (SELECT id FROM cities WHERE name = 'Quito' LIMIT 1),  -- ⚠️ Ajusta la ciudad
  'farmacia fybeca',  -- Nombre de la sucursal
  'Dirección de ejemplo',  -- ⚠️ REEMPLAZA con la dirección real
  '0999999999',  -- ⚠️ REEMPLAZA con el teléfono real
  'kevincata2005@gmail.com',  -- Email
  true,  -- is_main
  true   -- is_active
);

-- Verificar que se creó
SELECT 
  pb.id,
  pb.provider_id,
  pb.phone_contact,
  pb.address_text,
  c.name as city_name,
  p.commercial_name
FROM provider_branches pb
LEFT JOIN providers p ON pb.provider_id = p.id
LEFT JOIN cities c ON pb.city_id = c.id
WHERE p.commercial_name LIKE '%fybeca%';
