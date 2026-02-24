-- Script para encontrar EXACTAMENTE dónde están los datos de "Limpieza dental $34"
-- que se muestran en la web para el doctor Kevin

-- Doctor ID: 76820234-174a-4fa0-9221-404dd93a7e77

-- 1. Verificar tabla consultation_prices
SELECT 'consultation_prices' as tabla, COUNT(*) as registros
FROM consultation_prices
WHERE provider_id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 2. Ver datos completos en consultation_prices
SELECT 
    'consultation_prices' as fuente,
    cp.id,
    cp.consultation_type,
    cp.price,
    cp.is_active,
    s.name as specialty_name,
    cp.created_at
FROM consultation_prices cp
LEFT JOIN specialties s ON cp.specialty_id = s.id
WHERE cp.provider_id = '76820234-174a-4fa0-9221-404dd93a7e77'
ORDER BY cp.created_at DESC;

-- 3. Verificar si Kevin tiene clínica asociada
SELECT 
    'clinic_association' as info,
    cd.id as clinic_doctor_id,
    c.id as clinic_id,
    c.name as clinic_name,
    c.consultation_prices as clinic_json_prices
FROM users u
JOIN providers p ON p.user_id = u.id
LEFT JOIN clinic_doctors cd ON cd.user_id = u.id
LEFT JOIN clinics c ON c.id = cd.clinic_id
WHERE p.id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 4. Verificar provider_specialties (tarifas por especialidad)
SELECT 
    'provider_specialties' as fuente,
    ps.specialty_id,
    s.name as specialty_name,
    ps.fee as price
FROM provider_specialties ps
JOIN specialties s ON ps.specialty_id = s.id
WHERE ps.provider_id = '76820234-174a-4fa0-9221-404dd93a7e77';

-- 5. Buscar "Limpieza dental" en TODAS las tablas
-- consultation_prices
SELECT 'consultation_prices' as tabla, consultation_type, price, provider_id
FROM consultation_prices
WHERE consultation_type ILIKE '%limpieza%';

-- provider_catalog
SELECT 'provider_catalog' as tabla, name, price, provider_id
FROM provider_catalog
WHERE name ILIKE '%limpieza%';

-- 6. Verificar si hay datos con precio $34
SELECT 'consultation_prices_$34' as busqueda, *
FROM consultation_prices
WHERE price = 34.00;

SELECT 'provider_catalog_$34' as busqueda, *
FROM provider_catalog
WHERE price = 34.00;

SELECT 'provider_specialties_$34' as busqueda, ps.*, s.name
FROM provider_specialties ps
JOIN specialties s ON ps.specialty_id = s.id
WHERE ps.fee = 34.00;
