# ⚠️ Problema: clinic_doctors Cambió su Estructura

**Fecha:** 20 de febrero de 2026  
**Estado:** REQUIERE ATENCIÓN

---

## 🔴 Problema Identificado

La tabla `clinic_doctors` cambió su estructura según lo que dijo tu jefe:

### ANTES (campos duplicados):
```typescript
{
  id, clinic_id, user_id,
  email,              // ❌ ELIMINADO
  name,               // ❌ ELIMINADO
  specialty,          // ❌ ELIMINADO
  phone,              // ❌ ELIMINADO
  whatsapp,           // ❌ ELIMINADO
  profile_image_url,  // ❌ ELIMINADO
  office_number,
  is_active,
  ...
}
```

### AHORA (sin duplicación):
```typescript
{
  id, clinic_id, user_id,
  office_number,
  is_active,
  is_invited,
  invitation_token,
  invitation_expires_at,
  created_at,
  updated_at,
  
  // Relaciones:
  users,    // Para obtener email, profile_picture_url
  clinics,  // Para obtener info de clínica
}
```

**La información ahora se obtiene de:**
- `email` → `clinic_doctors.users.email`
- `name` → `providers.commercial_name` (via user_id)
- `specialty` → `provider_specialties.specialties.name`
- `phone` → `provider_branches.phone_contact`
- `profile_image_url` → `users.profile_picture_url` o `providers.logo_url`

---

## 📁 Archivos Afectados (20+ errores)

### 1. src/clinics/appointments.controller.ts
**Errores:**
- Línea 157: Intenta seleccionar `name` de `clinic_doctors`
- Línea 198: Intenta acceder a `doctor.name`
- Línea 199: Intenta acceder a `doctor.specialty`
- Línea 445: Intenta seleccionar `name` de `clinic_doctors`
- Línea 462: Intenta acceder a `doctor.name`
- Línea 463: Intenta acceder a `doctor.specialty`

### 2. src/clinics/doctors.controller.ts
**Errores:**
- Línea 65: Intenta acceder a `doctor.email`
- Línea 66: Intenta acceder a `doctor.name`
- Línea 67: Intenta acceder a `doctor.specialty`
- Línea 71: Intenta acceder a `doctor.profile_image_url`
- Línea 72: Intenta acceder a `doctor.phone`
- Línea 73: Intenta acceder a `doctor.whatsapp`
- Línea 122: Intenta filtrar por `email`
- Línea 229: Intenta crear con `email`
- Línea 465: Intenta acceder a `doctor.email`
- Línea 541: Intenta acceder a `doctor.email`
- Línea 542: Intenta acceder a `doctor.name`
- Línea 543: Intenta acceder a `doctor.specialty`
- Línea 546: Intenta acceder a `doctor.profile_image_url`
- Línea 547: Intenta acceder a `doctor.phone`

---

## 🔧 Solución Necesaria

Necesitas actualizar TODOS los archivos que usan `clinic_doctors` para:

### 1. Incluir las relaciones necesarias

**ANTES:**
```typescript
const doctor = await prisma.clinic_doctors.findFirst({
  where: { id: doctorId }
});

// Acceso directo (YA NO FUNCIONA)
const email = doctor.email;
const name = doctor.name;
```

**AHORA:**
```typescript
const doctor = await prisma.clinic_doctors.findFirst({
  where: { id: doctorId },
  include: {
    users: {
      select: {
        email: true,
        profile_picture_url: true
      }
    }
  }
});

// Acceso via relación
const email = doctor.users?.email;
const profilePic = doctor.users?.profile_picture_url;
```

### 2. Para obtener nombre y especialidad del doctor

Necesitas hacer JOIN con `providers`:

```typescript
const doctor = await prisma.clinic_doctors.findFirst({
  where: { id: doctorId },
  include: {
    users: {
      select: {
        email: true,
        profile_picture_url: true,
        providers: {
          select: {
            commercial_name: true,
            provider_specialties: {
              include: {
                specialties: {
                  select: { name: true }
                }
              },
              take: 1
            },
            provider_branches: {
              where: { is_main: true },
              select: {
                phone_contact: true
              },
              take: 1
            }
          }
        }
      }
    }
  }
});

// Acceso a los datos
const email = doctor.users?.email;
const name = doctor.users?.providers[0]?.commercial_name;
const specialty = doctor.users?.providers[0]?.provider_specialties[0]?.specialties.name;
const phone = doctor.users?.providers[0]?.provider_branches[0]?.phone_contact;
```

---

## 📋 Lista de Tareas

### Archivos que DEBEN actualizarse:

- [ ] `src/clinics/appointments.controller.ts` - 6 errores
- [ ] `src/clinics/doctors.controller.ts` - 14+ errores
- [ ] Cualquier otro archivo que use `clinic_doctors`

### Patrón de actualización:

1. **Buscar todos los `findFirst`, `findMany`, `findUnique` de `clinic_doctors`**
2. **Agregar `include` con las relaciones necesarias**
3. **Actualizar el acceso a los campos** (de `doctor.name` a `doctor.users?.providers[0]?.commercial_name`)
4. **Actualizar los `create` y `update`** (no incluir campos que ya no existen)

---

## 🚨 Decisión Requerida

**Tienes 2 opciones:**

### Opción 1: Revertir el cambio de schema (MÁS RÁPIDO)
Volver a agregar los campos `email`, `name`, `specialty`, etc. a `clinic_doctors` para mantener compatibilidad.

**Pros:**
- ✅ Rápido (5 minutos)
- ✅ No rompe nada
- ✅ El servidor arranca inmediatamente

**Contras:**
- ❌ Duplicación de datos
- ❌ No sigue la recomendación de tu jefe

### Opción 2: Actualizar todos los archivos (MÁS CORRECTO)
Actualizar todos los archivos que usan `clinic_doctors` para usar las relaciones.

**Pros:**
- ✅ Sin duplicación de datos
- ✅ Sigue la recomendación de tu jefe
- ✅ Estructura más limpia

**Contras:**
- ❌ Toma tiempo (1-2 horas)
- ❌ Muchos archivos que actualizar
- ❌ Riesgo de romper algo

---

## 💡 Mi Recomendación

**Opción 1 por ahora**, luego migrar gradualmente:

1. **Ahora:** Revertir el schema para que el servidor funcione
2. **Después:** Actualizar archivo por archivo en commits separados
3. **Finalmente:** Eliminar los campos duplicados cuando todo esté actualizado

---

## 🔧 Solución Rápida (Opción 1)

Agregar estos campos de vuelta a `clinic_doctors` en el schema:

```prisma
model clinic_doctors {
  id                    String    @id @db.Uuid
  clinic_id             String?   @db.Uuid
  user_id               String?   @db.Uuid
  
  // Campos temporales (para compatibilidad)
  email                 String    @db.VarChar(255)
  name                  String?   @db.VarChar(255)
  specialty             String?   @db.VarChar(255)
  phone                 String?   @db.VarChar(20)
  whatsapp              String?   @db.VarChar(20)
  profile_image_url     String?   @db.VarChar(500)
  
  office_number         String?   @db.VarChar(50)
  is_active             Boolean?  @default(true)
  is_invited            Boolean?  @default(true)
  invitation_token      String?   @unique @db.VarChar(255)
  invitation_expires_at DateTime? @db.Timestamp(6)
  created_at            DateTime? @default(now()) @db.Timestamp(6)
  updated_at            DateTime? @default(now()) @db.Timestamp(6)
  
  // Relaciones
  clinics               clinics?  @relation(...)
  users                 users?    @relation(...)
  ...
}
```

Luego:
```bash
npx prisma generate
npm run dev
```

---

## ❓ ¿Qué Quieres Hacer?

1. **Solución rápida:** Revertir el schema (5 minutos)
2. **Solución correcta:** Actualizar todos los archivos (1-2 horas)
3. **Híbrido:** Solución rápida ahora, actualizar después

**Dime qué prefieres y lo implemento.**
