# 🔍 Verificación de Base de Datos - Ambulancia

**Fecha:** 10 de Febrero, 2026

---

## 📋 QUERIES PARA EJECUTAR

Por favor ejecuta estas queries en tu base de datos PostgreSQL (Neon) y envíame los resultados:

### 1. Buscar el Usuario
```sql
SELECT id, email, role, is_active, created_at
FROM users 
WHERE email = 'ambulancia21@gmail.com';
```

**Resultado esperado:**
- Debe existir un usuario con ese email
- `role` debe ser `provider`
- `is_active` debe ser `true`

---

### 2. Buscar el Provider
```sql
-- Reemplaza 'USER_ID_AQUI' con el id del paso 1
SELECT 
  id, 
  user_id,
  commercial_name, 
  verification_status, 
  category_id,
  created_at
FROM providers 
WHERE user_id = 'USER_ID_AQUI';
```

**Resultado esperado:**
- Debe existir un provider asociado al usuario
- `commercial_name` debe ser "Ariel pila" o similar
- `verification_status` debe ser `APPROVED`
- `category_id` debe apuntar a la categoría "ambulance"

---

### 3. Buscar las Sucursales (Branches)
```sql
-- Reemplaza 'PROVIDER_ID_AQUI' con el id del paso 2
SELECT 
  id, 
  provider_id,
  name, 
  is_main, 
  is_active, 
  phone_contact,
  address_text,
  created_at
FROM provider_branches 
WHERE provider_id = 'PROVIDER_ID_AQUI';
```

**Resultado esperado:**
- Debe existir AL MENOS una sucursal
- `is_active` debe ser `true`
- `is_main` debe ser `true` en al menos una

---

### 4. Verificar la Categoría
```sql
SELECT id, name, slug
FROM service_categories
WHERE slug = 'ambulance';
```

**Resultado esperado:**
- Debe existir una categoría con slug `ambulance`

---

## 🔍 POSIBLES PROBLEMAS

### Problema 1: Provider No Existe
Si la query 2 no devuelve resultados, significa que el provider no se creó al registrar la ambulancia.

**Solución:** Crear el provider manualmente o re-registrar la ambulancia.

### Problema 2: Provider Existe pero No Tiene Branches
Si la query 3 no devuelve resultados, significa que no se crearon las sucursales.

**Solución:** Crear la sucursal manualmente.

### Problema 3: Branch Existe pero `is_active = false`
Si la query 3 devuelve resultados pero `is_active` es `false`, el endpoint no encontrará la sucursal.

**Solución:** Activar la sucursal:
```sql
UPDATE provider_branches 
SET is_active = true 
WHERE provider_id = 'PROVIDER_ID_AQUI';
```

### Problema 4: Verification Status No Es APPROVED
Si `verification_status` no es `APPROVED`, el login debería haber bloqueado el acceso.

**Solución:** Aprobar el provider:
```sql
UPDATE providers 
SET verification_status = 'APPROVED' 
WHERE id = 'PROVIDER_ID_AQUI';
```

---

## 📊 ENVÍAME LOS RESULTADOS

Por favor ejecuta las 4 queries y envíame:
1. Los resultados de cada query
2. Si alguna query no devuelve resultados, dime cuál

Con esa información podré decirte exactamente qué está fallando y cómo arreglarlo.

---

**Backend Team**  
**10 de Febrero, 2026**
