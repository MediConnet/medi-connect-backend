# ✅ Checklist para el Frontend

## 🎯 Objetivo
Hacer que las clínicas aparezcan en "Administración de Usuarios" y que los pagos a clínicas sean reales (no mocks).

---

## 📋 Pasos a Seguir

### Paso 1: Verificar si se están llamando los endpoints

- [ ] Abrir DevTools (F12)
- [ ] Ir a la pestaña "Network"
- [ ] Recargar la página de "Administración de Usuarios"
- [ ] Buscar petición a `/api/admin/users`
  - [ ] ¿Existe la petición? (Si NO → Ir a Paso 2)
  - [ ] ¿Status code es 200? (Si NO → Ir a Paso 3)
  - [ ] ¿Hay usuarios con `"role": "clinic"` en la respuesta? (Si NO → Contactar backend)
  - [ ] ¿Hay usuarios con propiedad `"clinic": {...}` en la respuesta? (Si NO → Contactar backend)

### Paso 2: Si NO se está llamando al endpoint

**Problema**: El frontend está usando mocks o no está haciendo la petición.

**Solución**: Agregar la llamada al endpoint:

```typescript
// En el componente de Administración de Usuarios
useEffect(() => {
  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data.users); // Guardar usuarios en el estado
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };
  
  fetchUsers();
}, [token]);
```

### Paso 3: Si el status code NO es 200

**Status 401 (Unauthorized)**:
- [ ] Cerrar sesión
- [ ] Volver a iniciar sesión
- [ ] Intentar de nuevo

**Status 403 (Forbidden)**:
- [ ] Verificar que el usuario sea admin
- [ ] Verificar que el token tenga el rol correcto

**Status 500 (Internal Server Error)**:
- [ ] Contactar al equipo de backend
- [ ] Revisar logs del servidor

### Paso 4: Incluir clínicas en el filtro de usuarios

**Problema**: El frontend está filtrando usuarios con `role === 'clinic'`.

**Solución**: Modificar el filtro para incluir clínicas:

```typescript
// ❌ ANTES (incorrecto)
const filteredUsers = users.filter(u => 
  u.role === 'provider' || u.role === 'admin'
);

// ✅ DESPUÉS (correcto)
const filteredUsers = users.filter(u => 
  u.role === 'provider' || 
  u.role === 'admin' || 
  u.role === 'clinic'  // ← AGREGAR ESTO
);

// O simplemente mostrar todos:
const filteredUsers = users; // Mostrar todos los usuarios
```

### Paso 5: Verificar el renderizado de clínicas

**Problema**: Las clínicas no se están mostrando en la UI.

**Solución**: Verificar que el componente pueda renderizar clínicas:

```typescript
// Ejemplo de cómo renderizar usuarios incluyendo clínicas
{filteredUsers.map(user => (
  <div key={user.id}>
    <h3>{user.displayName}</h3>
    <p>Email: {user.email}</p>
    <p>Tipo: {user.additionalInfo}</p>
    
    {/* Mostrar información específica según el tipo */}
    {user.clinic && (
      <div>
        <p>Clínica: {user.clinic.name}</p>
        <p>Teléfono: {user.clinic.phone}</p>
        <p>Dirección: {user.clinic.address}</p>
      </div>
    )}
    
    {user.provider && (
      <div>
        <p>Proveedor: {user.provider.commercialName}</p>
        <p>Tipo: {user.provider.serviceType}</p>
      </div>
    )}
  </div>
))}
```

### Paso 6: Verificar pagos a clínicas

- [ ] Ir a la sección de "Pagos a Clínicas"
- [ ] Abrir DevTools → Network
- [ ] Buscar petición a `/api/admin/payments/clinics`
  - [ ] ¿Existe la petición? (Si NO → Ir a Paso 7)
  - [ ] ¿Aparece "Clínica San Francisco"? (Si SÍ → Ir a Paso 7)

### Paso 7: Reemplazar mocks de pagos con endpoint real

**Problema**: El frontend está usando datos hardcodeados (mocks).

**Solución**: Llamar al endpoint real:

```typescript
// ❌ ANTES (usando mocks)
const clinicPayments = [
  {
    clinicName: "Clínica San Francisco",
    totalAmount: 1000,
    // ... datos mockeados
  }
];

// ✅ DESPUÉS (llamando al endpoint)
useEffect(() => {
  const fetchClinicPayments = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/payments/clinics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setClinicPayments(data); // Guardar pagos en el estado
    } catch (error) {
      console.error('Error fetching clinic payments:', error);
    }
  };
  
  fetchClinicPayments();
}, [token]);
```

---

## 🧪 Pruebas

### Después de aplicar los cambios, verificar:

- [ ] Las clínicas aparecen en "Administración de Usuarios"
- [ ] Se muestran 3 clínicas:
  - [ ] Clínica Central (clinic@medicones.com)
  - [ ] kevin (kevincata2005@gmail.com)
  - [ ] Patitas sanas (angel@gmail.com)
- [ ] Los pagos a clínicas NO muestran "Clínica San Francisco"
- [ ] Los pagos a clínicas muestran datos reales de la base de datos
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en la pestaña Network (todas las peticiones con status 200)

---

## 🐛 Troubleshooting

### Problema: "No aparecen las clínicas después de aplicar los cambios"

**Solución**:
1. Verificar en DevTools → Network que la petición se esté haciendo
2. Verificar en DevTools → Network → Response que haya usuarios con `role: "clinic"`
3. Verificar en la consola del navegador si hay errores de JavaScript
4. Verificar que el filtro de usuarios incluya `role === 'clinic'`
5. Verificar que el componente pueda renderizar clínicas

### Problema: "Error 401 Unauthorized"

**Solución**:
1. Cerrar sesión
2. Volver a iniciar sesión con credenciales de admin
3. Intentar de nuevo

### Problema: "Las clínicas aparecen pero sin datos"

**Solución**:
1. Verificar que el backend esté devolviendo el campo `clinic` con los datos
2. Verificar que el frontend esté accediendo a `user.clinic.name`, `user.clinic.phone`, etc.

---

## 📞 Contacto

Si después de seguir todos los pasos las clínicas aún no aparecen:

1. Tomar screenshot de DevTools → Network → `/api/admin/users` → Response
2. Tomar screenshot de la consola del navegador (errores)
3. Compartir con el equipo de backend

---

**Última actualización**: 5 de febrero de 2026  
**Estado**: Backend completado ✅ | Frontend pendiente ⏳
