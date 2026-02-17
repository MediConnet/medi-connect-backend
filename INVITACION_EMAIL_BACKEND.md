# 📋 Especificación Técnica: Sistema de Invitación por Email para Panel de Clínica

## 🎯 Resumen

Se implementó una funcionalidad en el panel de clínica que permite generar links de invitación para médicos y abrir el cliente de correo del usuario para enviar la invitación manualmente.

**Flujo:**
1. El admin de clínica hace clic en "Invitar por Email"
2. Ingresa el email del médico
3. El sistema genera un link de invitación único
4. El link se copia automáticamente al portapapeles
5. Se abre el cliente de correo predeterminado (Gmail, Outlook, etc.)
6. El admin escribe el mensaje, pega el link y envía el correo

---

## 🔌 Endpoint Requerido

El frontend ya está consumiendo este endpoint. Solo necesitamos asegurarnos de que funcione correctamente:

### **POST `/api/clinics/doctors/invite/link`**

**Propósito:** Generar un link de invitación único para un médico específico

**Request Body:**
```json
{
  "email": "doctor@example.com"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "invitationLink": "https://tu-dominio.com/clinic/invite/abc123xyz789",
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

**Campos de respuesta:**
- `invitationLink` (string, requerido): URL completa del link de invitación que el médico usará para registrarse
- `expiresAt` (string, requerido): Fecha de expiración del link en formato ISO 8601

---

## 📝 Requisitos del Backend

### 1. **Generación del Link**
- El link debe ser único para cada email/clínica
- Debe incluir un token único y seguro
- El formato recomendado: `https://tu-dominio.com/clinic/invite/{token}`
- El token debe ser difícil de adivinar (UUID, hash seguro, etc.)

### 2. **Validación**
- Validar que el email sea válido
- Validar que el usuario que hace la solicitud tenga permisos de clínica
- Validar que la clínica exista y esté activa

### 3. **Expiración**
- El link debe tener una fecha de expiración (recomendado: 7 días)
- La fecha debe estar en formato ISO 8601

### 4. **Asociación**
- El link debe estar asociado al email del médico
- El link debe estar asociado a la clínica que lo genera
- Debe guardarse en la base de datos para validación posterior

---

## 🔄 Flujo Completo

### Frontend → Backend
1. Usuario ingresa email del médico
2. Frontend llama a `POST /api/clinics/doctors/invite/link` con el email
3. Backend genera token único y crea el link
4. Backend guarda la invitación en la base de datos
5. Backend retorna el link y fecha de expiración

### Backend → Frontend
1. Frontend recibe el link
2. Frontend copia el link al portapapeles
3. Frontend abre el cliente de correo del usuario
4. Usuario escribe el mensaje y pega el link
5. Usuario envía el correo manualmente

### Validación del Link (cuando el médico hace clic)
1. Médico hace clic en el link
2. Frontend llama a `GET /api/clinics/invite/{token}` (ya existe)
3. Backend valida el token y retorna información de la invitación
4. Médico completa su registro

---

## ✅ Checklist para Backend

- [ ] Verificar que `POST /api/clinics/doctors/invite/link` existe y funciona
- [ ] Validar que el endpoint requiere autenticación de clínica
- [ ] Verificar que genera tokens únicos y seguros
- [ ] Confirmar que guarda la invitación en la base de datos
- [ ] Verificar que retorna el formato esperado: `{ success: boolean, data: { invitationLink: string, expiresAt: string } }`
- [ ] Confirmar que el link tiene fecha de expiración (recomendado: 7 días)
- [ ] Verificar que el link está asociado al email y a la clínica

---

## 🔗 Endpoints Relacionados (Ya Existentes)

Estos endpoints ya están implementados y funcionando, solo los mencionamos para contexto:

### `GET /api/clinics/invite/{token}`
- Valida el token de invitación
- Retorna información de la clínica y el email asociado

### `POST /api/clinics/invite/{token}/accept`
- Acepta la invitación y crea el registro del médico

---

## 🚀 Mejoras Futuras (Opcional)

Si quieren mejorar la experiencia, podrían implementar:

1. **Límite de invitaciones:**
   - Limitar número de invitaciones por clínica por día
   - Prevenir spam de invitaciones

2. **Tracking de invitaciones:**
   - Saber cuántas invitaciones se han enviado
   - Saber cuántas han sido aceptadas
   - Saber cuántas han expirado

3. **Reenvío de invitaciones:**
   - Permitir regenerar link si el anterior expiró
   - Invalidar links anteriores al generar uno nuevo

4. **Notificaciones:**
   - Notificar al admin cuando un médico acepta la invitación
   - Recordar invitaciones pendientes

---

## 📝 Notas Técnicas

- **Seguridad:** El token debe ser único, aleatorio y difícil de adivinar
- **Expiración:** Recomendamos 7 días, pero puede ser configurable
- **Formato del link:** Debe ser una URL completa y accesible desde el frontend
- **Base de datos:** Guardar: `token`, `email`, `clinicId`, `createdAt`, `expiresAt`, `status` (pending/accepted/expired)

---

## 🐛 Troubleshooting

Si el link no se genera:

1. Verificar que el endpoint existe y está accesible
2. Verificar que el usuario tiene permisos de clínica
3. Verificar que el email es válido
4. Revisar logs del backend para errores
5. Verificar que la respuesta tiene el formato correcto

Si el link no funciona cuando el médico hace clic:

1. Verificar que el token existe en la base de datos
2. Verificar que el link no ha expirado
3. Verificar que el endpoint `GET /api/clinics/invite/{token}` funciona
4. Revisar que el token en la URL coincide con el guardado

---

## 📞 Contacto

Si tienen preguntas sobre la implementación del frontend o necesitan ajustar algo, pueden contactar al equipo de frontend.

**Fecha de implementación:** $(date)
**Versión:** 1.0.0
