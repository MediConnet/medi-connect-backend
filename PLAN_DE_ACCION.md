# 🚀 Plan de Acción - Backend MediConnect

## 📊 Análisis de Prioridades

### Estado Actual
- ✅ Autenticación básica (login, register, refresh, me)
- ✅ Registro de providers
- ✅ Dashboard de admin
- ✅ Perfil de doctores
- ✅ Dashboard de doctores
- ❌ **Módulo de pacientes** (NO EXISTE - BLOQUEADOR)
- ❌ **Módulo de citas** (NO EXISTE - BLOQUEADOR)
- ❌ **Sistema de booking** (NO EXISTE - BLOQUEADOR)

### ¿Por qué empezar con Pacientes?
1. **Es la base de todo**: Sin pacientes no hay citas, reseñas, pagos, etc.
2. **Es relativamente simple**: CRUD básico, sin lógica compleja
3. **Desbloquea otras funcionalidades**: Una vez implementado, podemos hacer citas
4. **El frontend lo necesita**: Los usuarios necesitan gestionar su perfil

---

## 🎯 FASE 1: Módulo de Pacientes (Sprint 1)

### Objetivo
Implementar el módulo completo de pacientes para que los usuarios puedan:
- Ver y editar su perfil
- Gestionar sus citas
- Ver su historial médico
- Gestionar favoritos
- Ver notificaciones

### Tareas

#### 1.1. Crear estructura del módulo
- [ ] Crear `src/patients/handler.ts`
- [ ] Crear `src/patients/profile.controller.ts`
- [ ] Crear `src/patients/appointments.controller.ts`
- [ ] Crear `src/patients/medical-history.controller.ts`
- [ ] Crear `src/patients/favorites.controller.ts`
- [ ] Crear `src/patients/notifications.controller.ts`
- [ ] Registrar rutas en `server/local.ts`

#### 1.2. Perfil de Paciente
- [ ] `GET /api/patients/profile` - Obtener perfil
- [ ] `PUT /api/patients/profile` - Actualizar perfil
- [ ] Validaciones:
  - Solo el propio paciente puede ver/editar su perfil
  - Validar formato de teléfono
  - Validar fecha de nacimiento

#### 1.3. Citas del Paciente
- [ ] `GET /api/patients/appointments` - Listar citas
  - Filtros: status, fecha desde/hasta
  - Ordenar por fecha
  - Incluir información del provider
- [ ] `GET /api/patients/appointments/:id` - Detalle de cita
- [ ] `DELETE /api/patients/appointments/:id` - Cancelar cita
  - Validar que solo puede cancelar sus propias citas
  - Validar tiempo límite para cancelar (ej: 24h antes)

#### 1.4. Historial Médico
- [ ] `GET /api/patients/medical-history` - Listar historial
  - Ordenar por fecha descendente
  - Incluir información del doctor
- [ ] `GET /api/patients/medical-history/:id` - Detalle de registro

#### 1.5. Favoritos
- [ ] `GET /api/patients/favorites` - Listar favoritos
  - Incluir información de la sucursal
- [ ] `POST /api/patients/favorites` - Agregar a favoritos
  - Validar que no esté duplicado
- [ ] `DELETE /api/patients/favorites/:id` - Eliminar de favoritos

#### 1.6. Notificaciones
- [ ] `GET /api/patients/notifications` - Listar notificaciones
  - Filtro: solo no leídas
  - Ordenar por fecha descendente
- [ ] `GET /api/patients/notifications/unread` - Contador de no leídas
- [ ] `PUT /api/patients/notifications/:id/read` - Marcar como leída
- [ ] `PUT /api/patients/notifications/read-all` - Marcar todas como leídas

### Estimación
- **Tiempo**: 3-5 días
- **Complejidad**: Media
- **Dependencias**: Ninguna (usa modelos existentes)

---

## 🎯 FASE 2: Módulo de Citas (Sprint 2)

### Objetivo
Implementar el módulo de citas para que:
- Los pacientes puedan crear citas
- Los providers puedan ver y gestionar citas
- Se valide disponibilidad de horarios

### Tareas

#### 2.1. Crear estructura del módulo
- [ ] Crear `src/appointments/handler.ts`
- [ ] Crear `src/appointments/booking.controller.ts`
- [ ] Crear `src/appointments/availability.controller.ts`
- [ ] Registrar rutas en `server/local.ts`

#### 2.2. Endpoints Públicos (para pacientes)
- [ ] `GET /api/appointments/available-slots` - Horarios disponibles
  - Parámetros: `providerId`, `branchId`, `date`
  - Calcular basado en `provider_schedules`
  - Excluir citas ya reservadas
  - Excluir horarios pasados
- [ ] `POST /api/appointments` - Crear cita
  - Validar que el horario esté disponible
  - Validar que no sea en el pasado
  - Crear registro en `appointments`
  - Crear notificación para el provider

#### 2.3. Endpoints de Paciente
- [ ] `GET /api/appointments` - Listar citas del paciente autenticado
- [ ] `GET /api/appointments/:id` - Detalle de cita
- [ ] `PUT /api/appointments/:id` - Actualizar cita (solo fecha/hora)
  - Validar disponibilidad del nuevo horario
- [ ] `DELETE /api/appointments/:id` - Cancelar cita
  - Cambiar status a `CANCELLED`
  - Crear notificación

#### 2.4. Endpoints de Provider (ya parcialmente implementado)
- [ ] Verificar que `GET /api/doctors/appointments` funciona correctamente
- [ ] Verificar que `PUT /api/doctors/appointments/:id/status` funciona
- [ ] Agregar validaciones adicionales si es necesario

#### 2.5. Lógica de Disponibilidad
- [ ] Función para calcular horarios disponibles
  - Leer `provider_schedules` de la sucursal
  - Leer citas existentes para esa fecha
  - Generar slots de tiempo (ej: cada 30 minutos)
  - Filtrar slots ocupados
  - Filtrar slots pasados
- [ ] Validar conflictos al crear/actualizar cita

### Estimación
- **Tiempo**: 5-7 días
- **Complejidad**: Alta (lógica de disponibilidad)
- **Dependencias**: Módulo de pacientes (Fase 1)

---

## 🎯 FASE 3: Sistema de Pagos (Sprint 3)

### Objetivo
Implementar sistema básico de pagos para:
- Procesar pagos de citas
- Calcular comisiones
- Actualizar estado de citas

### Tareas

#### 3.1. Crear estructura del módulo
- [ ] Crear `src/payments/handler.ts`
- [ ] Crear `src/payments/processing.controller.ts`
- [ ] Registrar rutas en `server/local.ts`

#### 3.2. Endpoints Básicos
- [ ] `POST /api/payments` - Crear pago
  - Calcular `amount_total` (precio de la cita)
  - Calcular `platform_fee` (comisión)
  - Calcular `provider_amount` (monto para el provider)
  - Crear registro en `payments` con status `pending`
- [ ] `POST /api/payments/:id/confirm` - Confirmar pago
  - Actualizar status a `completed`
  - Actualizar `is_paid` en `appointments`
  - Crear notificaciones

#### 3.3. Integración con Stripe (Fase 3.1 - Opcional)
- [ ] Configurar Stripe SDK
- [ ] Crear Payment Intent
- [ ] Webhook para confirmación
- [ ] Manejo de errores

#### 3.4. Endpoints de Consulta
- [ ] `GET /api/payments` - Listar pagos del usuario
- [ ] `GET /api/payments/:id` - Detalle de pago
- [ ] `GET /api/payments/methods` - Métodos de pago disponibles

### Estimación
- **Tiempo**: 4-6 días (sin Stripe), 7-10 días (con Stripe)
- **Complejidad**: Alta (integración con servicios externos)
- **Dependencias**: Módulo de citas (Fase 2)

---

## 🎯 FASE 4: Completar Módulos de Providers (Sprint 4)

### Objetivo
Completar los módulos de farmacias, laboratorios y ambulancias

### Tareas

#### 4.1. Farmacias
- [ ] Implementar todos los endpoints de `src/pharmacies/handler.ts`
- [ ] Dashboard de farmacia
- [ ] Gestión de productos
- [ ] Gestión de pedidos

#### 4.2. Laboratorios
- [ ] Implementar todos los endpoints de `src/laboratories/handler.ts`
- [ ] Dashboard de laboratorio
- [ ] Gestión de exámenes
- [ ] Gestión de resultados

#### 4.3. Ambulancias
- [ ] Implementar todos los endpoints de `src/ambulances/handler.ts`
- [ ] Dashboard de ambulancia
- [ ] Gestión de solicitudes
- [ ] Tracking de ubicación (GPS)

### Estimación
- **Tiempo**: 10-15 días (todos juntos)
- **Complejidad**: Media-Alta
- **Dependencias**: Estructura similar a doctores

---

## 🎯 FASE 5: Sistema de Notificaciones (Sprint 5)

### Objetivo
Implementar sistema de notificaciones automáticas

### Tareas

#### 5.1. Crear estructura
- [ ] Crear `src/notifications/handler.ts`
- [ ] Crear `src/notifications/service.ts` (lógica de creación)

#### 5.2. Notificaciones Automáticas
- [ ] Recordatorio de cita (24h antes)
- [ ] Confirmación de cita creada
- [ ] Cambio de estado de cita
- [ ] Resultado de examen disponible
- [ ] Pedido de farmacia/insumos listo

#### 5.3. Endpoints
- [ ] `GET /api/notifications` - Listar notificaciones
- [ ] `PUT /api/notifications/:id/read` - Marcar como leída

### Estimación
- **Tiempo**: 3-5 días
- **Complejidad**: Media
- **Dependencias**: Módulo de citas

---

## 📅 Cronograma Sugerido

### Sprint 1 (Semana 1-2)
- ✅ **Fase 1: Módulo de Pacientes**
- Tiempo estimado: 3-5 días
- Entregable: Pacientes pueden gestionar su perfil y ver citas

### Sprint 2 (Semana 3-4)
- ✅ **Fase 2: Módulo de Citas**
- Tiempo estimado: 5-7 días
- Entregable: Sistema completo de booking

### Sprint 3 (Semana 5-6)
- ✅ **Fase 3: Sistema de Pagos**
- Tiempo estimado: 4-6 días (sin Stripe)
- Entregable: Pagos básicos funcionando

### Sprint 4 (Semana 7-9)
- ✅ **Fase 4: Completar Providers**
- Tiempo estimado: 10-15 días
- Entregable: Farmacias, laboratorios y ambulancias completos

### Sprint 5 (Semana 10)
- ✅ **Fase 5: Notificaciones**
- Tiempo estimado: 3-5 días
- Entregable: Sistema de notificaciones automáticas

---

## 🎬 Recomendación: Empezar con Fase 1

### ¿Por qué Fase 1 (Pacientes)?

1. **Desbloquea todo lo demás**
   - Sin pacientes no hay citas
   - Sin citas no hay pagos
   - Sin pacientes no hay reseñas

2. **Es relativamente simple**
   - CRUD básico
   - Sin lógica compleja
   - Usa modelos existentes

3. **Valor inmediato**
   - Los usuarios pueden gestionar su perfil
   - Pueden ver sus datos
   - Pueden prepararse para hacer citas

4. **Base sólida**
   - Una vez implementado, es la base para todo
   - No necesita cambios futuros grandes
   - Es estable

### Orden de Implementación Sugerido (Fase 1)

1. **Perfil de Paciente** (más simple, valor inmediato)
   - `GET /api/patients/profile`
   - `PUT /api/patients/profile`

2. **Citas del Paciente** (necesario para el flujo)
   - `GET /api/patients/appointments`
   - `GET /api/patients/appointments/:id`
   - `DELETE /api/patients/appointments/:id`

3. **Favoritos** (simple, mejora UX)
   - `GET /api/patients/favorites`
   - `POST /api/patients/favorites`
   - `DELETE /api/patients/favorites/:id`

4. **Notificaciones** (simple, mejora UX)
   - `GET /api/patients/notifications`
   - `PUT /api/patients/notifications/:id/read`

5. **Historial Médico** (puede esperar un poco)
   - `GET /api/patients/medical-history`

---

## 🛠️ Pasos Inmediatos (Hoy)

### 1. Crear estructura del módulo de pacientes

```bash
# Crear directorio
mkdir -p src/patients

# Crear archivos base
touch src/patients/handler.ts
touch src/patients/profile.controller.ts
touch src/patients/appointments.controller.ts
touch src/patients/favorites.controller.ts
touch src/patients/notifications.controller.ts
touch src/patients/medical-history.controller.ts
```

### 2. Implementar handler básico

```typescript
// src/patients/handler.ts
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { requireAuth } from '../shared/auth';
import { getProfile, updateProfile } from './profile.controller';
// ... otros imports
```

### 3. Implementar primer endpoint (GET /api/patients/profile)

Empezar con el más simple para validar la estructura.

### 4. Registrar rutas en server/local.ts

```typescript
app.use('/api/patients', async (req, res) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(patientsHandler.handler, req, res, path);
});
```

---

## ✅ Checklist de Inicio

Antes de empezar, asegúrate de:

- [ ] El servidor local está funcionando (`npm run dev`)
- [ ] La base de datos está accesible
- [ ] Tienes usuarios de prueba (pacientes) en la BD
- [ ] Entiendes la estructura de los modelos Prisma
- [ ] Has revisado cómo están implementados otros handlers (doctors, admin)

---

## 📝 Notas Importantes

1. **Seguir el patrón existente**: Revisar `src/doctors/handler.ts` como referencia
2. **Validaciones**: Usar Zod schemas como en `src/shared/validators.ts`
3. **Autenticación**: Usar `requireAuth` para endpoints protegidos
4. **Respuestas**: Usar `successResponse`, `errorResponse`, etc. de `src/shared/response.ts`
5. **Logs**: Agregar `console.log` para debugging (como en otros handlers)
6. **Testing**: Probar cada endpoint con Insomnia antes de continuar

---

**¿Listo para empezar?** 🚀

Sugerencia: Comienza con `GET /api/patients/profile` - es el más simple y te dará confianza para continuar.
