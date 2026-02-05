# 🏥 Cómo Crear una Clínica en el Sistema

## 📊 Estructura Actual

Basándome en tu base de datos, veo que tienes **"Clínica Central"** en la tabla `providers`, pero para que aparezca en el panel de administración de usuarios, necesitas crear registros en las tablas correctas.

---

## 🔄 Diferencia Entre Provider y Clinic

### Provider (Tabla `providers`)
- Es un **proveedor de servicios** genérico
- Puede ser: médico, farmacia, laboratorio, ambulancia, suministros, **o clínica**
- Se usa para el catálogo público de servicios
- **NO aparece en "Administración de Usuarios"**

### Clinic (Tabla `clinics`)
- Es una **clínica con panel de administración**
- Tiene su propio usuario para login
- Puede gestionar médicos asociados
- Puede ver citas y pagos
- **SÍ aparece en "Administración de Usuarios"**

---

## ✅ Cómo Crear una Clínica Correctamente

### Opción 1: Desde el Frontend (Registro)

El usuario se registra como clínica y el sistema crea automáticamente:

1. **Registro en `users`**:
```sql
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  'clinica@ejemplo.com',
  '$2b$10$...', -- Hash de la contraseña
  'user', -- Las clínicas tienen role 'user'
  true,
  NOW()
);
```

2. **Registro en `clinics`**:
```sql
INSERT INTO clinics (
  id,
  user_id, -- ID del usuario creado arriba
  name,
  address,
  phone,
  whatsapp,
  description,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  'user-id-aqui',
  'Clínica Central',
  'Av. Principal 123',
  '0999999999',
  '0999999999',
  'Clínica médica con múltiples especialidades',
  true,
  NOW()
);
```

---

### Opción 2: Migrar "Clínica Central" de Providers a Clinics

Si quieres que "Clínica Central" (que ya existe en `providers`) aparezca en el panel de usuarios, necesitas:

#### Paso 1: Crear un usuario para la clínica

```sql
-- 1. Crear usuario
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  'clinicacentral@mediconnect.com',
  '$2b$10$YourHashedPasswordHere', -- Usa bcrypt para hashear
  'user',
  true,
  NOW()
);

-- 2. Guardar el ID del usuario creado
-- Supongamos que el ID es: 'abc-123-def-456'
```

#### Paso 2: Crear el registro en clinics

```sql
INSERT INTO clinics (
  id,
  user_id,
  name,
  address,
  phone,
  whatsapp,
  description,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  'abc-123-def-456', -- ID del usuario del paso 1
  'Clínica Central',
  'Dirección de la clínica',
  '0999999999',
  '0999999999',
  'Clínica médica con múltiples especialidades',
  true,
  NOW()
);
```

---

## 🧪 Script de Prueba

He creado un script TypeScript para crear una clínica de prueba:

```typescript
// test/create-clinic.ts
import { getPrismaClient } from '../src/shared/prisma';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function createClinic() {
  const prisma = getPrismaClient();
  
  // 1. Crear usuario
  const userId = randomUUID();
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.users.create({
    data: {
      id: userId,
      email: 'clinicacentral@mediconnect.com',
      password_hash: hashedPassword,
      role: 'user',
      is_active: true,
    },
  });
  
  console.log('✅ Usuario creado:', user.email);
  
  // 2. Crear clínica
  const clinic = await prisma.clinics.create({
    data: {
      id: randomUUID(),
      user_id: userId,
      name: 'Clínica Central',
      address: 'Av. Principal 123, Quito',
      phone: '0999999999',
      whatsapp: '0999999999',
      description: 'Clínica médica con múltiples especialidades',
      is_active: true,
    },
  });
  
  console.log('✅ Clínica creada:', clinic.name);
  console.log('📧 Email:', user.email);
  console.log('🔑 Password: password123');
}

createClinic()
  .then(() => console.log('✅ Clínica creada exitosamente'))
  .catch(error => console.error('❌ Error:', error));
```

---

## 🔍 Verificar Clínicas Existentes

### Query SQL para ver clínicas:

```sql
SELECT 
  c.id,
  c.name,
  c.phone,
  c.address,
  u.email,
  u.role,
  u.is_active
FROM clinics c
LEFT JOIN users u ON c.user_id = u.id;
```

### Query SQL para ver providers que son clínicas:

```sql
SELECT 
  p.id,
  p.commercial_name,
  p.description,
  sc.name as service_type,
  u.email
FROM providers p
LEFT JOIN service_categories sc ON p.category_id = sc.id
LEFT JOIN users u ON p.user_id = u.id
WHERE sc.slug = 'clinic' OR p.commercial_name LIKE '%Clínica%';
```

---

## 📋 Resumen

Para que una clínica aparezca en **"Administración de Usuarios"**:

1. ✅ Debe tener un registro en la tabla `users` con `role = 'user'`
2. ✅ Debe tener un registro en la tabla `clinics` vinculado al usuario
3. ✅ El endpoint GET `/api/admin/users` la detectará automáticamente

**Actualmente:**
- "Clínica Central" está en `providers` → Aparece en el catálogo público
- "Clínica Central" NO está en `clinics` → NO aparece en administración de usuarios

**Solución:**
- Crear un usuario y registro en `clinics` para "Clínica Central"
- O registrar una nueva clínica desde el frontend

---

## 🚀 Próximos Pasos

1. Decide si quieres:
   - **Opción A**: Crear una nueva clínica desde cero
   - **Opción B**: Migrar "Clínica Central" de providers a clinics

2. Si eliges Opción A:
   - Usa el formulario de registro del frontend
   - O ejecuta el script de creación

3. Si eliges Opción B:
   - Ejecuta las queries SQL del Paso 1 y 2
   - Verifica con GET `/api/admin/users`

---

¿Quieres que te ayude a crear el script para migrar "Clínica Central" o prefieres crear una nueva clínica de prueba?
