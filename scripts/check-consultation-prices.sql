-- Script para verificar tipos de consulta en la base de datos
-- Uso: Ejecutar en tu cliente PostgreSQL

-- 1. Ver todos los tipos de consulta de un médico específico
-- (Reemplaza 'email@ejemplo.com' con el email del médico)
SELECT 
    cp.id,
    cp.consultation_type,
    cp.price,
    cp.is_active,
    cp.created_at,
    cp.updated_at,
    p.commercial_name as doctor_name,
    u.email as doctor_email,
    s.name as specialty_name
FROM consultation_prices cp
JOIN providers p ON cp.provider_id = p.id
JOIN users u ON p.user_id = u.id
LEFT JOIN specialties s ON cp.specialty_id = s.id
WHERE u.email = 'email@ejemplo.com'
ORDER BY cp.created_at DESC;

-- 2. Contar tipos de consulta por médico
SELECT 
    u.email,
    p.commercial_name,
    COUNT(cp.id) as total_tipos_consulta,
    COUNT(CASE WHEN cp.is_active = true THEN 1 END) as activos,
    COUNT(CASE WHEN cp.is_active = false THEN 1 END) as inactivos
FROM providers p
JOIN users u ON p.user_id = u.id
LEFT JOIN consultation_prices cp ON cp.provider_id = p.id
WHERE p.service_categories_id = (SELECT id FROM service_categories WHERE slug = 'doctor')
GROUP BY u.email, p.commercial_name
ORDER BY total_tipos_consulta DESC;

-- 3. Ver tipos de consulta eliminados recientemente (últimas 24 horas)
-- Nota: Si usas HARD DELETE, esta query no mostrará nada porque los registros se eliminan físicamente
SELECT 
    cp.id,
    cp.consultation_type,
    cp.price,
    cp.updated_at as deleted_at,
    p.commercial_name as doctor_name,
    u.email as doctor_email
FROM consultation_prices cp
JOIN providers p ON cp.provider_id = p.id
JOIN users u ON p.user_id = u.id
WHERE cp.is_active = false
  AND cp.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY cp.updated_at DESC;

-- 4. Verificar si un ID específico existe
-- (Reemplaza 'uuid-aqui' con el ID que quieres verificar)
SELECT 
    cp.*,
    p.commercial_name,
    u.email
FROM consultation_prices cp
JOIN providers p ON cp.provider_id = p.id
JOIN users u ON p.user_id = u.id
WHERE cp.id = 'uuid-aqui';

-- 5. Ver todos los tipos de consulta (incluyendo inactivos)
SELECT 
    cp.id,
    cp.consultation_type,
    cp.price,
    cp.is_active,
    cp.description,
    cp.duration_minutes,
    p.commercial_name as doctor_name,
    u.email as doctor_email,
    s.name as specialty_name,
    cp.created_at,
    cp.updated_at
FROM consultation_prices cp
JOIN providers p ON cp.provider_id = p.id
JOIN users u ON p.user_id = u.id
LEFT JOIN specialties s ON cp.specialty_id = s.id
ORDER BY cp.created_at DESC
LIMIT 50;

-- 6. Estadísticas generales
SELECT 
    COUNT(*) as total_registros,
    COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos,
    AVG(price) as precio_promedio,
    MIN(price) as precio_minimo,
    MAX(price) as precio_maximo
FROM consultation_prices;
