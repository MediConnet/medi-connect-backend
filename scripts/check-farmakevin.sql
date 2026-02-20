-- Verificar datos de "Farmakevin"

-- 1. Ver el provider
SELECT 
  p.id,
  p.commercial_name,
  p.verification_status,
  p.description,
  u.email
FROM providers p
LEFT JOIN users u ON p.user_id = u.id
WHERE p.commercial_name LIKE '%Farmakevin%'
  OR p.commercial_name LIKE '%farmakevin%';

-- 2. Ver si tiene sucursales
SELECT 
  pb.id as branch_id,
  pb.provider_id,
  pb.name as branch_name,
  pb.phone_contact,
  pb.address_text,
  pb.city_id,
  c.name as city_name,
  pb.is_main,
  pb.is_active
FROM provider_branches pb
LEFT JOIN cities c ON pb.city_id = c.id
WHERE pb.provider_id IN (
  SELECT id FROM providers 
  WHERE commercial_name LIKE '%Farmakevin%'
    OR commercial_name LIKE '%farmakevin%'
);

-- 3. Contar sucursales por provider
SELECT 
  p.id,
  p.commercial_name,
  COUNT(pb.id) as branch_count
FROM providers p
LEFT JOIN provider_branches pb ON pb.provider_id = p.id
WHERE p.commercial_name LIKE '%Farmakevin%'
  OR p.commercial_name LIKE '%farmakevin%'
GROUP BY p.id, p.commercial_name;
