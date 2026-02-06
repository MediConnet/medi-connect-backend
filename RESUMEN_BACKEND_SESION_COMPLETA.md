# Resumen para Backend - Sesión Completa de Trabajo

## Fecha: 2026-02-06

---

## 📋 ÍNDICE DE FUNCIONALIDADES IMPLEMENTADAS

1. ✅ **Adjuntar PDFs en Perfil del Médico** (Educación y Certificaciones)
2. ✅ **Ver Perfil del Médico desde Panel de Clínica** (con PDFs)

---

## 1️⃣ ADJUNTAR PDFs EN PERFIL DEL MÉDICO

### 📝 Descripción
Los médicos asociados a clínicas ahora pueden adjuntar archivos PDF a sus estudios de educación y certificaciones en su perfil profesional.

### 🎯 Funcionalidad Frontend
- Campo de texto para descripción (opcional)
- Botón "Adjuntar PDF" que abre selector de archivos
- **Auto-agregado:** Al seleccionar PDF, se agrega automáticamente a la lista
- Validaciones: Solo PDF, máximo 5MB
- Conversión a Base64 para almacenamiento
- PDFs clickeables para ver/descargar

### 🔧 Lo que necesita el Backend

#### A. Actualizar Estructura de Datos

**Tabla: `doctor_profiles`**
```sql
-- Opción 1: Usar JSONB (Recomendado para PostgreSQL)
ALTER TABLE doctor_profiles
ADD COLUMN education JSONB,
ADD COLUMN certifications JSONB;

-- Ejemplo de datos:
{
  "education": [
    {
      "text": "Universidad Central del Ecuador - Medicina",
      "fileUrl": "https://s3.../titulo_medicina.pdf",
      "fileName": "titulo_medicina.pdf"
    },
    {
      "text": "Especialización en Cardiología"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Ecocardiografía",
      "fileUrl": "https://s3.../certificado_eco.pdf",
      "fileName": "certificado_eco.pdf"
    }
  ]
}
```

**Opción 2: Tablas separadas (Más normalizado)**
```sql
CREATE TABLE doctor_education (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE doctor_certifications (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### B. Endpoint para Subir PDFs

**Endpoint:**
```
POST /api/doctors/{doctorId}/documents/upload
```

**Request (multipart/form-data):**
```
Content-Type: multipart/form-data

file: [archivo PDF]
type: "education" | "certification"
text: "Universidad Central del Ecuador - Medicina"
```

**Validaciones:**
- ✅ Tipo de archivo: `application/pdf`
- ✅ Tamaño máximo: 5MB
- ✅ Usuario autenticado es el médico dueño del perfil
- ✅ Texto no vacío

**Proceso:**
1. Validar archivo (tipo, tamaño)
2. Generar nombre único: `{doctorId}_{timestamp}_{filename}.pdf`
3. Subir a S3: `documents/doctors/{doctorId}/{filename}`
4. Guardar en BD: texto + URL de S3 + nombre archivo
5. Retornar URL firmada (expiración 1 hora)

**Response (200):**
```json
{
  "id": "edu-123",
  "text": "Universidad Central del Ecuador - Medicina",
  "fileUrl": "https://s3.amazonaws.com/bucket/documents/doctors/123/titulo.pdf",
  "fileName": "titulo_medicina.pdf",
  "createdAt": "2024-02-06T15:30:00Z"
}
```

**Response Error (400):**
```json
{
  "error": "Invalid file",
  "message": "Solo se permiten archivos PDF de máximo 5MB"
}
```

#### C. Endpoint para Actualizar Perfil del Médico

**Endpoint:**
```
PUT /api/doctors/{doctorId}/profile
```

**Request:**
```json
{
  "bio": "Cardiólogo con más de 15 años de experiencia...",
  "experience": 15,
  "specialty": "Cardiología",
  "phone": "0991234567",
  "whatsapp": "0991234567",
  "education": [
    {
      "text": "Universidad Central del Ecuador - Medicina",
      "fileUrl": "https://s3.../titulo.pdf",
      "fileName": "titulo_medicina.pdf"
    },
    {
      "text": "Especialización en Cardiología"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Ecocardiografía",
      "fileUrl": "https://s3.../certificado.pdf",
      "fileName": "certificado_eco.pdf"
    }
  ]
}
```

**Response (200):**
```json
{
  "message": "Perfil actualizado correctamente",
  "profile": { ... }
}
```

#### D. Configuración de S3

**Bucket:** `mediconnect-documents`

**Estructura de carpetas:**
```
mediconnect-documents/
├── documents/
│   ├── doctors/
│   │   ├── doctor-123/
│   │   │   ├── 1707234567_titulo_medicina.pdf
│   │   │   ├── 1707234568_certificado_eco.pdf
│   │   │   └── ...
│   │   └── doctor-456/
│   │       └── ...
```

**Permisos:**
- Privado por defecto
- Acceso solo con URLs firmadas
- Expiración: 1 hora

**Código de ejemplo (Node.js):**
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Subir archivo
async function uploadDocument(file, doctorId, type) {
  const timestamp = Date.now();
  const key = `documents/doctors/${doctorId}/${timestamp}_${file.originalname}`;
  
  const params = {
    Bucket: 'mediconnect-documents',
    Key: key,
    Body: file.buffer,
    ContentType: 'application/pdf',
    ACL: 'private'
  };
  
  await s3.upload(params).promise();
  
  // Generar URL firmada
  const signedUrl = s3.getSignedUrl('getObject', {
    Bucket: 'mediconnect-documents',
    Key: key,
    Expires: 3600 // 1 hora
  });
  
  return {
    fileUrl: `https://mediconnect-documents.s3.amazonaws.com/${key}`,
    signedUrl: signedUrl,
    fileName: file.originalname
  };
}
```

---

## 2️⃣ VER PERFIL DEL MÉDICO DESDE PANEL DE CLÍNICA

### 📝 Descripción
La clínica puede ver el perfil completo de sus médicos asociados, incluyendo toda la información profesional y los documentos PDF que el médico haya subido.

### 🎯 Funcionalidad Frontend
- Botón "Ver Perfil" (ícono de ojo 👁️) en tabla de médicos
- Modal que muestra:
  - Información de contacto
  - Descripción profesional
  - Años de experiencia
  - Educación con PDFs
  - Certificaciones con PDFs
- PDFs clickeables para ver/descargar
- Solo lectura (clínica NO puede editar)

### 🔧 Lo que necesita el Backend

#### A. Endpoint para Obtener Perfil Completo

**Endpoint:**
```
GET /api/clinics/{clinicId}/doctors/{doctorId}/profile
```

**Headers:**
```
Authorization: Bearer {token_de_clinica}
```

**Validaciones:**
- ✅ Usuario autenticado es una clínica
- ✅ El médico pertenece a esa clínica (`doctor.clinicId === clinicId`)
- ✅ Token válido

**Response (200):**
```json
{
  "id": "doctor-1",
  "clinicId": "clinic-1",
  "userId": "user-123",
  "email": "dr.juan.perez@clinicacentral.com",
  "name": "Dr. Juan Pérez",
  "specialty": "Cardiología",
  "isActive": true,
  "officeNumber": "101",
  "consultationFee": 50.00,
  "profileImageUrl": "https://s3.amazonaws.com/bucket/profiles/doctor-1.jpg",
  "phone": "0991234567",
  "whatsapp": "0991234567",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-02-06T15:30:00Z",
  "professionalProfile": {
    "bio": "Cardiólogo con más de 15 años de experiencia en el diagnóstico y tratamiento de enfermedades cardiovasculares.",
    "experience": 15,
    "education": [
      {
        "text": "Universidad Central del Ecuador - Medicina",
        "fileUrl": "https://s3.amazonaws.com/bucket/documents/titulo_medicina.pdf",
        "fileName": "titulo_medicina.pdf"
      },
      {
        "text": "Especialización en Cardiología - Hospital Metropolitano"
      }
    ],
    "certifications": [
      {
        "text": "Certificación en Ecocardiografía",
        "fileUrl": "https://s3.amazonaws.com/bucket/documents/certificado_eco.pdf",
        "fileName": "certificado_eco.pdf"
      },
      {
        "text": "Certificación en Cardiología Intervencionista"
      }
    ]
  }
}
```

**Notas importantes:**
- `education` y `certifications` pueden contener:
  - **Strings simples:** `"Universidad Central del Ecuador"`
  - **Objetos con PDF:** `{ text: "...", fileUrl: "...", fileName: "..." }`
- Los campos `fileUrl` y `fileName` son **opcionales**
- Si no hay PDF, solo enviar el string o el objeto sin `fileUrl`/`fileName`

**Response Error (404):**
```json
{
  "error": "Doctor not found",
  "message": "El médico no existe o no pertenece a esta clínica"
}
```

**Response Error (403):**
```json
{
  "error": "Forbidden",
  "message": "No tienes permiso para ver este perfil"
}
```

#### B. Generar URLs Firmadas para PDFs

Cuando la clínica solicita el perfil, el backend debe:

1. Obtener los datos del médico de la BD
2. Para cada PDF en `education` y `certifications`:
   - Generar URL firmada de S3 (expiración 1 hora)
   - Reemplazar la URL permanente con la URL firmada
3. Retornar el perfil con URLs firmadas

**Código de ejemplo:**
```javascript
async function getDoctorProfileForClinic(clinicId, doctorId) {
  // 1. Verificar que el médico pertenece a la clínica
  const doctor = await Doctor.findOne({
    where: { id: doctorId, clinicId: clinicId }
  });
  
  if (!doctor) {
    throw new Error('Doctor not found');
  }
  
  // 2. Obtener perfil profesional
  const profile = await DoctorProfile.findOne({
    where: { doctorId: doctorId }
  });
  
  // 3. Generar URLs firmadas para PDFs
  if (profile.education) {
    profile.education = await Promise.all(
      profile.education.map(async (edu) => {
        if (edu.fileUrl) {
          const signedUrl = await generateSignedUrl(edu.fileUrl);
          return { ...edu, fileUrl: signedUrl };
        }
        return edu;
      })
    );
  }
  
  if (profile.certifications) {
    profile.certifications = await Promise.all(
      profile.certifications.map(async (cert) => {
        if (cert.fileUrl) {
          const signedUrl = await generateSignedUrl(cert.fileUrl);
          return { ...cert, fileUrl: signedUrl };
        }
        return cert;
      })
    );
  }
  
  return {
    ...doctor.toJSON(),
    professionalProfile: profile
  };
}

function generateSignedUrl(s3Url) {
  // Extraer key de la URL de S3
  const key = s3Url.replace('https://mediconnect-documents.s3.amazonaws.com/', '');
  
  return s3.getSignedUrl('getObject', {
    Bucket: 'mediconnect-documents',
    Key: key,
    Expires: 3600 // 1 hora
  });
}
```

---

## 📊 RESUMEN DE ENDPOINTS NECESARIOS

### Para el Médico:
1. ✅ `POST /api/doctors/{doctorId}/documents/upload` - Subir PDF
2. ✅ `PUT /api/doctors/{doctorId}/profile` - Actualizar perfil completo
3. ✅ `GET /api/doctors/{doctorId}/profile` - Obtener su propio perfil

### Para la Clínica:
1. ✅ `GET /api/clinics/{clinicId}/doctors/{doctorId}/profile` - Ver perfil del médico

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS RECOMENDADA

### Opción 1: JSONB (PostgreSQL)
```sql
-- Tabla principal de médicos
CREATE TABLE clinic_doctors (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id),
  user_id INTEGER REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  specialty VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  office_number VARCHAR(50),
  consultation_fee DECIMAL(10, 2),
  profile_image_url TEXT,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de perfiles profesionales
CREATE TABLE doctor_profiles (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE,
  bio TEXT,
  experience INTEGER,
  education JSONB, -- Array de objetos con text, fileUrl, fileName
  certifications JSONB, -- Array de objetos con text, fileUrl, fileName
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Opción 2: Tablas Normalizadas
```sql
-- Tabla principal de médicos (igual que arriba)
CREATE TABLE clinic_doctors ( ... );

-- Tabla de perfiles profesionales
CREATE TABLE doctor_profiles (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE,
  bio TEXT,
  experience INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de educación
CREATE TABLE doctor_education (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de certificaciones
CREATE TABLE doctor_certifications (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 SEGURIDAD Y VALIDACIONES

### Validaciones de Archivos:
- ✅ Tipo MIME: `application/pdf`
- ✅ Tamaño máximo: 5MB (5 * 1024 * 1024 bytes)
- ✅ Extensión: `.pdf`
- ✅ Nombre de archivo sanitizado (sin caracteres especiales)

### Validaciones de Permisos:
- ✅ Solo el médico puede subir/editar su perfil
- ✅ Solo la clínica dueña puede ver perfiles de sus médicos
- ✅ URLs de S3 firmadas con expiración
- ✅ Tokens JWT válidos

### Validaciones de Datos:
- ✅ `text` no vacío (mínimo 3 caracteres)
- ✅ `experience` >= 0
- ✅ `bio` máximo 500 caracteres
- ✅ `phone` y `whatsapp` formato válido (10 dígitos)

---

## 🧪 DATOS DE PRUEBA

### Clínica de Prueba:
```
ID: clinic-1
Email: clinic@medicones.com
Password: clinic123
Nombre: Clínica Central
```

### Médicos de Prueba:
```
1. Dr. Juan Pérez
   ID: doctor-clinic-central-1
   Email: dr.juan.perez@clinicacentral.com
   Password: doctor123
   Specialty: Cardiología
   Clinic: clinic-1
   Office: 101
   Fee: $50.00

2. Dra. María García
   ID: doctor-clinic-central-2
   Email: dra.maria.garcia@clinicacentral.com
   Password: doctor123
   Specialty: Pediatría
   Clinic: clinic-1
   Office: 102
   Fee: $45.00
```

---

## 📝 EJEMPLOS DE REQUESTS

### 1. Médico sube PDF de educación
```bash
curl -X POST \
  'http://localhost:3000/api/doctors/doctor-1/documents/upload' \
  -H 'Authorization: Bearer {token_medico}' \
  -F 'file=@titulo_medicina.pdf' \
  -F 'type=education' \
  -F 'text=Universidad Central del Ecuador - Medicina'
```

### 2. Médico actualiza su perfil
```bash
curl -X PUT \
  'http://localhost:3000/api/doctors/doctor-1/profile' \
  -H 'Authorization: Bearer {token_medico}' \
  -H 'Content-Type: application/json' \
  -d '{
    "bio": "Cardiólogo con más de 15 años de experiencia...",
    "experience": 15,
    "specialty": "Cardiología",
    "phone": "0991234567",
    "whatsapp": "0991234567",
    "education": [
      {
        "text": "Universidad Central del Ecuador - Medicina",
        "fileUrl": "https://s3.../titulo.pdf",
        "fileName": "titulo_medicina.pdf"
      }
    ],
    "certifications": [
      {
        "text": "Certificación en Ecocardiografía",
        "fileUrl": "https://s3.../certificado.pdf",
        "fileName": "certificado_eco.pdf"
      }
    ]
  }'
```

### 3. Clínica ve perfil del médico
```bash
curl -X GET \
  'http://localhost:3000/api/clinics/clinic-1/doctors/doctor-1/profile' \
  -H 'Authorization: Bearer {token_clinica}'
```

---

## ⚙️ CONFIGURACIÓN DE AWS S3

### Variables de Entorno:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=mediconnect-documents
```

### Política de Bucket (Bucket Policy):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAuthenticatedAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_ROLE"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::mediconnect-documents/documents/*"
    }
  ]
}
```

### CORS Configuration:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## 🚀 PRIORIDADES DE IMPLEMENTACIÓN

### Alta Prioridad:
1. ✅ Endpoint para actualizar perfil del médico
2. ✅ Endpoint para subir PDFs
3. ✅ Configuración de S3
4. ✅ Endpoint para que clínica vea perfil

### Media Prioridad:
1. ⏳ Generación de URLs firmadas
2. ⏳ Validaciones de archivos
3. ⏳ Manejo de errores

### Baja Prioridad:
1. ⏳ Historial de versiones de PDFs
2. ⏳ Compresión de PDFs
3. ⏳ CDN para servir documentos

---

## 📞 CONTACTO Y DUDAS

Si tienes dudas sobre la implementación:
1. Revisa los documentos detallados:
   - `MENSAJE_BACKEND_VER_PERFIL_MEDICO.md`
   - `ADJUNTAR_PDF_EDUCACION_CERTIFICACIONES.md`
2. Prueba los endpoints con los datos de prueba
3. Verifica que las URLs firmadas funcionen correctamente

---

**Resumen:** Frontend 100% completado. Backend necesita implementar 4 endpoints principales y configurar S3 para almacenamiento de PDFs.

**Tiempo estimado:** 6-8 horas de desarrollo backend
**Complejidad:** Media
**Dependencias:** AWS S3, Sistema de autenticación JWT
