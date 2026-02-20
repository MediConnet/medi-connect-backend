-- Script para revisar el estado actual de la base de datos

-- 1. Contar doctores (providers con category_id de doctor)
SELECT 
  'Total Doctores' as descripcion,
  COUNT(*) as cantidad
FROM providers p
JOIN service_categories sc ON p.category_id = sc.id
WHERE sc.slug = 'doctor';

-- 2. Verificar registros en provider_specialties
SELECT 
  'Registros en provider_specialties' as descripcion,
  COUNT(*) as cantidad
FROM provider_specialties;

-- 3. Ver primeros 5 registros de provider_specialties con detalles
SELECT 
  p.commercial_name as doctor,
  s.name as especialidad,
  ps.fee as tarifa,
  ps.created_at
FROM provider_specialties ps
JOIN providers p ON ps.provider_id = p.id
JOIN specialties s ON ps.specialty_id = s.id
LIMIT 5;

-- 4. Contar especialidades disponibles
SELECT 
  'Total Especialidades' as descripcion,
  COUNT(*) as cantidad
FROM specialties;

-- 5. Ver especialidades con cantidad de doctores
SELECT 
  s.name as especialidad,
  COUNT(ps.provider_id) as cantidad_doctores
FROM specialties s
LEFT JOIN provider_specialties ps ON s.id = ps.specialty_id
GROUP BY s.id, s.name
ORDER BY cantidad_doctores DESC, s.name
LIMIT 10;

-- 6. Ver primeros 5 doctores con sus datos
SELECT 
  p.id,
  p.commercial_name as nombre_doctor,
  u.email,
  pb.name as nombre_sucursal,
  (SELECT COUNT(*) FROM provider_specialties WHERE provider_id = p.id) as num_especialidades
FROM providers p
JOIN service_categories sc ON p.category_id = sc.id
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN provider_branches pb ON pb.provider_id = p.id AND pb.is_main = true
WHERE sc.slug = 'doctor'
LIMIT 5;

-- 7. Verificar clinic_doctors
SELECT 
  'Doctores en clínicas' as descripcion,
  COUNT(*) as cantidad
FROM clinic_doctors;

-- 8. Ver estructura de clinic_doctors (primeros 3)
SELECT 
  cd.id,
  cd.name as nombre_en_tabla,
  cd.email,
  cd.specialty as especialidad_en_tabla,
  cd.user_id,
  u.email as email_usuario,
  c.name as clinica
FROM clinic_doctors cd
LEFT JOIN users u ON cd.user_id = u.id
LEFT JOIN clinics c ON cd.clinic_id = c.id
LIMIT 3;
