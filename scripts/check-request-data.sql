-- Verificar datos de la solicitud "Medico kevin"
-- Este script muestra todos los datos del provider y su sucursal

SELECT 
  p.id as provider_id,
  p.commercial_name,
  p.verification_status,
  u.email,
  pb.id as branch_id,
  pb.phone_contact,
  pb.address_text,
  pb.city_id,
  c.name as city_name
FROM providers p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN provider_branches pb ON pb.provider_id = p.id
LEFT JOIN cities c ON pb.city_id = c.id
WHERE p.commercial_name LIKE '%kevin%'
  OR u.email LIKE '%kevin%';
