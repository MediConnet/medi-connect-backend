# 🚀 Endpoints Listos para Frontend

**Fecha**: 9 de febrero de 2026  
**Estado**: ✅ Todos los endpoints funcionando

---

## ✅ ENDPOINTS DISPONIBLES (8/8)

### 🔴 PAGOS DE DOCTORES

#### GET /api/doctors/payments
```typescript
// Ya conectado en frontend ✅
GET /api/doctors/payments?status=pending&source=clinic
Authorization: Bearer <token>

Response: {
  success: true,
  data: Array<{
    id: string;
    appointmentId: string;
    patientName: string;
    date: string;
    amount: number;
    commission: number;
    netAmount: number;
    status: "pending" | "paid";
    paymentMethod: string;
    source: "admin" | "clinic";
    clinicId: string | null;
    clinicName: string | null;
  }>
}
```

#### GET /api/doctors/payments/:id
```typescript
// Ya conectado en frontend ✅
GET /api/doctors/payments/payment-001
Authorization: Bearer <token>

Response: {
  success: true,
  data: {
    // Mismo formato que arriba + detalles de cita
  }
}
```

---

### 🟡 PRODUCTOS

#### POST /api/supplies/products
```typescript
// Listo para conectar 🟢
POST /api/supplies/products
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  name: string;              // Requerido
  description?: string;      // Opcional
  type: string;              // Requerido (categoría)
  price: number;             // Requerido, > 0
  stock: number;             // Requerido, >= 0
  imageUrl?: string;         // Opcional
  isActive?: boolean;        // Opcional, default true
}

Response 201: {
  success: true,
  data: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    price: number;
    stock: number;
    imageUrl: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }
}
```

#### PUT /api/supplies/products/:id
```typescript
// Listo para conectar 🟢
PUT /api/supplies/products/prod-001
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  // Todos los campos son opcionales (actualización parcial)
  name?: string;
  description?: string;
  type?: string;
  price?: number;           // Si se envía, debe ser > 0
  stock?: number;           // Si se envía, debe ser >= 0
  imageUrl?: string;
  isActive?: boolean;
}

Response 200: {
  success: true,
  data: {
    id: string;
    // Campos actualizados
    updatedAt: string;
  }
}
```

#### DELETE /api/supplies/products/:id
```typescript
// Listo para conectar 🟢
DELETE /api/supplies/products/prod-001
Authorization: Bearer <token>

Response 200: {
  success: true,
  message: "Producto eliminado correctamente"
}

// Nota: Es soft delete (isActive = false)
```

---

### 🟢 ÓRDENES

#### GET /api/supplies/orders
```typescript
// Listo para conectar 🟢
GET /api/supplies/orders?status=pending
Authorization: Bearer <token>

Response 200: {
  success: true,
  data: Array<{
    id: string;
    orderNumber: string;        // ORD-2026-0001
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    items: Array<{
      id: string;
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    totalAmount: number;
    status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
    orderDate: string;
    deliveryDate: string | null;
    notes: string | null;
    createdAt: string;
  }>
}
```

#### POST /api/supplies/orders
```typescript
// Listo para conectar 🟢
POST /api/supplies/orders
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  clientName: string;         // Requerido
  clientEmail: string;        // Requerido, formato email
  clientPhone: string;        // Requerido
  clientAddress: string;      // Requerido
  items: Array<{              // Requerido, no vacío
    productId?: string;       // Opcional
    productName: string;      // Requerido
    quantity: number;         // Requerido, > 0
    unitPrice: number;        // Requerido, > 0
  }>;
  deliveryDate?: string;      // Opcional, ISO date
  notes?: string;             // Opcional
}

Response 201: {
  success: true,
  data: {
    id: string;
    orderNumber: string;      // Auto-generado: ORD-2026-0001
    status: "pending";
    totalAmount: number;      // Auto-calculado
    createdAt: string;
  }
}

// Nota: orderNumber y totalAmount se generan automáticamente
```

#### PUT /api/supplies/orders/:id/status
```typescript
// Listo para conectar 🟢
PUT /api/supplies/orders/order-001/status
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled"
}

Response 200: {
  success: true,
  data: {
    id: string;
    orderNumber: string;
    status: string;
    updatedAt: string;
  }
}
```

---

## 🔧 CONFIGURACIÓN

### Base URL
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

### Headers
```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

## 📝 NOTAS IMPORTANTES

### Productos
- ✅ `type` es la categoría del producto (ej: "Movilidad", "Ortopedia")
- ✅ `isActive` controla si el producto está disponible
- ✅ DELETE es soft delete (no elimina físicamente)
- ✅ `stock` se actualiza manualmente (no automático con órdenes)

### Órdenes
- ✅ `orderNumber` se genera automáticamente (NO enviar en POST)
- ✅ `totalAmount` se calcula automáticamente (NO enviar en POST)
- ✅ `deliveryDate` es opcional
- ✅ Items se crean en transacción con la orden
- ✅ Estados válidos: pending, confirmed, preparing, shipped, delivered, cancelled

### Pagos
- ✅ Ya funcionando en frontend
- ✅ Combina pagos de admin y clínica
- ✅ Filtros opcionales: status y source

---

## ⚠️ ERRORES COMUNES

### 400 Bad Request
```json
{
  "success": false,
  "error": "Mensaje de error específico"
}
```
**Causas**:
- Campos requeridos faltantes
- Validaciones fallidas (precio <= 0, stock < 0, etc.)
- Formato de email inválido
- Items vacío en orden

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No autorizado"
}
```
**Causas**:
- Token faltante o inválido
- Token expirado

### 403 Forbidden
```json
{
  "success": false,
  "error": "No tienes permiso para realizar esta acción"
}
```
**Causas**:
- Intentar acceder a recursos de otro proveedor/médico

### 404 Not Found
```json
{
  "success": false,
  "error": "Producto no encontrado"
}
```
**Causas**:
- ID no existe
- Producto eliminado (soft delete)

---

## ✅ CHECKLIST DE INTEGRACIÓN

### Productos
- [ ] Descomentar funciones en `products.api.ts`
- [ ] Actualizar `ProductsSection.tsx` para usar endpoints reales
- [ ] Probar crear producto
- [ ] Probar actualizar producto
- [ ] Probar eliminar producto
- [ ] Manejar errores correctamente
- [ ] Testing

### Órdenes
- [ ] Descomentar funciones en `orders.api.ts`
- [ ] Actualizar `OrdersSection.tsx` para usar endpoints reales
- [ ] Probar listar órdenes
- [ ] Probar crear orden
- [ ] Probar actualizar estado
- [ ] Manejar errores correctamente
- [ ] Testing

---

## 🧪 EJEMPLOS DE USO

### Crear Producto
```typescript
const createProduct = async (productData) => {
  const response = await fetch(`${API_BASE_URL}/api/supplies/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: "Silla de ruedas",
      type: "Movilidad",
      price: 450.00,
      stock: 10,
      isActive: true
    })
  });
  
  return await response.json();
};
```

### Crear Orden
```typescript
const createOrder = async (orderData) => {
  const response = await fetch(`${API_BASE_URL}/api/supplies/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientName: "María González",
      clientEmail: "maria@email.com",
      clientPhone: "+593 99 111 2222",
      clientAddress: "Av. Amazonas N28-75",
      items: [
        {
          productId: "prod-001",
          productName: "Silla de ruedas",
          quantity: 1,
          unitPrice: 350.00
        }
      ],
      deliveryDate: "2026-02-12"
    })
  });
  
  return await response.json();
};
```

### Actualizar Estado de Orden
```typescript
const updateOrderStatus = async (orderId, status) => {
  const response = await fetch(`${API_BASE_URL}/api/supplies/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  
  return await response.json();
};
```

---

## 📞 SOPORTE

Si encuentras algún problema:
1. Verificar que el token sea válido
2. Verificar que los datos cumplan las validaciones
3. Revisar la consola del navegador para errores
4. Contactar al equipo de backend

---

**✅ Todos los endpoints están listos y funcionando**  
**🚀 Puedes comenzar la integración ahora**

---

**Última actualización**: 9 de febrero de 2026  
**Backend Team**
