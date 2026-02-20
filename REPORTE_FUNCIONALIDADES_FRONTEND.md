# 📋 Reporte de Funcionalidades Frontend - DOCALINK

**Fecha:** 20 de febrero de 2026  
**Para:** Equipo Backend  
**De:** Equipo Frontend

---

## 1. ✅ Bloquear Horarios (Médicos Independientes)

### Estado: IMPLEMENTADO

**Interfaz disponible:** SÍ  
**Endpoint que intenta llamar:** `POST /api/doctors/clinic/date-blocks/request`

### Detalles de Implementación:

**Componente:** `DateBlockRequest.tsx`  
**Hook:** `useDateBlockRequests.ts`  
**Ubicación:** `src/features/doctor-panel/presentation/`

### Funcionalidad:
- Los médicos asociados a clínicas pueden solicitar bloqueos de fechas
- Formulario con validación completa (fecha inicio, fecha fin, motivo)
- Sistema de estados: `pending`, `approved`, `rejected`
- Tabla que muestra todas las solicitudes con su estado
- Validación: fecha fin debe ser posterior a fecha inicio
- Motivo: mínimo 10 caracteres, máximo 200

### Endpoints que usa:
```typescript
// Obtener solicitudes
GET /api/doctors/clinic/date-blocks
Authorization: Bearer {token}

// Crear nueva solicitud
POST /api/doctors/clinic/date-blocks/request
Authorization: Bearer {token}
Body: {
  startDate: "2026-03-15",
  endDate: "2026-03-20",
  reason: "Vacaciones programadas"
}
```

### Respuesta esperada:
```typescript
{
  id: string;
  doctorId: string;
  clinicId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}
```

### Fallback:
- Si el endpoint falla, usa mocks locales (localStorage)
- Permite testing sin backend

### ⚠️ NOTA IMPORTANTE:
Esta funcionalidad es SOLO para médicos asociados a clínicas. Los médicos independientes NO tienen esta opción porque manejan su propio horario directamente.

---

## 2. ⚠️ Selector de Horarios - PROBLEMA IDENTIFICADO

### Estado: NECESITA CORRECCIÓN

**Problema:** Los selectores de tiempo permiten elegir CUALQUIER minuto (00-59)  
**Requerimiento:** Solo permitir intervalos de 30 minutos (:00 y :30)

### Archivos afectados:
```
src/features/doctor-panel/presentation/components/ProfileSection.tsx
src/features/clinic-panel/presentation/components/SchedulesSection.tsx
src/features/pharmacy-panel/presentation/components/EditScheduleModal.tsx
src/features/laboratory-panel/presentation/components/EditScheduleModal.tsx
src/features/ambulance-panel/presentation/components/EditProfileModal.tsx
src/features/supplies-panel/presentation/components/EditScheduleModal.tsx
```

### Implementación actual:
```tsx
<input
  type="time"
  value={schedule.startTime}
  onChange={(e) => handleScheduleChange(day, "startTime", e.target.value)}
  className="..."
/>
```

### ❌ Problema:
El input HTML5 `type="time"` permite seleccionar cualquier minuto (ej: 09:15, 14:47, etc.)

### ✅ Solución requerida:
Agregar atributo `step="1800"` (1800 segundos = 30 minutos):

```tsx
<input
  type="time"
  step="1800"  // ← AGREGAR ESTO
  value={schedule.startTime}
  onChange={(e) => handleScheduleChange(day, "startTime", e.target.value)}
  className="..."
/>
```

### Validación adicional recomendada:
```typescript
const validateTimeInterval = (time: string): boolean => {
  const minutes = parseInt(time.split(':')[1]);
  return minutes === 0 || minutes === 30;
};
```

### 🔧 Acción requerida del Frontend:
- Agregar `step="1800"` a TODOS los inputs de tipo `time`
- Agregar validación en el onChange para rechazar valores inválidos
- Mostrar mensaje de error si el usuario intenta ingresar un valor no permitido

---

## 3. ⚠️ Anuncios Vencidos - PROBLEMA IDENTIFICADO

### Estado: FILTRADO INCOMPLETO

**Problema:** Los anuncios se verifican en el frontend pero pueden seguir apareciendo después de su fecha final

### Implementación actual:

**Archivo:** `src/features/doctor-panel/presentation/components/AdsSection.tsx`

```typescript
// Verificación de expiración automática
useEffect(() => {
  if (!activeAd || !activeAd.endDate) return;

  const checkExpiration = () => {
    const now = new Date().getTime();
    const endDate = new Date(activeAd.endDate!).getTime();
    if (endDate < now) refetch(); // ← Refresca datos
  };

  const interval = setInterval(checkExpiration, 60000); // Cada 60 segundos
  checkExpiration();
  return () => clearInterval(interval);
}, [activeAd?.endDate, refetch]);
```

### ✅ Lo que hace bien:
- Verifica cada 60 segundos si el anuncio expiró
- Refresca los datos cuando detecta expiración

### ❌ Problema:
- El filtrado depende de que el BACKEND devuelva solo anuncios activos
- Si el backend no filtra por fecha, el anuncio seguirá apareciendo

### 🔧 Acción requerida del Backend:

**Endpoint:** `GET /api/ads` (o el que use cada panel)

**Filtrado necesario:**
```sql
WHERE 
  status = 'ACTIVE'
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  AND start_date <= CURRENT_DATE
```

**Respuesta esperada:**
```typescript
{
  id: string;
  label: string;
  discount: string;
  description: string;
  buttonText: string;
  imageUrl?: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  // ... otros campos
}
```

### Componente de visualización:

**Archivo:** `src/shared/components/PromotionalBanner.tsx`

```typescript
// Calcula tiempo restante y muestra contador regresivo
useEffect(() => {
  if (!endDate) return;

  const updateTimer = () => {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const difference = end - now;

    if (difference <= 0) {
      setIsExpired(true);
      return;
    }

    setIsExpired(false);
    // Calcula días, horas, minutos restantes
  };

  const interval = setInterval(updateTimer, 1000);
  updateTimer();
  return () => clearInterval(interval);
}, [endDate]);
```

### ✅ Recomendación:
El backend debe ser la fuente de verdad. El frontend solo debe mostrar lo que el backend envía.

---

## 4. ⚠️ Campos de Ambulancias - PARCIALMENTE IMPLEMENTADO

### Estado: IMPLEMENTADO EN PERFIL, FALTA EN REGISTRO

### ✅ Campos implementados en el PERFIL:

**Archivo:** `src/features/ambulance-panel/presentation/components/EditProfileModal.tsx`

#### Campos disponibles:
1. ✅ **Tipo de ambulancia** (`ambulanceType`)
   - Opciones: `basic`, `advanced`, `mobile-icu`
   - Select con 3 opciones: Básica, Avanzada, UCI Móvil

2. ✅ **Zona de cobertura** (`coverageZone`)
   - TextField de texto libre
   - Placeholder: "Ej: Quito y alrededores"

3. ✅ **Disponibilidad 24/7** (`availability`)
   - Select con 2 opciones: `24/7` o `scheduled`
   - Si es `scheduled`, muestra campos de hora inicio/fin

4. ✅ **Horario de operación** (`operatingHours`)
   - `startTime`: input type="time"
   - `endTime`: input type="time"
   - Solo visible si `availability === "scheduled"`

5. ✅ **Traslados interprovinciales** (`interprovincialTransfers`)
   - Switch (boolean)
   - Label: "Ofrecer traslados interprovinciales"

### Entidad completa:

**Archivo:** `src/features/ambulance-panel/domain/ambulance-profile.entity.ts`

```typescript
export interface AmbulanceProfile {
  id: string;
  bannerUrl: string;
  commercialName: string;
  shortDescription: string;
  address: string;
  whatsappContact: string;
  emergencyPhone: string;
  arrivalField?: number; // Tiempo de llegada en minutos
  
  // ✅ Campos solicitados
  ambulanceType?: "basic" | "advanced" | "mobile-icu";
  coverageZone?: string;
  availability?: "24/7" | "scheduled";
  operatingHours?: {
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  };
  interprovincialTransfers?: boolean;
  
  isActive?: boolean;
  stats: {
    profileViews: number;
    contactClicks: number;
    averageRating: number;
    totalReviews: number;
  };
}
```

### ❌ Campos FALTANTES en el REGISTRO:

**Archivo:** `src/features/auth/presentation/pages/RegisterPage.tsx`

**Problema:** El formulario de registro de ambulancias NO incluye estos campos:
- Tipo de ambulancia
- Zona de cobertura
- Disponibilidad 24/7
- Traslados interprovinciales

**Formulario actual de registro:**
```typescript
// Solo pide:
- Nombre del representante
- Email
- Teléfono
- WhatsApp
- Password
- Nombre del servicio
- Dirección
- Ciudad
- Descripción
```

### 🔧 Acción requerida:

#### Opción 1: Agregar campos al registro
Modificar `RegisterPage.tsx` para incluir los campos adicionales cuando `selectedType === "ambulance"`

#### Opción 2: Usar valores por defecto
El backend puede crear ambulancias con valores por defecto:
```typescript
{
  ambulanceType: "basic",
  availability: "24/7",
  interprovincialTransfers: false,
  coverageZone: null // El usuario lo completa después
}
```

### Recomendación:
**Opción 2** es mejor porque:
- No sobrecarga el formulario de registro
- El usuario puede completar estos detalles después en su perfil
- Reduce fricción en el proceso de registro

---

## 5. 📊 Resumen de Endpoints Usados

### Bloqueo de Horarios:
```
GET  /api/doctors/clinic/date-blocks
POST /api/doctors/clinic/date-blocks/request
```

### Anuncios:
```
GET  /api/ads (filtrar por provider_id del token)
POST /api/ads (crear solicitud)
```

### Perfil de Ambulancia:
```
GET  /api/ambulances/profile
PUT  /api/ambulances/profile
```

---

## 6. 🎯 Acciones Requeridas

### Frontend (Nosotros):
1. ✅ Agregar `step="1800"` a todos los selectores de tiempo
2. ✅ Agregar validación de intervalos de 30 minutos
3. ⏳ Decidir si agregar campos de ambulancia al registro

### Backend (Ustedes):
1. ⚠️ **CRÍTICO:** Filtrar anuncios por fecha de vencimiento
   - WHERE `end_date IS NULL OR end_date >= CURRENT_DATE`
   
2. ⚠️ **IMPORTANTE:** Verificar endpoints de bloqueo de horarios
   - `GET /api/doctors/clinic/date-blocks`
   - `POST /api/doctors/clinic/date-blocks/request`
   
3. ⚠️ **IMPORTANTE:** Confirmar estructura de datos de ambulancias
   - ¿Soportan los campos: `ambulanceType`, `coverageZone`, `availability`, `interprovincialTransfers`?
   - ¿Necesitan migración de base de datos?

4. ℹ️ **OPCIONAL:** Endpoint para aprobar/rechazar bloqueos de horarios (para clínicas)
   - `PATCH /api/clinics/date-blocks/:id/approve`
   - `PATCH /api/clinics/date-blocks/:id/reject`

---

## 7. 📝 Notas Adicionales

### Sobre selectores de tiempo:
- El atributo `step="1800"` es estándar HTML5
- Funciona en todos los navegadores modernos
- Los navegadores antiguos lo ignoran pero no rompen

### Sobre anuncios:
- El frontend ya tiene la lógica de verificación
- Solo necesita que el backend filtre correctamente
- El contador regresivo funciona perfectamente

### Sobre ambulancias:
- El perfil está completo y funcional
- Solo falta decidir si agregar campos al registro
- Recomendamos usar valores por defecto en el registro

---

## 8. 🔗 Archivos de Referencia

### Bloqueo de horarios:
- `src/features/doctor-panel/presentation/components/DateBlockRequest.tsx`
- `src/features/doctor-panel/presentation/hooks/useDateBlockRequests.ts`
- `src/features/doctor-panel/infrastructure/clinic-associated.api.ts`

### Selectores de tiempo:
- `src/features/doctor-panel/presentation/components/ProfileSection.tsx` (líneas 951-997)
- `src/features/clinic-panel/presentation/components/SchedulesSection.tsx` (líneas 216-228)

### Anuncios:
- `src/features/doctor-panel/presentation/components/AdsSection.tsx` (líneas 41-54)
- `src/shared/components/PromotionalBanner.tsx` (líneas 32-70)

### Ambulancias:
- `src/features/ambulance-panel/domain/ambulance-profile.entity.ts`
- `src/features/ambulance-panel/presentation/components/EditProfileModal.tsx` (líneas 300-420)
- `src/features/auth/presentation/pages/RegisterPage.tsx`

---

**Preparado por:** Frontend Team  
**Revisión:** Pendiente  
**Próxima reunión:** Por definir
