# 📋 RESUMEN COMPLETO PARA BACKEND - Sesión 06/02/2026

## 🎯 Introducción

Este documento consolida **TODAS** las funcionalidades implementadas hoy en el frontend que requieren soporte del backend. El frontend está 100% completado y funcionando con mocks. Solo falta la integración con el backend real.

---

## 📑 ÍNDICE

1. [Funcionalidad 1: Adjuntar PDFs en Perfil del Médico](#funcionalidad-1)
2. [Funcionalidad 2: Ver Perfil del Médico desde Panel de Clínica](#funcionalidad-2)
3. [Estructura de Base de Datos](#base-de-datos)
4. [Configuración AWS S3](#aws-s3)
5. [Endpoints Resumen](#endpoints-resumen)
6. [Datos de Prueba](#datos-prueba)
7. [Ejemplos de Código](#ejemplos-codigo)

---

<a name="funcionalidad-1"></a>
## 1️⃣ FUNCIONALIDAD 1: Adjuntar PDFs en Perfil del Médico

### 📝 Descripción
Los médicos asociados a clínicas pueden adjuntar archivos PDF a sus estudios de educación y certificaciones en su perfil profesional.

### 🎯 Comportamiento Frontend
- Campo de texto para descripción (opcional)
- Botón "Adjuntar PDF" que abre selector de archivos
- **Auto-agregado:** Al seleccionar PDF, se agrega automáticamente
- Validaciones: Solo PDF, máximo 5MB
- Conversión a Base64 para almacenamiento temporal
- PDFs clickeables para ver/descargar

### 🔧 Endpoints Necesarios

#### A. Subir PDF

**Endpoint:**
```
POST /api/doctors/{doctorId}/documents/upload
```

**Headers:**
```
Authorization: Bearer {token_medico}
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
file: [archivo PDF]
type: "education" | "certification"
text: "Universidad Central del Ecuador - Medicina"
```

**Validaciones:**
- ✅ Tipo MIME: `application/pdf`
- ✅ Tamaño máximo: 5MB (5 * 1024 * 1024 bytes)
- ✅ Usuario autenticado es el médico dueño del perfil
- ✅ Campo `text` no vacío (mínimo 3 caracteres)
- ✅ Campo `type` debe ser "education" o "certification"

**Proceso Backend:**
1. Validar archivo (tipo, tamaño)
2. Generar nombre único: `{doctorId}_{timestamp}_{filename}.pdf`
3. Subir a S3: `documents/doctors/{doctorId}/{filename}`
4. Guardar en BD: texto + URL de S3 + nombre archivo
5. Retornar información del documento

**Response Exitoso (200):**
```json
{
  "id": "edu-123",
  "text": "Universidad Central del Ecuador - Medicina",
  "fileUrl": "https://mediconnect-documents.s3.amazonaws.com/documents/doctors/123/1707234567_titulo.pdf",
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

**Response Error (401):**
```json
{
  "error": "Unauthorized",
  "message": "No tienes permiso para subir documentos"
}
```

---

#### B. Actualizar Perfil Completo del Médico

**Endpoint:**
```
PUT /api/doctors/{doctorId}/profile
```

**Headers:**
```
Authorization: Bearer {token_medico}
Content-Type: application/json
```

**Request Body:**
```json
{
  "bio": "Cardiólogo con más de 15 años de experiencia en el diagnóstico y tratamiento de enfermedades cardiovasculares.",
  "experience": 15,
  "specialty": "Cardiología",
  "phone": "0991234567",
  "whatsapp": "0991234567",
  "education": [
    {
      "text": "Universidad Central del Ecuador - Medicina",
      "fileUrl": "https://s3.amazonaws.com/.../titulo_medicina.pdf",
      "fileName": "titulo_medicina.pdf"
    },
    {
      "text": "Especialización en Cardiología - Hospital Metropolitano"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Ecocardiografía",
      "fileUrl": "https://s3.amazonaws.com/.../certificado_eco.pdf",
      "fileName": "certificado_eco.pdf"
    },
    {
      "text": "Certificación en Cardiología Intervencionista"
    }
  ]
}
```

**IMPORTANTE:** 
- Los arrays `education` y `certifications` pueden contener:
  - **Strings simples:** `"Universidad Central del Ecuador"`
  - **Objetos con PDF:** `{ text: "...", fileUrl: "...", fileName: "..." }`
- Los campos `fileUrl` y `fileName` son **opcionales**

**Validaciones:**
- ✅ Usuario autenticado es el médico
- ✅ `bio` máximo 500 caracteres
- ✅ `experience` >= 0
- ✅ `phone` y `whatsapp` formato válido (10 dígitos)
- ✅ Cada ítem de `education` y `certifications` debe tener `text`

**Response Exitoso (200):**
```json
{
  "message": "Perfil actualizado correctamente",
  "profile": {
    "id": "doctor-1",
    "bio": "Cardiólogo con más de 15 años...",
    "experience": 15,
    "specialty": "Cardiología",
    "phone": "0991234567",
    "whatsapp": "0991234567",
    "education": [...],
    "certifications": [...],
    "updatedAt": "2024-02-06T15:30:00Z"
  }
}
```

---

<a name="funcionalidad-2"></a>
## 2️⃣ FUNCIONALIDAD 2: Ver Perfil del Médico desde Panel de Clínica

### 📝 Descripción
La clínica puede ver el perfil completo de sus médicos asociados, incluyendo toda la información profesional y los documentos PDF que el médico haya subido.

### 🎯 Comportamiento Frontend
- Botón "Ver Perfil" (ícono de ojo 👁️) en tabla de médicos
- Modal que muestra:
  - Información de contacto (email, teléfono, WhatsApp, consultorio)
  - Descripción profesional y años de experiencia
  - Educación con PDFs adjuntos
  - Certificaciones con PDFs adjuntos
- PDFs clickeables para ver/descargar
- **Solo lectura** (clínica NO puede editar)

### 🔧 Endpoint Necesario

**Endpoint:**
```
GET /api/clinics/{clinicId}/doctors/{doctorId}/profile
```

**Headers:**
```
Authorization: Bearer {token_clinica}
```

**Validaciones:**
- ✅ Usuario autenticado es una clínica
- ✅ El médico pertenece a esa clínica (`doctor.clinicId === clinicId`)
- ✅ Token JWT válido

**Response Exitoso (200):**
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
        "fileUrl": "https://s3.amazonaws.com/.../titulo_medicina.pdf",
        "fileName": "titulo_medicina.pdf"
      },
      {
        "text": "Especialización en Cardiología - Hospital Metropolitano"
      }
    ],
    "certifications": [
      {
        "text": "Certificación en Ecocardiografía",
        "fileUrl": "https://s3.amazonaws.com/.../certificado_eco.pdf",
        "fileName": "certificado_eco.pdf"
      },
      {
        "text": "Certificación en Cardiología Intervencionista"
      }
    ]
  }
}
```

**CRÍTICO:** Las URLs de los PDFs deben ser **URLs firmadas de S3** con expiración de 1 hora para seguridad.

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

---

<a name="base-de-datos"></a>
## 3️⃣ ESTRUCTURA DE BASE DE DATOS

### Opción 1: JSONB (Recomendada para PostgreSQL)

```sql
-- Tabla principal de médicos asociados a clínicas
CREATE TABLE clinic_doctors (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
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
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE UNIQUE,
  bio TEXT,
  experience INTEGER DEFAULT 0,
  education JSONB, -- Array de objetos: [{text, fileUrl?, fileName?}]
  certifications JSONB, -- Array de objetos: [{text, fileUrl?, fileName?}]
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX idx_clinic_doctors_clinic_id ON clinic_doctors(clinic_id);
CREATE INDEX idx_clinic_doctors_email ON clinic_doctors(email);
CREATE INDEX idx_doctor_profiles_doctor_id ON doctor_profiles(doctor_id);
```

**Ejemplo de datos JSONB:**
```json
{
  "education": [
    {
      "text": "Universidad Central del Ecuador - Medicina",
      "fileUrl": "https://s3.amazonaws.com/.../titulo.pdf",
      "fileName": "titulo_medicina.pdf"
    },
    {
      "text": "Especialización en Cardiología"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Ecocardiografía",
      "fileUrl": "https://s3.amazonaws.com/.../certificado.pdf",
      "fileName": "certificado_eco.pdf"
    }
  ]
}
```

---

### Opción 2: Tablas Normalizadas (Más estructurado)

```sql
-- Tabla principal de médicos (igual que arriba)
CREATE TABLE clinic_doctors ( ... );

-- Tabla de perfiles profesionales (sin JSONB)
CREATE TABLE doctor_profiles (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES clinic_doctors(id) ON DELETE CASCADE UNIQUE,
  bio TEXT,
  experience INTEGER DEFAULT 0,
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

-- Índices
CREATE INDEX idx_doctor_education_doctor_id ON doctor_education(doctor_id);
CREATE INDEX idx_doctor_certifications_doctor_id ON doctor_certifications(doctor_id);
```

**Recomendación:** Usar **Opción 1 (JSONB)** por simplicidad y flexibilidad.

---

<a name="aws-s3"></a>
## 4️⃣ CONFIGURACIÓN AWS S3

### 📦 Bucket y Estructura

**Nombre del Bucket:** `mediconnect-documents`

**Estructura de carpetas:**
```
mediconnect-documents/
├── documents/
│   ├── doctors/
│   │   ├── doctor-123/
│   │   │   ├── 1707234567_titulo_medicina.pdf
│   │   │   ├── 1707234568_certificado_eco.pdf
│   │   │   └── 1707234569_especializacion.pdf
│   │   ├── doctor-456/
│   │   │   └── ...
│   │   └── ...
```

### 🔐 Configuración de Seguridad

**Permisos del Bucket:**
- Privado por defecto
- Acceso solo con URLs firmadas
- Expiración de URLs: 1 hora (3600 segundos)

**Variables de Entorno:**
```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=mediconnect-documents
```

**Política de Bucket (Bucket Policy):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAuthenticatedAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_BACKEND_ROLE"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::mediconnect-documents/documents/*"
    }
  ]
}
```

**Configuración CORS:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 🔑 Validaciones de Archivos

**Antes de subir a S3:**
- ✅ Tipo MIME: `application/pdf`
- ✅ Tamaño máximo: 5MB (5 * 1024 * 1024 bytes)
- ✅ Extensión: `.pdf`
- ✅ Nombre de archivo sanitizado (sin caracteres especiales)
- ✅ Generar nombre único con timestamp

**Formato de nombre de archivo:**
```
{doctorId}_{timestamp}_{sanitized_filename}.pdf

Ejemplo:
doctor-123_1707234567_titulo_medicina.pdf
```

---

<a name="endpoints-resumen"></a>
## 5️⃣ RESUMEN DE ENDPOINTS

### Para el Médico (Doctor Panel)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/doctors/{doctorId}/documents/upload` | Subir PDF de educación/certificación | JWT Médico |
| PUT | `/api/doctors/{doctorId}/profile` | Actualizar perfil completo | JWT Médico |
| GET | `/api/doctors/{doctorId}/profile` | Obtener su propio perfil | JWT Médico |

### Para la Clínica (Clinic Panel)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/clinics/{clinicId}/doctors/{doctorId}/profile` | Ver perfil completo del médico | JWT Clínica |

---

<a name="datos-prueba"></a>
## 6️⃣ DATOS DE PRUEBA

### Clínica de Prueba
```
ID: clinic-1
Email: clinic@medicones.com
Password: clinic123
Nombre: Clínica Central
```

### Médicos de Prueba

**1. Dr. Juan Pérez (Cardiología)**
```
ID: doctor-clinic-central-1
Email: dr.juan.perez@clinicacentral.com
Password: doctor123
Specialty: Cardiología
Clinic ID: clinic-1
Office: 101
Consultation Fee: $50.00
Experience: 15 años
```

**Perfil profesional:**
```json
{
  "bio": "Cardiólogo con más de 15 años de experiencia en el diagnóstico y tratamiento de enfermedades cardiovasculares.",
  "experience": 15,
  "education": [
    {
      "text": "Universidad Central del Ecuador - Medicina",
      "fileUrl": "https://s3.../titulo_medicina_UCE.pdf",
      "fileName": "titulo_medicina_UCE.pdf"
    },
    {
      "text": "Especialización en Cardiología - Hospital Metropolitano"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Ecocardiografía",
      "fileUrl": "https://s3.../certificado_ecocardiografia.pdf",
      "fileName": "certificado_ecocardiografia.pdf"
    },
    {
      "text": "Certificación en Cardiología Intervencionista"
    }
  ]
}
```

**2. Dra. María García (Pediatría)**
```
ID: doctor-clinic-central-2
Email: dra.maria.garcia@clinicacentral.com
Password: doctor123
Specialty: Pediatría
Clinic ID: clinic-1
Office: 102
Consultation Fee: $45.00
Experience: 10 años
```

**Perfil profesional:**
```json
{
  "bio": "Pediatra especializada en el cuidado integral de niños desde recién nacidos hasta adolescentes.",
  "experience": 10,
  "education": [
    {
      "text": "Universidad San Francisco de Quito"
    },
    {
      "text": "Especialización en Pediatría - Hospital de Niños Baca Ortiz",
      "fileUrl": "https://s3.../especializacion_pediatria.pdf",
      "fileName": "especializacion_pediatria.pdf"
    }
  ],
  "certifications": [
    {
      "text": "Certificación en Neonatología"
    },
    {
      "text": "Certificación en Lactancia Materna",
      "fileUrl": "https://s3.../certificado_lactancia.pdf",
      "fileName": "certificado_lactancia.pdf"
    }
  ]
}
```

---

<a name="ejemplos-codigo"></a>
## 7️⃣ EJEMPLOS DE CÓDIGO (Node.js + Express)

### A. Subir Documento a S3

```javascript
const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');

// Configurar AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Configurar multer para recibir archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Función para subir documento
async function uploadDocument(file, doctorId, type) {
  const timestamp = Date.now();
  const sanitizedFilename = file.originalname
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();
  
  const key = `documents/doctors/${doctorId}/${timestamp}_${sanitizedFilename}`;
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: 'application/pdf',
    ACL: 'private'
  };
  
  try {
    await s3.upload(params).promise();
    
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
    
    return {
      fileUrl: fileUrl,
      fileName: file.originalname,
      key: key
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Error al subir el archivo');
  }
}

// Endpoint para subir documento
router.post('/api/doctors/:doctorId/documents/upload', 
  authenticateDoctor,
  upload.single('file'),
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { type, text } = req.body;
      const file = req.file;
      
      // Validar que el usuario es el médico dueño
      if (req.user.doctorId !== doctorId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permiso para subir documentos'
        });
      }
      
      // Validar campos requeridos
      if (!file || !type || !text) {
        return res.status(400).json({
          error: 'Missing fields',
          message: 'Se requieren los campos: file, type, text'
        });
      }
      
      // Validar tipo
      if (!['education', 'certification'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid type',
          message: 'El tipo debe ser "education" o "certification"'
        });
      }
      
      // Subir a S3
      const uploadResult = await uploadDocument(file, doctorId, type);
      
      // Guardar en base de datos
      const document = await saveDocumentToDB({
        doctorId,
        type,
        text,
        fileUrl: uploadResult.fileUrl,
        fileName: uploadResult.fileName
      });
      
      res.status(200).json(document);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }
  }
);
```

### B. Generar URLs Firmadas de S3

```javascript
// Función para generar URL firmada
function generateSignedUrl(s3Url) {
  // Extraer la key de la URL de S3
  const bucket = process.env.AWS_S3_BUCKET;
  const key = s3Url.replace(`https://${bucket}.s3.amazonaws.com/`, '');
  
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: 3600 // 1 hora
  };
  
  return s3.getSignedUrl('getObject', params);
}

// Función para procesar perfil y generar URLs firmadas
async function processProfileWithSignedUrls(profile) {
  if (!profile) return null;
  
  // Procesar educación
  if (profile.education && Array.isArray(profile.education)) {
    profile.education = await Promise.all(
      profile.education.map(async (edu) => {
        if (typeof edu === 'object' && edu.fileUrl) {
          return {
            ...edu,
            fileUrl: generateSignedUrl(edu.fileUrl)
          };
        }
        return edu;
      })
    );
  }
  
  // Procesar certificaciones
  if (profile.certifications && Array.isArray(profile.certifications)) {
    profile.certifications = await Promise.all(
      profile.certifications.map(async (cert) => {
        if (typeof cert === 'object' && cert.fileUrl) {
          return {
            ...cert,
            fileUrl: generateSignedUrl(cert.fileUrl)
          };
        }
        return cert;
      })
    );
  }
  
  return profile;
}
```

### C. Endpoint para Ver Perfil del Médico (Clínica)

```javascript
// Endpoint para que la clínica vea el perfil del médico
router.get('/api/clinics/:clinicId/doctors/:doctorId/profile',
  authenticateClinic,
  async (req, res) => {
    try {
      const { clinicId, doctorId } = req.params;
      
      // Validar que el usuario es la clínica
      if (req.user.clinicId !== clinicId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permiso para ver este perfil'
        });
      }
      
      // Buscar el médico
      const doctor = await ClinicDoctor.findOne({
        where: {
          id: doctorId,
          clinicId: clinicId
        }
      });
      
      if (!doctor) {
        return res.status(404).json({
          error: 'Doctor not found',
          message: 'El médico no existe o no pertenece a esta clínica'
        });
      }
      
      // Buscar el perfil profesional
      const profile = await DoctorProfile.findOne({
        where: { doctorId: doctorId }
      });
      
      // Procesar perfil y generar URLs firmadas para PDFs
      const processedProfile = await processProfileWithSignedUrls(profile);
      
      // Construir respuesta
      const response = {
        id: doctor.id,
        clinicId: doctor.clinicId,
        userId: doctor.userId,
        email: doctor.email,
        name: doctor.name,
        specialty: doctor.specialty,
        isActive: doctor.isActive,
        officeNumber: doctor.officeNumber,
        consultationFee: doctor.consultationFee,
        profileImageUrl: doctor.profileImageUrl,
        phone: doctor.phone,
        whatsapp: doctor.whatsapp,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
        professionalProfile: processedProfile
      };
      
      res.status(200).json(response);
      
    } catch (error) {
      console.error('Error fetching doctor profile:', error);
      res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }
  }
);
```

### D. Endpoint para Actualizar Perfil del Médico

```javascript
// Endpoint para actualizar perfil completo
router.put('/api/doctors/:doctorId/profile',
  authenticateDoctor,
  async (req, res) => {
    try {
      const { doctorId } = req.params;
      const {
        bio,
        experience,
        specialty,
        phone,
        whatsapp,
        education,
        certifications
      } = req.body;
      
      // Validar que el usuario es el médico dueño
      if (req.user.doctorId !== doctorId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permiso para actualizar este perfil'
        });
      }
      
      // Validaciones
      if (bio && bio.length > 500) {
        return res.status(400).json({
          error: 'Invalid bio',
          message: 'La biografía debe tener máximo 500 caracteres'
        });
      }
      
      if (experience && experience < 0) {
        return res.status(400).json({
          error: 'Invalid experience',
          message: 'La experiencia debe ser un número positivo'
        });
      }
      
      // Actualizar o crear perfil
      const [profile, created] = await DoctorProfile.findOrCreate({
        where: { doctorId: doctorId },
        defaults: {
          bio,
          experience,
          education: education || [],
          certifications: certifications || []
        }
      });
      
      if (!created) {
        // Actualizar perfil existente
        await profile.update({
          bio,
          experience,
          education: education || profile.education,
          certifications: certifications || profile.certifications,
          updatedAt: new Date()
        });
      }
      
      // Actualizar datos básicos del médico si se proporcionan
      if (specialty || phone || whatsapp) {
        await ClinicDoctor.update(
          {
            specialty: specialty || undefined,
            phone: phone || undefined,
            whatsapp: whatsapp || undefined,
            updatedAt: new Date()
          },
          { where: { id: doctorId } }
        );
      }
      
      res.status(200).json({
        message: 'Perfil actualizado correctamente',
        profile: profile
      });
      
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }
  }
);
```

---

## 8️⃣ EJEMPLOS DE REQUESTS CON CURL

### 1. Médico sube PDF de educación

```bash
curl -X POST \
  'http://localhost:3000/api/doctors/doctor-1/documents/upload' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -F 'file=@/path/to/titulo_medicina.pdf' \
  -F 'type=education' \
  -F 'text=Universidad Central del Ecuador - Medicina'
```

### 2. Médico actualiza su perfil completo

```bash
curl -X PUT \
  'http://localhost:3000/api/doctors/doctor-1/profile' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
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
        "fileUrl": "https://s3.amazonaws.com/.../titulo.pdf",
        "fileName": "titulo_medicina.pdf"
      }
    ],
    "certifications": [
      {
        "text": "Certificación en Ecocardiografía",
        "fileUrl": "https://s3.amazonaws.com/.../certificado.pdf",
        "fileName": "certificado_eco.pdf"
      }
    ]
  }'
```

### 3. Clínica ve perfil del médico

```bash
curl -X GET \
  'http://localhost:3000/api/clinics/clinic-1/doctors/doctor-1/profile' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

---

## 9️⃣ VALIDACIONES Y SEGURIDAD

### Validaciones de Archivos
- ✅ **Tipo MIME:** Solo `application/pdf`
- ✅ **Tamaño:** Máximo 5MB (5 * 1024 * 1024 bytes)
- ✅ **Extensión:** Solo `.pdf`
- ✅ **Nombre:** Sanitizar caracteres especiales
- ✅ **Unicidad:** Agregar timestamp al nombre

### Validaciones de Permisos
- ✅ **Médico:** Solo puede subir/editar su propio perfil
- ✅ **Clínica:** Solo puede ver perfiles de sus médicos asociados
- ✅ **Token JWT:** Validar en cada request
- ✅ **Relación:** Verificar que `doctor.clinicId === clinicId`

### Validaciones de Datos
- ✅ **text:** No vacío, mínimo 3 caracteres
- ✅ **bio:** Máximo 500 caracteres
- ✅ **experience:** Número >= 0
- ✅ **phone/whatsapp:** 10 dígitos, solo números
- ✅ **type:** Solo "education" o "certification"

### Seguridad de S3
- ✅ **Bucket privado:** No acceso público
- ✅ **URLs firmadas:** Expiración de 1 hora
- ✅ **CORS:** Solo dominios permitidos
- ✅ **IAM Roles:** Permisos mínimos necesarios

---

## 🔟 CHECKLIST DE IMPLEMENTACIÓN

### Configuración Inicial
- [ ] Crear bucket S3: `mediconnect-documents`
- [ ] Configurar permisos y políticas de S3
- [ ] Configurar CORS en S3
- [ ] Agregar variables de entorno AWS
- [ ] Instalar dependencias: `aws-sdk`, `multer`

### Base de Datos
- [ ] Crear tabla `clinic_doctors` (si no existe)
- [ ] Crear tabla `doctor_profiles`
- [ ] Agregar columnas `education` y `certifications` (JSONB)
- [ ] Crear índices para mejorar performance
- [ ] Migrar datos existentes (si aplica)

### Endpoints del Médico
- [ ] `POST /api/doctors/{doctorId}/documents/upload`
  - [ ] Middleware de autenticación
  - [ ] Validación de archivo (tipo, tamaño)
  - [ ] Subida a S3
  - [ ] Guardar en BD
  - [ ] Manejo de errores
- [ ] `PUT /api/doctors/{doctorId}/profile`
  - [ ] Middleware de autenticación
  - [ ] Validaciones de datos
  - [ ] Actualizar/crear perfil
  - [ ] Manejo de errores

### Endpoints de la Clínica
- [ ] `GET /api/clinics/{clinicId}/doctors/{doctorId}/profile`
  - [ ] Middleware de autenticación
  - [ ] Validar relación clínica-médico
  - [ ] Obtener perfil de BD
  - [ ] Generar URLs firmadas para PDFs
  - [ ] Manejo de errores

### Testing
- [ ] Probar subida de PDFs
- [ ] Probar actualización de perfil
- [ ] Probar visualización desde clínica
- [ ] Probar URLs firmadas
- [ ] Probar validaciones de seguridad
- [ ] Probar manejo de errores

### Documentación
- [ ] Documentar endpoints en Swagger/Postman
- [ ] Agregar ejemplos de requests/responses
- [ ] Documentar códigos de error
- [ ] Actualizar README del proyecto

---

## 1️⃣1️⃣ PREGUNTAS FRECUENTES

**P: ¿La clínica puede editar el perfil del médico?**
R: No, solo puede verlo. El médico es el único que puede editar su perfil.

**P: ¿Qué pasa si el médico no ha completado su perfil?**
R: Retornar `professionalProfile: null` o un objeto vacío. El frontend maneja este caso mostrando un mensaje.

**P: ¿Los PDFs son obligatorios?**
R: No, son opcionales. Un ítem puede tener solo texto sin PDF.

**P: ¿Cómo se manejan los PDFs antiguos si el médico sube uno nuevo?**
R: Depende de tu lógica de negocio. Puedes:
- Reemplazar el PDF anterior (eliminar de S3)
- Mantener historial de versiones
- Permitir múltiples PDFs por ítem

**P: ¿Qué pasa si la URL firmada expira?**
R: El frontend debe manejar el error y solicitar el perfil nuevamente para obtener una nueva URL firmada.

**P: ¿Puedo usar otro servicio en lugar de S3?**
R: Sí, puedes usar Google Cloud Storage, Azure Blob Storage, o cualquier servicio similar. Solo ajusta el código de subida y generación de URLs.

**P: ¿Cómo manejo archivos grandes?**
R: El límite actual es 5MB. Si necesitas archivos más grandes:
- Aumentar el límite en multer y validaciones
- Considerar compresión de PDFs
- Implementar subida por chunks

---

## 1️⃣2️⃣ PRIORIDADES Y TIEMPOS

### Alta Prioridad (Crítico)
1. ✅ Configuración de S3 - **2 horas**
2. ✅ Endpoint subir PDFs - **2 horas**
3. ✅ Endpoint actualizar perfil - **1 hora**
4. ✅ Endpoint ver perfil (clínica) - **1 hora**

**Total Alta Prioridad: 6 horas**

### Media Prioridad (Importante)
1. ⏳ Generación de URLs firmadas - **1 hora**
2. ⏳ Validaciones completas - **1 hora**
3. ⏳ Manejo de errores robusto - **1 hora**
4. ⏳ Testing de endpoints - **2 horas**

**Total Media Prioridad: 5 horas**

### Baja Prioridad (Opcional)
1. ⏳ Historial de versiones de PDFs - **3 horas**
2. ⏳ Compresión automática de PDFs - **2 horas**
3. ⏳ CDN para servir documentos - **4 horas**

**Total Baja Prioridad: 9 horas**

**TIEMPO TOTAL ESTIMADO: 11-20 horas** (dependiendo de prioridades)

---

## 1️⃣3️⃣ CONTACTO Y SOPORTE

Si tienes dudas durante la implementación:

1. **Revisa la documentación detallada:**
   - Este documento tiene todos los detalles técnicos
   - Incluye ejemplos de código funcionales
   - Tiene casos de prueba específicos

2. **Prueba con los datos de prueba:**
   - Usa las credenciales proporcionadas
   - Sigue los ejemplos de curl
   - Verifica las respuestas esperadas

3. **Verifica la configuración:**
   - AWS S3 correctamente configurado
   - Variables de entorno correctas
   - Permisos y políticas aplicadas

---

## ✅ RESUMEN EJECUTIVO

**Frontend:** 100% completado y funcionando con mocks

**Backend necesita:**
- 3 endpoints principales
- Configuración de AWS S3
- Estructura de BD (JSONB recomendado)
- Generación de URLs firmadas

**Tiempo estimado:** 6-8 horas para funcionalidad básica

**Complejidad:** Media

**Dependencias:** AWS S3, JWT Auth, PostgreSQL

**Prioridad:** Alta

**Estado:** Listo para implementación backend

---

**Fecha:** 2026-02-06
**Versión:** 1.0
**Autor:** Frontend Team
**Para:** Backend Team

---

## 📎 ANEXOS

### Archivos de Referencia
- `VER_PERFIL_MEDICO_CLINICA.md` - Documentación frontend
- `ADJUNTAR_PDF_EDUCACION_CERTIFICACIONES.md` - Funcionalidad PDFs
- `GUIA_VISUAL_VER_PERFIL_MEDICO.md` - Guía visual UI

### Herramientas Recomendadas
- **Postman/Insomnia:** Para testing de endpoints
- **AWS CLI:** Para gestión de S3
- **pgAdmin:** Para gestión de PostgreSQL
- **Multer:** Para manejo de archivos
- **AWS SDK:** Para integración con S3

---

**¡Éxito con la implementación! 🚀**
