-- Script para verificar qué datos están relacionados con un usuario
-- Reemplaza 'USER_EMAIL' con el email del usuario que quieres verificar

-- 1. Buscar el usuario
SELECT id, email, role FROM users WHERE email = 'kevinfarmacia@gmail.com';

-- 2. Verificar datos relacionados (reemplaza USER_ID con el ID del paso 1)
-- Pacientes
SELECT COUNT(*) as patients_count FROM patients WHERE user_id = (SELECT id FROM users WHERE email = 'kevinfarmacia@gmail.com');

-- Proveedores
SELECT COUNT(*) as providers_count FROM providers WHERE user_id = (SELECT id FROM users WHERE email = 'kevinfarmacia@gmail.com');

-- Clínicas
SELECT COUNT(*) as clinics_count FROM clinics WHERE user_id = (SELECT id FROM users WHERE email = 'kevinfarmacia@gmail.com');

-- Sesiones
SELECT COUNT(*) as sessions_count FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'kevinfarmacia@gmail.com');

-- Password resets
SELECT COUNT(*) as password_resets_count FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = 'kevinfarmacia@gmail.com');

-- Verificar foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND rc.delete_rule != 'CASCADE'
ORDER BY tc.table_name;
