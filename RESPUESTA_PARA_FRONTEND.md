# ✅ BACKEND LISTO - Sistema de Tarifas de Consulta

**Fecha:** 23 de febrero de 2026  
**Estado:** ✅ COMPLETADO Y DESPLEGADO

---

## 🎉 Resumen

El backend para el sistema de tarifas de consulta está **100% listo y funcionando**. Pueden empezar a integrarlo en el frontend.

---

## 📡 Endpoints Disponibles

### 1. Obtener Precios de Consulta

**Endpoint:** `GET /api/doctors/consultation-prices`

**Headers:**
```
Authorization: Bearer {token_del_medico}
Content-Type: application/json
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "Cardiología": 50.00,
    "Medicina General": 30.00,
    "Dermatología": 45.00
  }
}
```

**Respuesta si no hay precios configurados:**
```json
{
  "success": true,
  "data": {
    "Cardiología": 0,
    "Medicina General": 0
  }
}
```

**Notas:**
- Retorna TODAS las especialidades del médico con sus precios
- Si una especialidad no tiene precio configurado, retorna `0`
- El objeto tiene como clave el nombre de la especialidad y como valor el precio

---

### 2. Actualizar Precios de Consulta

**Endpoint:** `PUT /api/doctors/consultation-prices`

**Headers:**
```
Authorization: Bearer {token_del_medico}
Content-Type: application/json
```

**Body:**
```json
{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00,
    "Dermatología": 45.00
  }
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Precios actualizados correctamente"
}
```

**Errores Posibles:**

**400 - Precio inválido:**
```json
{
  "success": false,
  "message": "El precio de 'Cardiología' debe ser un número mayor o igual a 0"
}
```

**400 - Especialidad no pertenece al médico:**
```json
{
  "success": false,
  "message": "La especialidad 'Neurología' no pertenece al médico"
}
```

**401 - No autenticado:**
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```

**404 - Provider no encontrado:**
```json
{
  "success": false,
  "message": "Provider no encontrado"
}
```

---

## 🔧 Integración en Frontend

### Paso 1: Obtener Precios al Cargar la Página

```typescript
// Cuando el médico abre la pestaña "Tarifas de Consulta"
async function loadConsultationPrices() {
  try {
    const response = await fetch('/api/doctors/consultation-prices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // result.data = { "Cardiología": 50.00, "Medicina General": 30.00 }
      setPrices(result.data);
    }
  } catch (error) {
    console.error('Error al cargar precios:', error);
  }
}
```

---

### Paso 2: Guardar Precios Modificados

```typescript
// Cuando el médico hace clic en "Guardar"
async function saveConsultationPrices(prices: Record<string, number>) {
  try {
    const response = await fetch('/api/doctors/consultation-prices', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prices })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Mostrar mensaje de éxito
      showSuccessMessage('Precios actualizados correctamente');
    } else {
      // Mostrar error
      showErrorMessage(result.message);
    }
  } catch (error) {
    console.error('Error al guardar precios:', error);
    showErrorMessage('Error al guardar precios');
  }
}
```

---

### Paso 3: Ejemplo Completo de Componente React

```tsx
import { useState, useEffect } from 'react';

interface Prices {
  [specialty: string]: number;
}

export function ConsultationPricesTab() {
  const [prices, setPrices] = useState<Prices>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Cargar precios al montar el componente
  useEffect(() => {
    loadPrices();
  }, []);
  
  async function loadPrices() {
    try {
      const response = await fetch('/api/doctors/consultation-prices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPrices(result.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSave() {
    setSaving(true);
    
    try {
      const response = await fetch('/api/doctors/consultation-prices', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prices })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('✅ Precios actualizados correctamente');
      } else {
        alert(`❌ Error: ${result.message}`);
      }
    } catch (error) {
      alert('❌ Error al guardar precios');
    } finally {
      setSaving(false);
    }
  }
  
  function handlePriceChange(specialty: string, value: string) {
    const numValue = parseFloat(value) || 0;
    setPrices(prev => ({
      ...prev,
      [specialty]: numValue
    }));
  }
  
  if (loading) {
    return <div>Cargando precios...</div>;
  }
  
  return (
    <div>
      <h2>Tarifas de Consulta</h2>
      
      <table>
        <thead>
          <tr>
            <th>Especialidad</th>
            <th>Precio (USD)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(prices).map(([specialty, price]) => (
            <tr key={specialty}>
              <td>{specialty}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => handlePriceChange(specialty, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </div>
  );
}
```

---

## ✅ Validaciones Implementadas en Backend

El backend ya valida:

1. ✅ **Precio >= 0:** No se permiten precios negativos
2. ✅ **Especialidad válida:** Solo se pueden configurar precios para especialidades que el médico tiene
3. ✅ **Autenticación:** Solo médicos autenticados pueden acceder
4. ✅ **Formato correcto:** El body debe tener la estructura `{ "prices": {...} }`

---

## 🧪 Pruebas con Postman/Insomnia

### Test 1: Obtener Precios

```
GET http://localhost:3000/api/doctors/consultation-prices
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test 2: Actualizar Precios

```
PUT http://localhost:3000/api/doctors/consultation-prices
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "prices": {
    "Cardiología": 50.00,
    "Medicina General": 30.00
  }
}
```

---

## 📊 Estructura de Datos

### Base de Datos

Los precios se guardan en la tabla `provider_specialties` en el campo `fee`:

```sql
SELECT 
  s.name as specialty_name,
  ps.fee as price
FROM provider_specialties ps
JOIN specialties s ON ps.specialty_id = s.id
WHERE ps.provider_id = 'uuid-del-medico';
```

---

## 🔄 Flujo Completo

1. **Médico abre pestaña "Tarifas de Consulta"**
   - Frontend llama `GET /api/doctors/consultation-prices`
   - Backend retorna todas las especialidades con sus precios

2. **Médico modifica precios**
   - Frontend actualiza el estado local
   - No se hace ninguna llamada al backend aún

3. **Médico hace clic en "Guardar"**
   - Frontend llama `PUT /api/doctors/consultation-prices` con los nuevos precios
   - Backend valida y guarda en la base de datos
   - Backend retorna confirmación

4. **Frontend muestra mensaje de éxito**
   - "Precios actualizados correctamente"

---

## ⚠️ Notas Importantes

### 1. Formato de Precios

- Los precios se manejan como `number` en JavaScript
- En la base de datos son `DECIMAL(10,2)`
- Siempre usar 2 decimales: `50.00` no `50`

### 2. Especialidades

- Solo se pueden configurar precios para especialidades que el médico YA TIENE
- Si intentan configurar una especialidad que no existe, el backend retorna error 400
- Las especialidades se obtienen de la tabla `provider_specialties`

### 3. Valores por Defecto

- Si una especialidad no tiene precio configurado, el backend retorna `0`
- El frontend puede mostrar `$ 0.00` o un placeholder como "No configurado"

### 4. Actualización Parcial

- Pueden enviar solo las especialidades que cambiaron
- No es necesario enviar todas las especialidades cada vez
- Ejemplo: Si solo cambió "Cardiología", enviar solo esa

```json
{
  "prices": {
    "Cardiología": 60.00
  }
}
```

---

## 🚀 Estado del Servidor

- ✅ Servidor corriendo en: `http://localhost:3000` (desarrollo)
- ✅ Base de datos: Conectada y funcionando
- ✅ Tabla `consultation_prices`: Creada (aunque no se usa en esta implementación)
- ✅ Endpoints: Probados y funcionando

---

## 📞 Soporte

Si tienen algún problema o duda:

1. **Revisar logs del servidor:** Los endpoints tienen logs detallados con `console.log`
2. **Verificar token:** Asegurarse de que el token sea válido y del rol `provider`
3. **Revisar formato del body:** Debe ser exactamente `{ "prices": {...} }`
4. **Verificar especialidades:** El médico debe tener las especialidades configuradas primero

---

## ✅ Checklist de Integración

- [ ] Crear componente/pestaña "Tarifas de Consulta"
- [ ] Implementar llamada GET al cargar
- [ ] Mostrar tabla con especialidades y precios
- [ ] Permitir editar precios (input type="number")
- [ ] Implementar botón "Guardar"
- [ ] Implementar llamada PUT al guardar
- [ ] Mostrar mensajes de éxito/error
- [ ] Validar precios >= 0 en frontend
- [ ] Probar con un médico real
- [ ] Verificar que los precios se guardan correctamente

---

**¡El backend está listo! Pueden empezar a integrar.** 🚀

Si necesitan ayuda o tienen dudas, avísenme.
