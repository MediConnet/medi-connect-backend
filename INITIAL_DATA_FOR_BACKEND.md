# 📦 Datos Iniciales para el Backend - MediConnet

Este documento contiene todos los usuarios y servicios que están registrados en el frontend (mocks) y que deben ser creados en el backend como datos iniciales para pruebas e incluidos en la base de datos.

## 📋 Índice

1. [Usuarios Administradores](#usuarios-administradores)
2. [Doctores](#doctores)
3. [Farmacias](#farmacias)
4. [Laboratorios](#laboratorios)
5. [Ambulancias](#ambulancias)
6. [Insumos Médicos](#insumos-médicos)
7. [Solicitudes Pendientes](#solicitudes-pendientes)
8. [Cadenas de Farmacias](#cadenas-de-farmacias)

---

## 👨‍💼 Usuarios Administradores

### Admin General
```json
{
  "email": "admin@medicones.com",
  "password": "admin123",
  "name": "Admin General",
  "role": "admin",
  "isActive": true
}
```

### Admin Secundario
```json
{
  "email": "admin2@medicones.com",
  "password": "admin123",
  "name": "Admin Secundario",
  "role": "admin",
  "isActive": true
}
```

---

## 👨‍⚕️ Doctores

### Dr. Juan Pérez
```json
{
  "email": "doctor@medicones.com",
  "password": "doctor123",
  "name": "Dr. Juan Pérez",
  "role": "provider",
  "serviceType": "doctor",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Dr. Juan Pérez",
    "specialty": "Cardiología",
    "email": "doctor@medicones.com",
    "whatsapp": "+593 99 123 4567",
    "address": "Av. Principal 123, Quito",
    "price": 50.00,
    "description": "Especialista en cardiología con más de 10 años de experiencia.",
    "experience": 10,
    "profileStatus": "published",
    "paymentMethods": "both",
    "consultationDuration": 30,
    "workSchedule": [
      { "day": "monday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "tuesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "wednesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "thursday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "friday", "enabled": true, "startTime": "09:00", "endTime": "17:00" }
    ]
  }
}
```

### Dr. María González
```json
{
  "email": "maria.gonzalez@medicones.com",
  "password": "doctor123",
  "name": "Dr. María González",
  "role": "provider",
  "serviceType": "doctor",
  "isActive": true
}
```

### Dr. Carlos Mendoza
```json
{
  "email": "carlos.mendoza@medicones.com",
  "password": "doctor123",
  "name": "Dr. Carlos Mendoza",
  "role": "provider",
  "serviceType": "doctor",
  "isActive": true
}
```

### Dra. Ana Martínez
```json
{
  "email": "ana.martinez@medicones.com",
  "password": "doctor123",
  "name": "Dra. Ana Martínez",
  "role": "provider",
  "serviceType": "doctor",
  "isActive": true
}
```

### Dr. Roberto Sánchez
```json
{
  "email": "roberto.sanchez@medicones.com",
  "password": "doctor123",
  "name": "Dr. Roberto Sánchez",
  "role": "provider",
  "serviceType": "doctor",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Dr. Roberto Sánchez",
    "specialty": "Cardiología Intervencionista",
    "description": "Especialista en Cardiología Intervencionista con más de 10 años de experiencia. Egresado del Instituto Nacional de Cardiología.",
    "address": "Av. Reforma 222, Consultorio 304, Quito"
  }
}
```

---

## 💊 Farmacias

### Farmacia Fybeca
```json
{
  "email": "farmacia@medicones.com",
  "password": "farmacia123",
  "name": "Farmacia Fybeca",
  "role": "provider",
  "serviceType": "pharmacy",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Fybeca",
    "logoUrl": "https://scalashopping.com/wp-content/uploads/2018/08/logo-Fybeca-01-1024x683.png",
    "ruc": "1790710319001",
    "description": "Somos parte de tu vida. Encuentra medicinas, productos de cuidado personal, belleza, maternidad y más. Calidad y servicio garantizado en todo el Ecuador.",
    "websiteUrl": "www.fybeca.com",
    "address": "Av. Amazonas N25 y Colón, Quito, Ecuador",
    "status": "published",
    "whatsapp": "+593 99 123 4567",
    "chainId": "1",
    "location": {
      "latitude": -0.1807,
      "longitude": -78.4678
    },
    "schedule": [
      { "day": "monday", "isOpen": true, "startTime": "08:00", "endTime": "22:00" },
      { "day": "tuesday", "isOpen": true, "startTime": "08:00", "endTime": "22:00" },
      { "day": "wednesday", "isOpen": true, "startTime": "08:00", "endTime": "22:00" },
      { "day": "thursday", "isOpen": true, "startTime": "08:00", "endTime": "22:00" },
      { "day": "friday", "isOpen": true, "startTime": "08:00", "endTime": "22:00" },
      { "day": "saturday", "isOpen": true, "startTime": "09:00", "endTime": "21:00" },
      { "day": "sunday", "isOpen": true, "startTime": "10:00", "endTime": "20:00" }
    ]
  }
}
```

### Farmacia Salud Total
```json
{
  "email": "saludtotal@medicones.com",
  "password": "farmacia123",
  "name": "Farmacia Salud Total",
  "role": "provider",
  "serviceType": "pharmacy",
  "isActive": true
}
```

### Farmacia San José
```json
{
  "email": "sanjose@medicones.com",
  "password": "farmacia123",
  "name": "Farmacia San José",
  "role": "provider",
  "serviceType": "pharmacy",
  "isActive": true
}
```

---

## 🧪 Laboratorios

### Laboratorio Clínico Vital
```json
{
  "email": "lab@medicones.com",
  "password": "lab123",
  "name": "Laboratorio Clínico Vital",
  "role": "provider",
  "serviceType": "laboratory",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Laboratorio Clínico Vital",
    "description": "Laboratorio de análisis clínicos de alta complejidad. Certificación ISO 9001. Resultados en línea 24/7.",
    "address": "Av. Amazonas N24-12 y Mariscal Foch, Quito",
    "whatsapp": "+593 99 123 4567",
    "phone": "+593 2 256 7890"
  }
}
```

### Laboratorio Diagnóstico
```json
{
  "email": "labdiagnostico@medicones.com",
  "password": "lab123",
  "name": "Laboratorio Diagnóstico",
  "role": "provider",
  "serviceType": "laboratory",
  "isActive": true
}
```

### Laboratorio Clínico XYZ
```json
{
  "email": "labxyz@medicones.com",
  "password": "lab123",
  "name": "Laboratorio Clínico XYZ",
  "role": "provider",
  "serviceType": "laboratory",
  "isActive": true
}
```

---

## 🚑 Ambulancias

### Ambulancias Vida
```json
{
  "email": "ambulancia@medicones.com",
  "password": "ambulancia123",
  "name": "Ambulancias Vida",
  "role": "provider",
  "serviceType": "ambulance",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Ambulancias VidaRápida",
    "shortDescription": "Servicio de ambulancia 24/7. Unidades de terapia intensiva móvil y traslados programados.",
    "address": "Av. 12 de Octubre N27-30 y Orellana, Quito",
    "whatsappContact": "0998765432",
    "emergencyPhone": "3245678",
    "arrivalField": 15,
    "ambulanceType": "advanced",
    "coverageZone": "Quito, Valle de los Chillos y alrededores",
    "availability": "24/7",
    "interprovincialTransfers": true
  }
}
```

### Ambulancias Rápidas
```json
{
  "email": "ambulanciasrapidas@medicones.com",
  "password": "ambulancia123",
  "name": "Ambulancias Rápidas",
  "role": "provider",
  "serviceType": "ambulance",
  "isActive": true,
  "providerProfile": {
    "commercialName": "Ambulancias Rápidas 24/7",
    "description": "Servicio de traslado terrestre de urgencia y terapia intensiva. Unidades equipadas con desfibrilador y oxígeno.",
    "address": "Av. 6 de Diciembre N24-120, Sector La Mariscal, Quito",
    "phone": "+593 2 2123 4567",
    "whatsapp": "+593 99 345 6789"
  }
}
```

---

## 📦 Insumos Médicos

### Insumos Médicos Plus
```json
{
  "email": "insumos@medicones.com",
  "password": "insumos123",
  "name": "Insumos Médicos Plus",
  "role": "provider",
  "serviceType": "supplies",
  "isActive": true
}
```

### Insumos Médicos ABC
```json
{
  "email": "insumosabc@medicones.com",
  "password": "insumos123",
  "name": "Insumos Médicos ABC",
  "role": "provider",
  "serviceType": "supplies",
  "isActive": true
}
```

---

## 📝 Solicitudes Pendientes

Estas son solicitudes de registro que están en estado PENDING, APPROVED o REJECTED en el sistema de administración:

### REQ-001: Dr. Roberto Sánchez (PENDING)
```json
{
  "providerName": "Dr. Roberto Sánchez",
  "email": "roberto.sanchez@email.com",
  "serviceType": "doctor",
  "phone": "+593 99 123 4567",
  "whatsapp": "+593 99 123 4567",
  "city": "Ciudad de Quito",
  "address": "Av. Reforma 222, Consultorio 304",
  "description": "Especialista en Cardiología Intervencionista con más de 10 años de experiencia. Egresado del Instituto Nacional de Cardiología.",
  "status": "PENDING",
  "submissionDate": "2024-01-25",
  "documents": [
    { "name": "Título Profesional.pdf", "type": "pdf" },
    { "name": "Cédula Profesional.pdf", "type": "pdf" },
    { "name": "Comprobante Domicilio.jpg", "type": "image" }
  ]
}
```

### REQ-002: Farmacia Santa Martha (APPROVED)
```json
{
  "providerName": "Farmacia Santa Martha",
  "email": "contacto@santamartha.com",
  "serviceType": "pharmacy",
  "phone": "+593 99 123 4567",
  "whatsapp": "+593 99 123 4567",
  "city": "Quito",
  "address": "Calle Morelos 567, Centro",
  "description": "Farmacia con servicio 24 horas. Medicamentos genéricos y de patente.",
  "status": "APPROVED",
  "submissionDate": "2024-01-24",
  "documents": [
    { "name": "Licencia Sanitaria.pdf", "type": "pdf" },
    { "name": "Aviso de Funcionamiento.pdf", "type": "pdf" },
    { "name": "RFC.pdf", "type": "pdf" },
    { "name": "Comprobante Domicilio.pdf", "type": "pdf" },
    { "name": "Fotografías Local.jpg", "type": "image" }
  ]
}
```

### REQ-003: Laboratorio Clínico Vital (REJECTED)
```json
{
  "providerName": "Laboratorio Clínico Vital",
  "email": "info@labvital.ec",
  "serviceType": "laboratory",
  "phone": "+593 2 256 7890",
  "whatsapp": "+593 99 123 4567",
  "city": "Quito",
  "address": "Av. Amazonas N24-12 y Mariscal Foch",
  "description": "Laboratorio de análisis clínicos de alta complejidad. Certificación ISO 9001. Resultados en línea 24/7.",
  "status": "REJECTED",
  "submissionDate": "2024-01-23",
  "rejectionReason": "Documentos incompletos",
  "documents": [
    { "name": "Permiso ACESS.pdf", "type": "pdf" },
    { "name": "RUC.pdf", "type": "pdf" },
    { "name": "Título Bioquímico Responsable.pdf", "type": "pdf" },
    { "name": "Manual de Procedimientos.pdf", "type": "pdf" }
  ]
}
```

### REQ-004: Dra. Laura Mendoza (PENDING)
```json
{
  "providerName": "Dra. Laura Mendoza",
  "email": "laura.mendoza@email.com",
  "serviceType": "doctor",
  "phone": "+593 4 256 7890",
  "whatsapp": "+593 99 234 5678",
  "city": "Guayaquil",
  "address": "Av. 9 de Octubre 405, Piso 4, Consultorio 402",
  "description": "Pediatra Neonatóloga certificada. Atención integral del recién nacido y control de niño sano. Lactancia materna.",
  "status": "PENDING",
  "submissionDate": "2024-01-22",
  "documents": [
    { "name": "Título Médico Cirujano.pdf", "type": "pdf" },
    { "name": "Diploma Especialidad Pediatría.pdf", "type": "pdf" },
    { "name": "Certificación Consejo de Especialidades.pdf", "type": "pdf" }
  ]
}
```

### REQ-005: Ambulancias Rápidas 24/7 (APPROVED)
```json
{
  "providerName": "Ambulancias Rápidas 24/7",
  "email": "gerencia@ambulanciasrapidas.com",
  "serviceType": "ambulance",
  "phone": "+593 2 2123 4567",
  "whatsapp": "+593 99 345 6789",
  "city": "Quito",
  "address": "Av. 6 de Diciembre N24-120, Sector La Mariscal",
  "description": "Servicio de traslado terrestre de urgencia y terapia intensiva. Unidades equipadas con desfibrilador y oxígeno.",
  "status": "APPROVED",
  "submissionDate": "2024-01-20",
  "documents": [
    { "name": "Tarjeta de Circulación.pdf", "type": "pdf" },
    { "name": "Póliza de Seguro Responsabilidad Civil.pdf", "type": "pdf" }
  ]
}
```

---

## 🏪 Cadenas de Farmacias

### Fybeca
```json
{
  "id": "1",
  "name": "Fybeca",
  "logoUrl": "https://scalashopping.com/wp-content/uploads/2018/08/logo-Fybeca-01-1024x683.png",
  "isActive": true
}
```

---

## 📊 Resumen de Datos

### Totales por Tipo de Servicio

- **Administradores**: 2
- **Doctores**: 5
- **Farmacias**: 3
- **Laboratorios**: 3
- **Ambulancias**: 2
- **Insumos Médicos**: 2
- **Solicitudes Pendientes**: 5
- **Cadenas de Farmacias**: 1

**Total de Usuarios**: 17

---

## 🔑 Credenciales de Acceso para Pruebas

### Administrador
```
Email: admin@medicones.com
Password: admin123
```

### Doctor
```
Email: doctor@medicones.com
Password: doctor123
```

### Farmacia
```
Email: farmacia@medicones.com
Password: farmacia123
```

### Laboratorio
```
Email: lab@medicones.com
Password: lab123
```

### Ambulancia
```
Email: ambulancia@medicones.com
Password: ambulancia123
```

### Insumos Médicos
```
Email: insumos@medicones.com
Password: insumos123
```

---

## 🧪 Endpoints para Pruebas

### 1. Autenticación

#### POST `/api/auth/login` - Iniciar Sesión
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@medicones.com",
    "password": "doctor123"
  }'
```

**Response esperado:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "doctor@medicones.com",
    "role": "provider",
    "token": "jwt-token-here",
    "refreshToken": "refresh-token-here"
  }
}
```

#### POST `/api/auth/register` - Registrar Usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo.doctor@medicones.com",
    "password": "password123",
    "name": "Dr. Nuevo",
    "role": "provider",
    "serviceType": "doctor"
  }'
```

#### GET `/api/auth/me` - Obtener Usuario Actual
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

---

### 2. Doctores

#### GET `/api/providers/me` - Obtener Perfil del Doctor
```bash
curl -X GET http://localhost:3000/api/providers/me \
  -H "Authorization: Bearer <token>"
```

**Token a usar:** Token obtenido de login con `doctor@medicones.com`

#### GET `/api/providers/me/dashboard` - Dashboard del Doctor
```bash
curl -X GET http://localhost:3000/api/providers/me/dashboard \
  -H "Authorization: Bearer <token>"
```

#### PUT `/api/providers/me` - Actualizar Perfil del Doctor
```bash
curl -X PUT http://localhost:3000/api/providers/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "commercialName": "Dr. Juan Pérez Actualizado",
    "description": "Nueva descripción"
  }'
```

#### GET `/api/providers/me/branches` - Obtener Sucursales
```bash
curl -X GET http://localhost:3000/api/providers/me/branches \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/appointments` - Obtener Citas del Doctor
```bash
curl -X GET http://localhost:3000/api/appointments \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/providers/me/payments` - Obtener Pagos
```bash
curl -X GET http://localhost:3000/api/providers/me/payments \
  -H "Authorization: Bearer <token>"
```

---

### 3. Farmacias

#### GET `/api/pharmacies/profile` - Obtener Perfil de Farmacia
```bash
curl -X GET http://localhost:3000/api/pharmacies/profile \
  -H "Authorization: Bearer <token>"
```

**Token a usar:** Token obtenido de login con `farmacia@medicones.com`

#### PUT `/api/pharmacies/profile` - Actualizar Perfil
```bash
curl -X PUT http://localhost:3000/api/pharmacies/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Nueva descripción de la farmacia",
    "whatsapp": "+593 99 999 9999"
  }'
```

#### GET `/api/pharmacies/branches` - Obtener Sucursales
```bash
curl -X GET http://localhost:3000/api/pharmacies/branches \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/pharmacies/branches` - Crear Sucursal
```bash
curl -X POST http://localhost:3000/api/pharmacies/branches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sucursal Norte",
    "address": "Av. Norte 456",
    "phone": "+593 99 999 9999",
    "whatsapp": "+593 99 999 9999",
    "openingHours": "Lun-Vie: 9:00-18:00",
    "hasHomeDelivery": true
  }'
```

#### GET `/api/pharmacies/reviews` - Obtener Reseñas
```bash
curl -X GET http://localhost:3000/api/pharmacies/reviews \
  -H "Authorization: Bearer <token>"
```

---

### 4. Laboratorios

#### GET `/api/laboratories/profile` - Obtener Perfil
```bash
curl -X GET http://localhost:3000/api/laboratories/profile \
  -H "Authorization: Bearer <token>"
```

**Token a usar:** Token obtenido de login con `lab@medicones.com`

#### PUT `/api/laboratories/profile` - Actualizar Perfil
```bash
curl -X PUT http://localhost:3000/api/laboratories/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laboratorio Clínico Vital Actualizado",
    "description": "Nueva descripción"
  }'
```

---

### 5. Ambulancias

#### GET `/api/ambulances/profile` - Obtener Perfil
```bash
curl -X GET http://localhost:3000/api/ambulances/profile \
  -H "Authorization: Bearer <token>"
```

**Token a usar:** Token obtenido de login con `ambulancia@medicones.com`

#### PUT `/api/ambulances/profile` - Actualizar Perfil
```bash
curl -X PUT http://localhost:3000/api/ambulances/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "commercialName": "Ambulancias VidaRápida Actualizado",
    "arrivalField": 20
  }'
```

---

### 6. Insumos Médicos

#### GET `/api/supplies/stores` - Listar Tiendas (Público)
```bash
curl -X GET http://localhost:3000/api/supplies/stores
```

#### GET `/api/supplies/stores/:id` - Detalle de Tienda (Público)
```bash
curl -X GET http://localhost:3000/api/supplies/stores/{storeId}
```

---

### 7. Administración

#### GET `/api/admin/dashboard/stats` - Estadísticas del Dashboard
```bash
curl -X GET http://localhost:3000/api/admin/dashboard/stats \
  -H "Authorization: Bearer <token>"
```

**Token a usar:** Token obtenido de login con `admin@medicones.com`

#### GET `/api/admin/requests` - Obtener Solicitudes de Proveedores
```bash
curl -X GET http://localhost:3000/api/admin/requests \
  -H "Authorization: Bearer <token>"
```

#### PUT `/api/admin/requests/:id/approve` - Aprobar Solicitud
```bash
curl -X PUT http://localhost:3000/api/admin/requests/REQ-001/approve \
  -H "Authorization: Bearer <token>"
```

#### PUT `/api/admin/requests/:id/reject` - Rechazar Solicitud
```bash
curl -X PUT http://localhost:3000/api/admin/requests/REQ-003/reject \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Documentos incompletos"
  }'
```

#### GET `/api/admin/ad-requests` - Obtener Solicitudes de Anuncios
```bash
curl -X GET http://localhost:3000/api/admin/ad-requests \
  -H "Authorization: Bearer <token>"
```

#### PUT `/api/admin/ad-requests/:id/approve` - Aprobar Anuncio
```bash
curl -X PUT http://localhost:3000/api/admin/ad-requests/{adRequestId}/approve \
  -H "Authorization: Bearer <token>"
```

#### GET `/api/admin/providers` - Listar Proveedores
```bash
curl -X GET http://localhost:3000/api/admin/providers \
  -H "Authorization: Bearer <token>"
```

#### PUT `/api/admin/providers/:id/verify` - Verificar Proveedor
```bash
curl -X PUT http://localhost:3000/api/admin/providers/{providerId}/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationStatus": "APPROVED"
  }'
```

---

### 8. Anuncios (Proveedores)

#### GET `/api/providers/me/ads` - Obtener Anuncios del Proveedor
```bash
curl -X GET http://localhost:3000/api/providers/me/ads \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/providers/me/ads` - Crear Anuncio
```bash
curl -X POST http://localhost:3000/api/providers/me/ads \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "badgeText": "PRIMERA CITA",
    "title": "20% OFF",
    "subtitle": "En tu primera consulta general",
    "imageUrl": "https://example.com/ad.jpg",
    "actionText": "Canjear Ahora",
    "bgColorHex": "#3b82f6",
    "accentColorHex": "#1e40af",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "priorityOrder": 1
  }'
```

#### GET `/api/ads/active` - Obtener Anuncios Activos (Público)
```bash
curl -X GET http://localhost:3000/api/ads/active?providerId={providerId}
```

---

### 9. Citas

#### POST `/api/appointments` - Crear Cita
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "uuid-de-sucursal",
    "scheduledFor": "2024-01-15T10:00:00Z",
    "reason": "Consulta general"
  }'
```

#### PUT `/api/appointments/:id/status` - Actualizar Estado de Cita
```bash
curl -X PUT http://localhost:3000/api/appointments/{appointmentId}/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }'
```

---

### 10. Pagos

#### GET `/api/payments` - Obtener Pagos
```bash
curl -X GET http://localhost:3000/api/payments \
  -H "Authorization: Bearer <token>"
```

#### POST `/api/payments` - Crear Pago
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": "uuid",
    "amountTotal": 50.00,
    "platformFee": 7.50,
    "providerAmount": 42.50,
    "status": "pending"
  }'
```

---

## 📋 Checklist de Pruebas

### Autenticación
- [ ] POST `/api/auth/login` - Login con cada tipo de usuario
- [ ] GET `/api/auth/me` - Obtener usuario actual
- [ ] POST `/api/auth/refresh` - Refrescar token

### Doctores
- [ ] GET `/api/providers/me` - Obtener perfil
- [ ] GET `/api/providers/me/dashboard` - Dashboard
- [ ] PUT `/api/providers/me` - Actualizar perfil
- [ ] GET `/api/appointments` - Listar citas
- [ ] GET `/api/providers/me/payments` - Listar pagos

### Farmacias
- [ ] GET `/api/pharmacies/profile` - Obtener perfil
- [ ] PUT `/api/pharmacies/profile` - Actualizar perfil
- [ ] GET `/api/pharmacies/branches` - Listar sucursales
- [ ] POST `/api/pharmacies/branches` - Crear sucursal
- [ ] GET `/api/pharmacies/reviews` - Listar reseñas

### Laboratorios
- [ ] GET `/api/laboratories/profile` - Obtener perfil
- [ ] PUT `/api/laboratories/profile` - Actualizar perfil

### Ambulancias
- [ ] GET `/api/ambulances/profile` - Obtener perfil
- [ ] PUT `/api/ambulances/profile` - Actualizar perfil

### Administración
- [ ] GET `/api/admin/dashboard/stats` - Estadísticas
- [ ] GET `/api/admin/requests` - Solicitudes de proveedores
- [ ] PUT `/api/admin/requests/:id/approve` - Aprobar solicitud
- [ ] PUT `/api/admin/requests/:id/reject` - Rechazar solicitud
- [ ] GET `/api/admin/ad-requests` - Solicitudes de anuncios
- [ ] GET `/api/admin/providers` - Listar proveedores

### Anuncios
- [ ] GET `/api/providers/me/ads` - Listar anuncios
- [ ] POST `/api/providers/me/ads` - Crear anuncio
- [ ] GET `/api/ads/active` - Anuncios activos (público)

---

## 🛠️ Herramientas Recomendadas para Pruebas

### 1. Postman
- Importar colección de endpoints
- Configurar variables de entorno (`baseUrl`, `token`)
- Crear tests automáticos

### 2. Insomnia
- Similar a Postman
- Interfaz más moderna

### 3. cURL (Línea de comandos)
- Todos los ejemplos están en formato cURL
- Fácil de copiar y pegar

### 4. Thunder Client (VS Code)
- Extensión de VS Code
- Pruebas directamente desde el editor

---

## 📝 Variables de Entorno para Pruebas

Crea un archivo `.env.test` en el backend:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mediconnet_test
JWT_SECRET=test-secret-key
API_BASE_URL=http://localhost:3000/api
NODE_ENV=test
```

---

## 🔄 Flujo de Prueba Recomendado

1. **Autenticación**
   ```bash
   # 1. Login como admin
   POST /api/auth/login
   # Guardar el token
   
   # 2. Verificar usuario actual
   GET /api/auth/me
   ```

2. **Administración**
   ```bash
   # 3. Ver estadísticas
   GET /api/admin/dashboard/stats
   
   # 4. Ver solicitudes
   GET /api/admin/requests
   
   # 5. Aprobar una solicitud
   PUT /api/admin/requests/REQ-001/approve
   ```

3. **Proveedor (Doctor)**
   ```bash
   # 6. Login como doctor
   POST /api/auth/login (con doctor@medicones.com)
   
   # 7. Ver perfil
   GET /api/providers/me
   
   # 8. Ver dashboard
   GET /api/providers/me/dashboard
   
   # 9. Actualizar perfil
   PUT /api/providers/me
   ```

4. **Anuncios**
   ```bash
   # 10. Crear anuncio
   POST /api/providers/me/ads
   
   # 11. Ver anuncios
   GET /api/providers/me/ads
   
   # 12. Ver anuncios activos (público)
   GET /api/ads/active
   ```

---

## ⚠️ Notas Importantes

1. **Tokens**: Todos los endpoints (excepto login/register) requieren el header `Authorization: Bearer <token>`

2. **Base URL**: Reemplaza `http://localhost:3000/api` con tu URL real del backend

3. **UUIDs**: Los IDs en los ejemplos son placeholders, usa los UUIDs reales que retorne el backend

4. **Errores**: Si recibes errores 401, verifica que el token sea válido y no haya expirado

5. **CORS**: Asegúrate de que el backend tenga CORS configurado para permitir requests del frontend

---

## 📚 Documentación Adicional

- Ver `BACKEND_ENDPOINTS.md` para la documentación completa de todos los endpoints
- Ver `API_INTEGRATION.md` para la guía de integración del frontend

---

## 📝 Notas para el Backend

1. **Passwords**: Todas las contraseñas deben ser hasheadas usando bcrypt antes de guardarlas en la base de datos.

2. **UUIDs**: Los IDs deben ser generados como UUIDs en el backend, no usar los IDs simples del frontend.

3. **Relaciones**: 
   - Cada usuario `PROVIDER` debe tener un registro en la tabla `providers`
   - Cada usuario `PROVIDER` debe tener al menos una `provider_branch` (sucursal)
   - Las farmacias que tienen `chainId` deben estar relacionadas con la cadena correspondiente

4. **Estados de Verificación**:
   - Los usuarios ya registrados deben tener `verificationStatus: "APPROVED"`
   - Las solicitudes pendientes deben crearse en la tabla `provider_requests` con `status: "PENDING"`

5. **Categorías de Servicio**:
   - `doctor` → `categoryId: 1` (Doctor)
   - `pharmacy` → `categoryId: 2` (Farmacia)
   - `laboratory` → `categoryId: 3` (Laboratorio)
   - `ambulance` → `categoryId: 4` (Ambulancia)
   - `supplies` → `categoryId: 5` (Insumos Médicos)

6. **Ciudades**: 
   - Quito
   - Guayaquil
   - Cuenca
   - Crear estas ciudades en la tabla `cities` si no existen

7. **Datos Adicionales**:
   - Los horarios (`workSchedule` para doctores, `schedule` para farmacias) deben crearse en `provider_schedules`
   - Las ubicaciones deben guardarse en `provider_branches` con `latitude` y `longitude`

---

## 🗄️ Inserción en la Base de Datos

### Estructura de Tablas (Prisma Schema)

Estos datos deben insertarse en las siguientes tablas según el schema de Prisma:

1. **`users`** - Usuarios del sistema
2. **`providers`** - Perfiles de proveedores
3. **`provider_branches`** - Sucursales de proveedores
4. **`provider_schedules`** - Horarios de sucursales
5. **`provider_bank_details`** - Detalles bancarios
6. **`provider_ads`** - Anuncios promocionales
7. **`provider_catalog`** - Catálogo de servicios/productos
8. **`cities`** - Ciudades
9. **`service_categories`** - Categorías de servicio
10. **`provider_requests`** - Solicitudes de registro (pendientes)

---

## 📝 Script SQL de Inserción

### 1. Insertar Ciudades

```sql
INSERT INTO cities (id, name, state, country) VALUES
  (gen_random_uuid(), 'Quito', 'Pichincha', 'Ecuador'),
  (gen_random_uuid(), 'Guayaquil', 'Guayas', 'Ecuador'),
  (gen_random_uuid(), 'Cuenca', 'Azuay', 'Ecuador');
```

### 2. Insertar Categorías de Servicio

```sql
INSERT INTO service_categories (name, slug, default_color_hex, allows_booking) VALUES
  ('Doctor', 'doctor', '#3b82f6', true),
  ('Farmacia', 'pharmacy', '#22c55e', false),
  ('Laboratorio', 'laboratory', '#a855f7', false),
  ('Ambulancia', 'ambulance', '#ef4444', true),
  ('Insumos Médicos', 'supplies', '#f97316', false);
```

### 3. Insertar Usuarios

```sql
-- IMPORTANTE: Las contraseñas deben ser hasheadas con bcrypt antes de insertar
-- Ejemplo con bcrypt hash de 'admin123': $2b$10$hashed_password_here

-- Usuario Administrador
INSERT INTO users (id, email, password_hash, role, is_active, created_at) VALUES
  (gen_random_uuid(), 'admin@medicones.com', '$2b$10$hashed_password_here', 'admin', true, NOW());

-- Usuario Doctor
INSERT INTO users (id, email, password_hash, role, is_active, created_at) VALUES
  (gen_random_uuid(), 'doctor@medicones.com', '$2b$10$hashed_password_here', 'provider', true, NOW());

-- Usuario Farmacia
INSERT INTO users (id, email, password_hash, role, is_active, created_at) VALUES
  (gen_random_uuid(), 'farmacia@medicones.com', '$2b$10$hashed_password_here', 'provider', true, NOW());

-- Continuar con los demás usuarios...
```

**Nota:** Las contraseñas deben ser hasheadas con bcrypt antes de insertar. Ver sección de Script Prisma para ejemplo.

### 4. Insertar Proveedores

```sql
-- Ejemplo: Insertar proveedor (doctor)
-- Primero obtener el user_id y category_id
INSERT INTO providers (
  id, 
  user_id, 
  category_id, 
  commercial_name, 
  logo_url, 
  description, 
  verification_status,
  commission_percentage
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM users WHERE email = 'doctor@medicones.com'),
  (SELECT id FROM service_categories WHERE slug = 'doctor'),
  'Dr. Juan Pérez',
  NULL,
  'Especialista en cardiología con más de 10 años de experiencia.',
  'APPROVED',
  15.0
);
```

### 5. Insertar Sucursales

```sql
-- Ejemplo: Insertar sucursal para un doctor
INSERT INTO provider_branches (
  id,
  provider_id,
  city_id,
  name,
  description,
  address_text,
  latitude,
  longitude,
  phone_contact,
  email_contact,
  opening_hours_text,
  is_24h,
  has_delivery,
  is_main,
  is_active
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM providers WHERE commercial_name = 'Dr. Juan Pérez'),
  (SELECT id FROM cities WHERE name = 'Quito'),
  'Consultorio Principal',
  'Consultorio principal del Dr. Juan Pérez',
  'Av. Principal 123, Quito',
  -0.1807,
  -78.4678,
  '+593 99 123 4567',
  'doctor@medicones.com',
  'Lun-Vie: 9:00-17:00',
  false,
  false,
  true,
  true
);
```

### 6. Insertar Horarios

```sql
-- Ejemplo: Insertar horarios para una sucursal
-- day_of_week: 0=Domingo, 1=Lunes, 2=Martes, ..., 6=Sábado
INSERT INTO provider_schedules (
  id,
  branch_id,
  day_of_week,
  start_time,
  end_time
) VALUES
  (gen_random_uuid(), (SELECT id FROM provider_branches WHERE name = 'Consultorio Principal' LIMIT 1), 1, '09:00:00', '17:00:00'),
  (gen_random_uuid(), (SELECT id FROM provider_branches WHERE name = 'Consultorio Principal' LIMIT 1), 2, '09:00:00', '17:00:00'),
  (gen_random_uuid(), (SELECT id FROM provider_branches WHERE name = 'Consultorio Principal' LIMIT 1), 3, '09:00:00', '17:00:00'),
  (gen_random_uuid(), (SELECT id FROM provider_branches WHERE name = 'Consultorio Principal' LIMIT 1), 4, '09:00:00', '17:00:00'),
  (gen_random_uuid(), (SELECT id FROM provider_branches WHERE name = 'Consultorio Principal' LIMIT 1), 5, '09:00:00', '17:00:00');
```

### 7. Insertar Detalles Bancarios

```sql
-- Ejemplo: Insertar detalles bancarios para un proveedor
INSERT INTO provider_bank_details (
  id,
  provider_id,
  bank_name,
  account_number,
  account_type,
  account_holder_name,
  holder_identification,
  is_verified,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM providers WHERE commercial_name = 'Dr. Juan Pérez'),
  'Banco del Pichincha',
  '1234567890',
  'checking',
  'Dr. Juan Pérez',
  '1234567890',
  false,
  NOW()
);
```

### 8. Insertar Solicitudes Pendientes

```sql
-- Ejemplo: Insertar solicitud pendiente
INSERT INTO provider_requests (
  id,
  provider_name,
  email,
  service_type,
  submission_date,
  status,
  phone,
  whatsapp,
  city,
  address,
  description,
  documents_count
) VALUES (
  gen_random_uuid(),
  'Dr. Roberto Sánchez',
  'roberto.sanchez@email.com',
  'doctor',
  '2024-01-25',
  'PENDING',
  '+593 99 123 4567',
  '+593 99 123 4567',
  'Ciudad de Quito',
  'Av. Reforma 222, Consultorio 304',
  'Especialista en Cardiología Intervencionista con más de 10 años de experiencia.',
  3
);
```

---

## 🔧 Script de Seed con Prisma

### Ejemplo de Script TypeScript para Prisma Seed

Crea un archivo `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...');

  // 1. Crear ciudades
  const quito = await prisma.cities.create({
    data: {
      name: 'Quito',
      state: 'Pichincha',
      country: 'Ecuador',
    },
  });

  const guayaquil = await prisma.cities.create({
    data: {
      name: 'Guayaquil',
      state: 'Guayas',
      country: 'Ecuador',
    },
  });

  const cuenca = await prisma.cities.create({
    data: {
      name: 'Cuenca',
      state: 'Azuay',
      country: 'Ecuador',
    },
  });

  console.log('✅ Ciudades creadas');

  // 2. Crear categorías de servicio
  const doctorCategory = await prisma.service_categories.create({
    data: {
      name: 'Doctor',
      slug: 'doctor',
      default_color_hex: '#3b82f6',
      allows_booking: true,
    },
  });

  const pharmacyCategory = await prisma.service_categories.create({
    data: {
      name: 'Farmacia',
      slug: 'pharmacy',
      default_color_hex: '#22c55e',
      allows_booking: false,
    },
  });

  const laboratoryCategory = await prisma.service_categories.create({
    data: {
      name: 'Laboratorio',
      slug: 'laboratory',
      default_color_hex: '#a855f7',
      allows_booking: false,
    },
  });

  const ambulanceCategory = await prisma.service_categories.create({
    data: {
      name: 'Ambulancia',
      slug: 'ambulance',
      default_color_hex: '#ef4444',
      allows_booking: true,
    },
  });

  const suppliesCategory = await prisma.service_categories.create({
    data: {
      name: 'Insumos Médicos',
      slug: 'supplies',
      default_color_hex: '#f97316',
      allows_booking: false,
    },
  });

  console.log('✅ Categorías de servicio creadas');

  // 3. Crear usuarios administradores
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.users.create({
    data: {
      email: 'admin@medicones.com',
      password_hash: adminPassword,
      role: 'admin',
      is_active: true,
    },
  });

  const admin2Password = await bcrypt.hash('admin123', 10);
  await prisma.users.create({
    data: {
      email: 'admin2@medicones.com',
      password_hash: admin2Password,
      role: 'admin',
      is_active: true,
    },
  });

  console.log('✅ Usuarios administradores creados');

  // 4. Crear usuario doctor
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  const doctorUser = await prisma.users.create({
    data: {
      email: 'doctor@medicones.com',
      password_hash: doctorPassword,
      role: 'provider',
      is_active: true,
    },
  });

  // 5. Crear proveedor (doctor)
  const doctorProvider = await prisma.providers.create({
    data: {
      user_id: doctorUser.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. Juan Pérez',
      description: 'Especialista en cardiología con más de 10 años de experiencia.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    },
  });

  // 6. Crear sucursal para el doctor
  const doctorBranch = await prisma.provider_branches.create({
    data: {
      provider_id: doctorProvider.id,
      city_id: quito.id,
      name: 'Consultorio Principal',
      description: 'Consultorio principal del Dr. Juan Pérez',
      address_text: 'Av. Principal 123, Quito',
      latitude: -0.1807,
      longitude: -78.4678,
      phone_contact: '+593 99 123 4567',
      email_contact: 'doctor@medicones.com',
      opening_hours_text: 'Lun-Vie: 9:00-17:00',
      is_24h: false,
      has_delivery: false,
      is_main: true,
      is_active: true,
    },
  });

  // 7. Crear horarios para la sucursal
  await prisma.provider_schedules.createMany({
    data: [
      { branch_id: doctorBranch.id, day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00' },
      { branch_id: doctorBranch.id, day_of_week: 2, start_time: '09:00:00', end_time: '17:00:00' },
      { branch_id: doctorBranch.id, day_of_week: 3, start_time: '09:00:00', end_time: '17:00:00' },
      { branch_id: doctorBranch.id, day_of_week: 4, start_time: '09:00:00', end_time: '17:00:00' },
      { branch_id: doctorBranch.id, day_of_week: 5, start_time: '09:00:00', end_time: '17:00:00' },
    ],
  });

  console.log('✅ Doctor creado con sucursal y horarios');

  // 8. Crear usuario farmacia
  const pharmacyPassword = await bcrypt.hash('farmacia123', 10);
  const pharmacyUser = await prisma.users.create({
    data: {
      email: 'farmacia@medicones.com',
      password_hash: pharmacyPassword,
      role: 'provider',
      is_active: true,
    },
  });

  // 9. Crear proveedor (farmacia)
  const pharmacyProvider = await prisma.providers.create({
    data: {
      user_id: pharmacyUser.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'Fybeca',
      logo_url: 'https://scalashopping.com/wp-content/uploads/2018/08/logo-Fybeca-01-1024x683.png',
      description: 'Somos parte de tu vida. Encuentra medicinas, productos de cuidado personal, belleza, maternidad y más.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    },
  });

  // 10. Crear sucursal para la farmacia
  const pharmacyBranch = await prisma.provider_branches.create({
    data: {
      provider_id: pharmacyProvider.id,
      city_id: quito.id,
      name: 'Fybeca - Sucursal Principal',
      address_text: 'Av. Amazonas N25 y Colón, Quito, Ecuador',
      latitude: -0.1807,
      longitude: -78.4678,
      phone_contact: '+593 99 123 4567',
      email_contact: 'farmacia@medicones.com',
      opening_hours_text: 'Lun-Dom: 8:00-22:00',
      is_24h: false,
      has_delivery: true,
      is_main: true,
      is_active: true,
    },
  });

  // 11. Crear horarios para la farmacia
  await prisma.provider_schedules.createMany({
    data: [
      { branch_id: pharmacyBranch.id, day_of_week: 1, start_time: '08:00:00', end_time: '22:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 2, start_time: '08:00:00', end_time: '22:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 3, start_time: '08:00:00', end_time: '22:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 4, start_time: '08:00:00', end_time: '22:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 5, start_time: '08:00:00', end_time: '22:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 6, start_time: '09:00:00', end_time: '21:00:00' },
      { branch_id: pharmacyBranch.id, day_of_week: 0, start_time: '10:00:00', end_time: '20:00:00' },
    ],
  });

  console.log('✅ Farmacia creada con sucursal y horarios');

  // 12. Crear más doctores
  const doctor2Password = await bcrypt.hash('doctor123', 10);
  const doctor2User = await prisma.users.create({
    data: {
      email: 'maria.gonzalez@medicones.com',
      password_hash: doctor2Password,
      role: 'provider',
      is_active: true,
    },
  });

  await prisma.providers.create({
    data: {
      user_id: doctor2User.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. María González',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    },
  });

  // Continuar con los demás usuarios y proveedores...

  // 13. Crear solicitudes pendientes
  await prisma.provider_requests.create({
    data: {
      provider_name: 'Dr. Roberto Sánchez',
      email: 'roberto.sanchez@email.com',
      service_type: 'doctor',
      submission_date: new Date('2024-01-25'),
      status: 'PENDING',
      phone: '+593 99 123 4567',
      whatsapp: '+593 99 123 4567',
      city: 'Ciudad de Quito',
      address: 'Av. Reforma 222, Consultorio 304',
      description: 'Especialista en Cardiología Intervencionista con más de 10 años de experiencia.',
      documents_count: 3,
    },
  });

  await prisma.provider_requests.create({
    data: {
      provider_name: 'Farmacia Santa Martha',
      email: 'contacto@santamartha.com',
      service_type: 'pharmacy',
      submission_date: new Date('2024-01-24'),
      status: 'APPROVED',
      phone: '+593 99 123 4567',
      whatsapp: '+593 99 123 4567',
      city: 'Quito',
      address: 'Calle Morelos 567, Centro',
      description: 'Farmacia con servicio 24 horas. Medicamentos genéricos y de patente.',
      documents_count: 5,
    },
  });

  await prisma.provider_requests.create({
    data: {
      provider_name: 'Laboratorio Clínico Vital',
      email: 'info@labvital.ec',
      service_type: 'laboratory',
      submission_date: new Date('2024-01-23'),
      status: 'REJECTED',
      phone: '+593 2 256 7890',
      whatsapp: '+593 99 123 4567',
      city: 'Quito',
      address: 'Av. Amazonas N24-12 y Mariscal Foch',
      description: 'Laboratorio de análisis clínicos de alta complejidad. Certificación ISO 9001.',
      documents_count: 4,
    },
  });

  console.log('✅ Solicitudes pendientes creadas');
  console.log('🎉 Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error al crear datos iniciales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Configurar Prisma Seed

En `package.json` del backend:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "scripts": {
    "seed": "prisma db seed"
  }
}
```

**Dependencias necesarias:**

```bash
npm install bcrypt @types/bcrypt ts-node typescript
```

**Ejecutar el seed:**

```bash
npx prisma db seed
```

---

## 📊 Mapeo de Datos Frontend → Base de Datos

### Usuarios

| Frontend | Base de Datos | Tabla | Notas |
|----------|---------------|-------|-------|
| `email` | `email` | `users` | Único |
| `password` | `password_hash` | `users` | Hash bcrypt |
| `name` | Se guarda en `providers.commercial_name` o `patients.full_name` | `providers`/`patients` | Depende del rol |
| `role` | `role` (enum) | `users` | `'admin' \| 'user' \| 'provider' \| 'patient'` |
| `tipo` | `category_id` (FK) | `providers` | Relación con `service_categories` |

### Proveedores

| Frontend | Base de Datos | Tabla | Tipo |
|----------|---------------|-------|------|
| `commercialName` | `commercial_name` | `providers` | VARCHAR(255) |
| `logoUrl` | `logo_url` | `providers` | VARCHAR(255) |
| `description` | `description` | `providers` | TEXT |
| `verificationStatus` | `verification_status` | `providers` | VARCHAR(255) / Enum |
| `commissionPercentage` | `commission_percentage` | `providers` | DECIMAL |

### Sucursales

| Frontend | Base de Datos | Tabla | Tipo |
|----------|---------------|-------|------|
| `name` | `name` | `provider_branches` | VARCHAR(255) |
| `address` | `address_text` | `provider_branches` | TEXT |
| `latitude` | `latitude` | `provider_branches` | FLOAT |
| `longitude` | `longitude` | `provider_branches` | FLOAT |
| `phone` | `phone_contact` | `provider_branches` | VARCHAR(20) |
| `email` | `email_contact` | `provider_branches` | VARCHAR(255) |
| `openingHours` | `opening_hours_text` | `provider_branches` | TEXT |
| `is24h` | `is_24h` | `provider_branches` | BOOLEAN |
| `hasDelivery` | `has_delivery` | `provider_branches` | BOOLEAN |

### Horarios

| Frontend | Base de Datos | Tabla | Conversión |
|----------|---------------|-------|------------|
| `day` (string) | `day_of_week` (int) | `provider_schedules` | Ver tabla abajo |
| `startTime` (HH:mm) | `start_time` (TIME) | `provider_schedules` | Formato: `'09:00:00'` |
| `endTime` (HH:mm) | `end_time` (TIME) | `provider_schedules` | Formato: `'17:00:00'` |

**Conversión de días de la semana:**
- `"monday"` → `1`
- `"tuesday"` → `2`
- `"wednesday"` → `3`
- `"thursday"` → `4`
- `"friday"` → `5`
- `"saturday"` → `6`
- `"sunday"` → `0`

---

## ⚠️ Consideraciones Importantes para la Base de Datos

### 1. Hasheo de Contraseñas
- **NUNCA** insertar contraseñas en texto plano
- Usar bcrypt con salt rounds 10
- Ejemplo: `await bcrypt.hash('admin123', 10)`
- El hash resultante se guarda en `password_hash`

### 2. UUIDs
- Todos los IDs deben ser UUIDs generados
- En PostgreSQL: `gen_random_uuid()`
- En Prisma: se generan automáticamente si están configurados como `@default(uuid())`
- **NO usar** los IDs simples del frontend (`"doctor-1"`, `"pharmacy-1"`, etc.)

### 3. Relaciones (Foreign Keys)
- Verificar que las foreign keys existan antes de insertar
- Usar transacciones para mantener integridad referencial
- Orden de inserción:
  1. `cities`
  2. `service_categories`
  3. `users`
  4. `providers` (requiere `user_id` y `category_id`)
  5. `provider_branches` (requiere `provider_id` y `city_id`)
  6. `provider_schedules` (requiere `branch_id`)
  7. `provider_requests` (independiente)

### 4. Fechas
- Usar formato ISO 8601: `2024-01-15T10:00:00Z`
- En PostgreSQL: `TIMESTAMP` o `TIMESTAMPTZ`
- En Prisma: `DateTime`
- Para fechas sin hora: usar `DATE` (ej: `birthDate`)

### 5. Enums
- Verificar que los valores coincidan con los enums definidos en Prisma
- `role`: `'admin' | 'user' | 'provider' | 'patient'`
- `verification_status`: `'PENDING' | 'APPROVED' | 'REJECTED'`
- `enum_appt_status`: `'CONFIRMED' | 'CANCELLED' | 'COMPLETED'`

### 6. Decimales
- Usar tipo `DECIMAL` para precios y porcentajes
- Ejemplo: `50.00` (no `50`)
- En Prisma: `Decimal` type
- En PostgreSQL: `DECIMAL(10, 2)` o similar

### 7. Textos Largos
- Usar `TEXT` para descripciones largas
- No usar `VARCHAR` con límite pequeño para campos que pueden ser largos

---

## 📋 Checklist de Inserción en Base de Datos

- [ ] Crear ciudades (Quito, Guayaquil, Cuenca) en tabla `cities`
- [ ] Crear categorías de servicio (5 categorías) en tabla `service_categories`
- [ ] Crear usuarios administradores (2) en tabla `users` con contraseñas hasheadas
- [ ] Crear usuarios proveedores (17) en tabla `users` con contraseñas hasheadas
- [ ] Crear perfiles de proveedores (17) en tabla `providers` con relaciones correctas
- [ ] Crear sucursales para cada proveedor en tabla `provider_branches`
- [ ] Crear horarios para cada sucursal en tabla `provider_schedules`
- [ ] Crear detalles bancarios si aplica en tabla `provider_bank_details`
- [ ] Crear solicitudes pendientes (5) en tabla `provider_requests`
- [ ] Verificar todas las relaciones foreign keys
- [ ] Probar login con cada usuario creado
- [ ] Verificar que los datos se muestren correctamente en el frontend

---

## 🔄 Orden de Ejecución del Seed

1. **Ciudades** → `cities`
2. **Categorías** → `service_categories`
3. **Usuarios** → `users` (todos los usuarios)
4. **Proveedores** → `providers` (para cada usuario provider)
5. **Sucursales** → `provider_branches` (al menos una por proveedor)
6. **Horarios** → `provider_schedules` (para cada sucursal)
7. **Detalles Bancarios** → `provider_bank_details` (opcional)
8. **Solicitudes** → `provider_requests` (solicitudes pendientes)

---

**Última actualización:** 2024-01-XX
