# 📋 RESPUESTA: Estado de Endpoints de Supplies

**Para:** Frontend Team  
**De:** Backend Team  
**Fecha:** 9 de febrero de 2026

---

## 🔍 ESTADO ACTUAL

### ✅ Endpoints YA Implementados:

```
TIENDAS (Stores):
✅ GET /api/supplies - Listar tiendas
✅ GET /api/supplies/:id - Detalle de tienda
✅ GET /api/supplies/:id/reviews - Reviews de tienda
✅ POST /api/supplies/:id/reviews - Crear review
✅ GET /api/supplies/:userId/dashboard - Dashboard de tienda
```

### ❌ Endpoints NO Implementados:

```
PRODUCTOS (Products):
❌ GET /api/supplies/products - No existe
❌ GET /api/supplies/products/:id - No existe
❌ POST /api/supplies/products - No existe
❌ PUT /api/supplies/products/:id - No existe
❌ DELETE /api/supplies/products/:id - No existe

ÓRDENES (Orders):
❌ GET /api/supplies/orders - No existe
❌ GET /api/supplies/orders/:id - No existe
❌ POST /api/supplies/orders - No existe
❌ PUT /api/supplies/orders/:id/status - No existe
```

---

## 🗄️ BASE DE DATOS ACTUAL

### ✅ Tabla Existente: `provider_catalog`

Esta tabla YA existe y contiene productos:

```sql
CREATE TABLE provider_catalog (
  id VARCHAR(36) PRIMARY KEY,
  provider_id VARCHAR(36),
  type VARCHAR(255),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL,
  is_available BOOLEAN DEFAULT true,
  image_url VARCHAR(255),
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);
```

**Campos disponibles**:
- ✅ `id` - ID del producto
- ✅ `provider_id` - ID de la tienda
- ✅ `name` - Nombre del producto
- ✅ `description` - Descripción
- ✅ `type` - Categoría/tipo
- ✅ `price` - Precio
- ✅ `is_available` - Stock/disponibilidad
- ✅ `image_url` - Imagen

**Campos que FALTAN**:
- ❌ `stock` (cantidad numérica)
- ❌ `category` (separado de type)
- ❌ `created_at`
- ❌ `updated_at`

### ❌ Tabla NO Existe: Órdenes

No existe ninguna tabla para órdenes de supplies. Necesitamos crear:
- `supply_orders` - Tabla principal de órdenes
- `supply_order_items` - Items de cada orden

---

## 📊 ANÁLISIS

### Productos (Products)

**Estado**: 🟡 Parcialmente implementado

**Lo que existe**:
- ✅ Tabla `provider_catalog` con productos
- ✅ Los productos se retornan en `GET /api/supplies/:id` (detalle de tienda)
- ✅ Dashboard muestra productos recientes

**Lo que falta**:
- ❌ Endpoints CRUD dedicados para productos
- ❌ Algunos campos en la tabla (stock numérico, timestamps)

**Solución**:
1. **Opción A (Rápida)**: Usar endpoints existentes
   - Frontend usa `GET /api/supplies/:id` para obtener productos
   - No hay CRUD individual de productos por ahora
   
2. **Opción B (Completa)**: Implementar endpoints CRUD
   - Crear 5 endpoints nuevos para productos
   - Agregar campos faltantes a la tabla
   - Tiempo estimado: 1-2 días

### Órdenes (Orders)

**Estado**: ❌ No implementado

**Lo que existe**:
- ❌ Nada relacionado con órdenes

**Lo que falta**:
- ❌ Tablas de base de datos
- ❌ Todos los endpoints (4 endpoints)

**Solución**:
- Crear tablas `supply_orders` y `supply_order_items`
- Implementar 4 endpoints de órdenes
- Tiempo estimado: 2-3 días

---

## 🎯 RECOMENDACIONES

### Para el Frontend (Corto Plazo)

**Productos**:
```typescript
// En lugar de:
GET /api/supplies/products

// Usar:
GET /api/supplies/:storeId

// Respuesta incluye:
{
  id: string,
  name: string,
  products: [
    {
      id: string,
      name: string,
      description: string,
      price: number,
      imageUrl: string,
      type: string // usar como category
    }
  ]
}
```

**Órdenes**:
- Mantener mocks por ahora
- Backend implementará en 2-3 días

### Para el Backend (Implementación)

**Prioridad 1: Órdenes** (más crítico)
1. Crear tablas de órdenes
2. Implementar 4 endpoints de órdenes
3. Tiempo: 2-3 días

**Prioridad 2: Productos CRUD** (menos crítico)
1. Crear endpoints CRUD de productos
2. Agregar campos faltantes
3. Tiempo: 1-2 días

---

## 📝 RESPUESTA DETALLADA

```
PRODUCTOS:
[❌] GET /api/supplies/products - No existe
     └─ Alternativa: GET /api/supplies/:id (incluye productos)
     
[❌] GET /api/supplies/products/:id - No existe
     └─ Alternativa: Filtrar del array de productos
     
[❌] POST /api/supplies/products - No existe
     └─ Necesita implementación (1 día)
     
[❌] PUT /api/supplies/products/:id - No existe
     └─ Necesita implementación (1 día)
     
[❌] DELETE /api/supplies/products/:id - No existe
     └─ Necesita implementación (1 día)

ÓRDENES:
[❌] GET /api/supplies/orders - No existe
     └─ Necesita tablas + implementación (2 días)
     
[❌] GET /api/supplies/orders/:id - No existe
     └─ Necesita tablas + implementación (2 días)
     
[❌] POST /api/supplies/orders - No existe
     └─ Necesita tablas + implementación (2 días)
     
[❌] PUT /api/supplies/orders/:id/status - No existe
     └─ Necesita tablas + implementación (2 días)
```

---

## 🚀 PLAN DE ACCIÓN

### Opción A: Frontend se adapta (0 días backend)

**Productos**:
- Frontend usa `GET /api/supplies/:id` para obtener productos
- No hay CRUD individual por ahora
- Admin de tienda no puede gestionar productos desde la app

**Órdenes**:
- Frontend mantiene mocks
- Backend implementa en 2-3 días

**Ventaja**: Frontend puede avanzar hoy mismo  
**Desventaja**: Funcionalidad limitada

---

### Opción B: Backend implementa todo (3-5 días)

**Día 1-2: Órdenes**
- Crear tablas `supply_orders` y `supply_order_items`
- Implementar 4 endpoints de órdenes
- Tests

**Día 3-4: Productos CRUD**
- Implementar 5 endpoints de productos
- Agregar campos faltantes
- Tests

**Día 5: Integración**
- Frontend actualiza para usar endpoints reales
- Testing conjunto

**Ventaja**: Funcionalidad completa  
**Desventaja**: Frontend espera 3-5 días

---

### Opción C: Implementación por fases (Recomendada)

**Fase 1 (Hoy): Frontend usa lo que existe**
- Productos: Usar `GET /api/supplies/:id`
- Órdenes: Mantener mocks

**Fase 2 (Días 1-2): Backend implementa órdenes**
- Crear tablas de órdenes
- Implementar 4 endpoints
- Frontend actualiza órdenes

**Fase 3 (Días 3-4): Backend implementa productos CRUD**
- Implementar 5 endpoints de productos
- Frontend actualiza productos

**Ventaja**: Frontend avanza sin bloqueos, funcionalidad incremental  
**Desventaja**: Requiere 2 actualizaciones del frontend

---

## 💬 PREGUNTAS PARA EL FRONTEND

1. **¿Pueden usar `GET /api/supplies/:id` para obtener productos?**
   - Sí / No

2. **¿Es crítico el CRUD de productos o pueden esperar?**
   - Crítico / Puede esperar

3. **¿Cuándo necesitan las órdenes funcionando?**
   - Urgente / Esta semana / Próxima semana

4. **¿Prefieren Opción A, B o C?**
   - A (adaptarse) / B (esperar todo) / C (por fases)

---

## 📞 PRÓXIMOS PASOS

**Si eligen Opción A o C**:
1. Frontend usa `GET /api/supplies/:id` para productos
2. Backend empieza con órdenes mañana
3. Estimado: Órdenes listas en 2-3 días

**Si eligen Opción B**:
1. Backend implementa todo
2. Frontend espera 3-5 días
3. Integración completa al final

---

**Esperando respuesta del frontend para proceder** ⏳

---

**Generado:** 9 de febrero de 2026  
**Backend Team**
