-- Script para encontrar dónde están los datos de tipos de consulta de Kevin
-- Doctor ID: 76820234-174a-4fa0-9221-404dd93a7e77

-- 1. Verificar que el doctor existe
SELECT 
    p.id,
    p.commercial_name,
    p.verification_status,
    u.email
FROM providers p
JOIN users u ON p.user_id = u.id
WHERE p.id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 2. Buscar en tabla consultation_prices
SELECT 
    cp.id,
    cp.provider_id,
    cp.specialty_id,
    cp.consultation_type,
    cp.price,
    cp.is_active,
    s.name as specialty_name
FROM consultation_prices cp
LEFT JOIN specialties s ON cp.specialty_id = s.id
WHERE cp.provider_id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 3. Verificar especialidades del doctor
SELECT 
    ps.provider_id,
    ps.specialty_id,
    ps.fee,
    s.name as specialty_name
FROM provider_specialties ps
JOIN specialties s ON ps.specialty_id = s.id
WHERE ps.provider_id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 4. Buscar en TODAS las tablas que tengan "price" o "tarif"
-- (Ejecutar manualmente si es necesario)

-- 5. Verificar si hay datos en clinics.consultation_prices (JSON)
SELECT 
    c.id,
    c.name,
    c.consultation_prices
FROM clinics c
JOIN users u ON c.user_id = u.id
JOIN providers p ON p.user_id = u.id
WHERE p.id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 6. Buscar en provider_catalog (por si acaso)
SELECT 
    pc.id,
    pc.provider_id,
    pc.type,
    pc.name,
    pc.price,
    pc.is_available
FROM provider_catalog pc
WHERE pc.provider_id = '76820234-174a-4fa0-9221-404dd93a7e77';
