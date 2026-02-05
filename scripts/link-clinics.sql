-- ============================================
-- Script para Vincular Clínicas con Usuarios
-- ============================================
-- Ejecuta este script en tu base de datos Neon
-- Password para todas las clínicas: Clinica123!
-- ============================================

-- 1. CLÍNICA CENTRAL
-- Crear usuario
INSERT INTO users (id, email, password_hash, role, is_active, created_at)
VALUES (
  '73c6d9bd-4e7e-4482-b7a0-111111111111',
  'clinicacentral@mediconnect.com',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'user',
  true,
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Vincular clínica con usuario
UPDATE clinics 
SET user_id = '73c6d9bd-4e7e-4482-b7a0-111111111111'
WHERE name = 'Clínica Central' AND user_id IS NULL;

-- ============================================

-- 2. KEVIN
-- Crear usuario
INSERT INTO users (id, email, password_hash, role, is_active, created_at)
VALUES (
  'a48f99ff-8aec-4be8-a0c0-222222222222',
  'kevin@mediconnect.com',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'user',
  true,
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Vincular clínica con usuario
UPDATE clinics 
SET user_id = 'a48f99ff-8aec-4be8-a0c0-222222222222'
WHERE name = 'kevin' AND user_id IS NULL;

-- ============================================

-- 3. PATITAS SANAS
-- Crear usuario
INSERT INTO users (id, email, password_hash, role, is_active, created_at)
VALUES (
  'c55c28f6-3421-432c-b1e0-333333333333',
  'patitassanas@mediconnect.com',
  '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'user',
  true,
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Vincular clínica con usuario
UPDATE clinics 
SET user_id = 'c55c28f6-3421-432c-b1e0-333333333333'
WHERE name = 'Patitas sanas' AND user_id IS NULL;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver clínicas vinculadas
SELECT 
  c.id as clinic_id,
  c.name as clinic_name,
  c.user_id,
  u.email as user_email,
  u.role as user_role,
  u.is_active as user_active
FROM clinics c
LEFT JOIN users u ON c.user_id = u.id
ORDER BY c.name;

-- ============================================
-- CREDENCIALES DE ACCESO
-- ============================================
-- Email: clinicacentral@mediconnect.com
-- Email: kevin@mediconnect.com
-- Email: patitassanas@mediconnect.com
-- Password (todas): Clinica123!
-- ============================================
