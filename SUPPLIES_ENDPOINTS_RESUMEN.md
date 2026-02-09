# 📋 Resumen: Endpoints de Supplies

**Fecha:** 9 de febrero de 2026

---

## ✅ LO QUE YA EXISTE

```
✅ GET /api/supplies - Listar tiendas
✅ GET /api/supplies/:id - Detalle de tienda (incluye productos)
✅ GET /api/supplies/:id/reviews - Reviews
✅ POST /api/supplies/:id/reviews - Crear review
```

---

## ❌ LO QUE NO EXISTE

### Productos (CRUD)
```
❌ GET /api/supplies/products
❌ GET /api/supplies/products/:id
❌ POST /api/supplies/products
❌ PUT /api/supplies/products/:id
❌ DELETE /api/supplies/products/:id
```

**PERO**: Los productos YA se retornan en `GET /api/supplies/:id`

### Órdenes (TODO)
```
❌ GET /api/supplies/orders
❌ GET /api/supplies/orders/:id
❌ POST /api/supplies/orders
❌ PUT /api/supplies/orders/:id/status
```

**Y**: No existen tablas de órdenes en la base de datos

---

## 🎯 SOLUCIÓN RÁPIDA (HOY)

### Para Productos:
```typescript
// En lugar de:
GET /api/supplies/products

// Usar:
GET /api/supplies/:storeId

// Respuesta incluye array de productos:
{
  id: "store-123",
  name: "Tienda Medical",
  products: [
    {
      id: "prod-1",
      name: "Silla de ruedas",
      description: "...",
      price: 250.00,
      imageUrl: "...",
      type: "Movilidad" // usar como category
    }
  ]
}
```

### Para Órdenes:
- Mantener mocks por ahora
- Backend implementa en 2-3 días

---

## 📅 TIMELINE

### Opción A: Frontend se adapta (0 días)
- ✅ Productos: Usar endpoint existente
- ⏳ Órdenes: Mantener mocks

### Opción B: Backend implementa todo (3-5 días)
- Día 1-2: Órdenes (tablas + endpoints)
- Día 3-4: Productos CRUD
- Día 5: Testing

### Opción C: Por fases (Recomendada)
- **Hoy**: Frontend usa lo que existe
- **Días 1-2**: Backend implementa órdenes
- **Días 3-4**: Backend implementa productos CRUD

---

## ❓ DECISIÓN NECESARIA

**¿Qué prefieren?**

**A)** Adaptarse y usar `GET /api/supplies/:id` para productos
- ✅ Pueden avanzar hoy
- ❌ Sin CRUD individual de productos

**B)** Esperar implementación completa (3-5 días)
- ✅ Funcionalidad completa
- ❌ Bloqueo de 3-5 días

**C)** Por fases (Recomendada)
- ✅ Avanzan hoy con productos
- ✅ Órdenes en 2-3 días
- ✅ CRUD productos en 3-4 días

---

**Responder con: A, B o C**

---

**Backend Team**
