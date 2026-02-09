# 📋 Plan de Trabajo: Supplies Endpoints

**Fecha:** 9 de febrero de 2026  
**Estado:** ✅ Confirmado por Frontend

---

## ✅ CONFIRMACIÓN RECIBIDA

Frontend confirma:
- ✅ Pagos de doctores funcionando 100%
- ✅ Listos para recibir productos y órdenes
- ✅ Plan de 5 días aprobado

---

## 📅 CRONOGRAMA DETALLADO

### ✅ Día 1 (HOY - 9 Feb) - COMPLETADO

**Pagos de Doctores:**
- ✅ GET /api/doctors/payments
- ✅ GET /api/doctors/payments/:id
- ✅ Tests creados
- ✅ Documentación completa
- ✅ Frontend conectado y funcionando

---

### 🔨 Día 2 (10 Feb) - PRODUCTOS CRUD

**Tareas:**

1. **Migración de Base de Datos** (1 hora)
   ```sql
   ALTER TABLE provider_catalog 
   ADD COLUMN stock INT DEFAULT 0,
   ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
   ```

2. **POST /api/supplies/products** (2 horas)
   - Crear producto nuevo
   - Validaciones: nombre, precio > 0, stock >= 0
   - Autenticación: Solo supplies/provider
   - Response: 201 Created

3. **PUT /api/supplies/products/:id** (2 horas)
   - Actualizar producto existente
   - Validar que pertenece al proveedor
   - Actualizar solo campos enviados
   - Response: 200 OK

4. **DELETE /api/supplies/products/:id** (1 hora)
   - Soft delete: `is_available = false`
   - Validar que pertenece al proveedor
   - Response: 200 OK

5. **Tests** (1 hora)
   - Test de creación
   - Test de actualización
   - Test de eliminación
   - Test de validaciones

6. **Documentación** (30 min)
   - Documentar endpoints
   - Ejemplos de uso
   - Estructura de datos

**Total:** ~7-8 horas

**Entregables:**
- ✅ 3 endpoints funcionando
- ✅ Migración aplicada
- ✅ Tests pasando
- ✅ Documentación completa

---

### 🔨 Día 3 (11 Feb) - ÓRDENES (Parte 1)

**Tareas:**

1. **Crear Tablas** (2 horas)
   
   **supply_orders:**
   ```sql
   CREATE TABLE supply_orders (
     id VARCHAR(36) PRIMARY KEY,
     order_number VARCHAR(50) UNIQUE NOT NULL,
     provider_id VARCHAR(36) NOT NULL,
     client_name VARCHAR(255) NOT NULL,
     client_email VARCHAR(255) NOT NULL,
     client_phone VARCHAR(50) NOT NULL,
     client_address TEXT NOT NULL,
     total_amount DECIMAL(10, 2) NOT NULL,
     status VARCHAR(50) DEFAULT 'pending',
     order_date TIMESTAMP NOT NULL,
     delivery_date TIMESTAMP,
     notes TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (provider_id) REFERENCES providers(id)
   );
   ```

   **supply_order_items:**
   ```sql
   CREATE TABLE supply_order_items (
     id VARCHAR(36) PRIMARY KEY,
     order_id VARCHAR(36) NOT NULL,
     product_id VARCHAR(36),
     product_name VARCHAR(255) NOT NULL,
     quantity INT NOT NULL,
     unit_price DECIMAL(10, 2) NOT NULL,
     total DECIMAL(10, 2) NOT NULL,
     FOREIGN KEY (order_id) REFERENCES supply_orders(id) ON DELETE CASCADE,
     FOREIGN KEY (product_id) REFERENCES provider_catalog(id)
   );
   ```

2. **Actualizar Prisma Schema** (1 hora)
   - Agregar modelos supply_orders
   - Agregar modelos supply_order_items
   - Regenerar Prisma Client

3. **GET /api/supplies/orders** (3 horas)
   - Listar órdenes del proveedor
   - Incluir items de cada orden
   - Ordenar por fecha (más reciente primero)
   - Filtros opcionales: status
   - Response: 200 OK

4. **Tests básicos** (1 hora)
   - Test de listado vacío
   - Test de estructura de datos

**Total:** ~7 horas

**Entregables:**
- ✅ Tablas creadas
- ✅ Prisma schema actualizado
- ✅ GET /api/supplies/orders funcionando
- ✅ Tests básicos

---

### 🔨 Día 4 (12 Feb) - ÓRDENES (Parte 2)

**Tareas:**

1. **POST /api/supplies/orders** (4 horas)
   - Crear orden nueva
   - Generar order_number único (ORD-YYYY-NNNN)
   - Validar productos existen
   - Calcular total_amount
   - Crear items en supply_order_items
   - Validaciones: email, phone, items no vacío
   - Response: 201 Created

2. **PUT /api/supplies/orders/:id/status** (2 horas)
   - Actualizar estado de orden
   - Validar que pertenece al proveedor
   - Estados válidos: pending, confirmed, preparing, shipped, delivered, cancelled
   - Response: 200 OK

3. **Tests completos** (2 horas)
   - Test de creación de orden
   - Test de actualización de estado
   - Test de validaciones
   - Test de cálculos

**Total:** ~8 horas

**Entregables:**
- ✅ POST /api/supplies/orders funcionando
- ✅ PUT /api/supplies/orders/:id/status funcionando
- ✅ Tests completos pasando

---

### 🧪 Día 5 (13 Feb) - TESTING Y DEPLOY

**Tareas:**

1. **Testing Integral** (3 horas)
   - Ejecutar todos los tests
   - Testing manual de flujos completos
   - Verificar validaciones
   - Verificar permisos

2. **Documentación Final** (2 horas)
   - Documentar todos los endpoints
   - Ejemplos de uso completos
   - Casos de error
   - Guía de integración para frontend

3. **Code Review** (1 hora)
   - Revisar código
   - Optimizaciones
   - Limpieza

4. **Deploy** (1 hora)
   - Aplicar migraciones en producción
   - Deploy de código
   - Verificar en producción

5. **Notificar Frontend** (30 min)
   - Confirmar que todo está listo
   - Compartir documentación
   - Coordinar testing conjunto

**Total:** ~7-8 horas

**Entregables:**
- ✅ Todos los tests pasando
- ✅ Documentación completa
- ✅ Deploy en producción
- ✅ Frontend notificado

---

## 📊 RESUMEN DE ENDPOINTS

### Día 1 (Completado)
```
✅ GET /api/doctors/payments
✅ GET /api/doctors/payments/:id
```

### Día 2 (Productos)
```
⏳ POST /api/supplies/products
⏳ PUT /api/supplies/products/:id
⏳ DELETE /api/supplies/products/:id
```

### Día 3-4 (Órdenes)
```
⏳ GET /api/supplies/orders
⏳ POST /api/supplies/orders
⏳ PUT /api/supplies/orders/:id/status
```

---

## 🎯 CRITERIOS DE ÉXITO

### Productos
- [x] Crear producto con todos los campos
- [x] Actualizar producto (parcial y completo)
- [x] Eliminar producto (soft delete)
- [x] Validaciones funcionando
- [x] Solo el proveedor puede editar sus productos
- [x] Tests pasando

### Órdenes
- [x] Listar órdenes del proveedor
- [x] Crear orden con múltiples items
- [x] Calcular totales correctamente
- [x] Generar order_number único
- [x] Actualizar estado de orden
- [x] Validaciones funcionando
- [x] Tests pasando

---

## 📝 NOTAS TÉCNICAS

### Autenticación
Todos los endpoints requieren:
```typescript
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Autorización
- Productos: Solo el proveedor propietario
- Órdenes: Solo el proveedor propietario

### Validaciones
- Precios: > 0
- Stock: >= 0
- Emails: formato válido
- Teléfonos: no vacío
- Cantidades: > 0

### Soft Delete
Productos usan `is_available = false` en lugar de DELETE físico.

---

## 🔄 COMUNICACIÓN CON FRONTEND

### Día 2 (Productos listos)
Notificar a frontend:
- ✅ Endpoints de productos disponibles
- ✅ Documentación compartida
- ✅ Ejemplos de uso

### Día 4 (Órdenes listas)
Notificar a frontend:
- ✅ Endpoints de órdenes disponibles
- ✅ Documentación compartida
- ✅ Ejemplos de uso

### Día 5 (Todo listo)
Notificar a frontend:
- ✅ Todos los endpoints en producción
- ✅ Testing conjunto
- ✅ Resolución de issues

---

## ✅ CHECKLIST GENERAL

### Día 1
- [x] GET /api/doctors/payments
- [x] GET /api/doctors/payments/:id
- [x] Tests
- [x] Documentación
- [x] Frontend conectado

### Día 2
- [ ] Migración de provider_catalog
- [ ] POST /api/supplies/products
- [ ] PUT /api/supplies/products/:id
- [ ] DELETE /api/supplies/products/:id
- [ ] Tests
- [ ] Documentación

### Día 3
- [ ] Crear tablas supply_orders
- [ ] Actualizar Prisma schema
- [ ] GET /api/supplies/orders
- [ ] Tests básicos

### Día 4
- [ ] POST /api/supplies/orders
- [ ] PUT /api/supplies/orders/:id/status
- [ ] Tests completos

### Día 5
- [ ] Testing integral
- [ ] Documentación final
- [ ] Deploy
- [ ] Notificar frontend

---

## 🚀 ESTADO ACTUAL

**Completado:** 2/8 endpoints (25%)  
**Pendiente:** 6/8 endpoints (75%)  
**Tiempo estimado:** 4 días más

---

**Última actualización:** 9 de febrero de 2026  
**Backend Team**
