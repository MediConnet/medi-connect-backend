-- Verificar providers sin sucursales
-- Este script muestra providers que NO tienen sucursales

SELECT 
  p.id as provider_id,
  p.commercial_name,
  p.verification_status,
  u.email,
  COUNT(pb.id) as branch_count
FROM providers p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN provider_branches pb ON pb.provider_id = p.id
GROUP BY p.id, p.commercial_name, p.verification_status, u.email
HAVING COUNT(pb.id) = 0;

-- Ver todas las sucursales existentes
SELECT 
  pb.id,
  pb.provider_id,
  pb.phone_contact,
  pb.address_text,
  pb.city_id,
  c.name as city_name,
  p.commercial_name
FROM provider_branches pb
LEFT JOIN providers p ON pb.provider_id = p.id
LEFT JOIN cities c ON pb.city_id = c.id;
