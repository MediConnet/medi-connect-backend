# 📧 Instrucciones para Implementar Emails en el Backend

## 🎯 Resumen

Este documento explica cómo implementar el sistema de emails personalizados en el backend usando las plantillas HTML proporcionadas.

---

## 📁 Archivos de Plantillas

He creado 6 plantillas HTML profesionales listas para usar:

1. **PLANTILLA_1_INVITACION_MEDICO.html** - Invitación a médico
2. **PLANTILLA_2_CONFIRMACION_CITA.html** - Confirmación de cita
3. **PLANTILLA_3_RECORDATORIO_CITA.html** - Recordatorio 24h antes
4. **PLANTILLA_4_RECUPERACION_PASSWORD.html** - Recuperación de contraseña
5. **PLANTILLA_5_BIENVENIDA.html** - Bienvenida a nuevos usuarios
6. **PLANTILLA_6_CANCELACION_CITA.html** - Cancelación de cita

---

## 🛠️ Implementación en el Backend

### Paso 1: Crear Servicio de Email

Crea un archivo `services/emailService.js`:

```javascript
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

// Configurar AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class EmailService {
  
  /**
   * Cargar plantilla HTML
   */
  async loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '../templates/emails', templateName);
    return await fs.readFile(templatePath, 'utf-8');
  }
  
  /**
   * Reemplazar variables en la plantilla
   */
  replaceVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    return result;
  }
  
  /**
   * Enviar email
   */
  async sendEmail({ to, subject, html }) {
    const params = {
      Source: process.env.EMAIL_FROM || 'noreply@docalink.com',
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    try {
      const result = await ses.sendEmail(params).promise();
      console.log('✅ Email enviado:', result.MessageId);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      console.error('❌ Error al enviar email:', error);
      throw error;
    }
  }
  
  /**
   * 1. Enviar invitación a médico
   */
  async sendDoctorInvitation({ email, clinicName, invitationLink }) {
    const template = await this.loadTemplate('PLANTILLA_1_INVITACION_MEDICO.html');
    const html = this.replaceVariables(template, {
      clinicName,
      invitationLink
    });
    
    return await this.sendEmail({
      to: email,
      subject: `Invitación de ${clinicName} - DOCALINK`,
      html
    });
  }
  
  /**
   * 2. Enviar confirmación de cita
   */
  async sendAppointmentConfirmation({
    email,
    patientName,
    doctorName,
    specialty,
    appointmentDate,
    appointmentTime,
    clinicAddress,
    consultationPrice,
    appointmentDetailsLink,
    addToCalendarLink,
    cancelLink
  }) {
    const template = await this.loadTemplate('PLANTILLA_2_CONFIRMACION_CITA.html');
    const html = this.replaceVariables(template, {
      patientName,
      doctorName,
      specialty,
      appointmentDate,
      appointmentTime,
      clinicAddress,
      consultationPrice,
      appointmentDetailsLink,
      addToCalendarLink,
      cancelLink
    });
    
    return await this.sendEmail({
      to: email,
      subject: `Cita confirmada con ${doctorName} - DOCALINK`,
      html
    });
  }
  
  /**
   * 3. Enviar recordatorio de cita
   */
  async sendAppointmentReminder({
    email,
    patientName,
    doctorName,
    appointmentDate,
    appointmentTime,
    clinicAddress,
    confirmAttendanceLink,
    mapLink,
    cancelLink
  }) {
    const template = await this.loadTemplate('PLANTILLA_3_RECORDATORIO_CITA.html');
    const html = this.replaceVariables(template, {
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      clinicAddress,
      confirmAttendanceLink,
      mapLink,
      cancelLink
    });
    
    return await this.sendEmail({
      to: email,
      subject: `Recordatorio: Tu cita es mañana - DOCALINK`,
      html
    });
  }
  
  /**
   * 4. Enviar recuperación de contraseña
   */
  async sendPasswordReset({
    email,
    userName,
    resetLink,
    requestDate,
    requestTime,
    requestIP,
    requestDevice
  }) {
    const template = await this.loadTemplate('PLANTILLA_4_RECUPERACION_PASSWORD.html');
    const html = this.replaceVariables(template, {
      userName,
      resetLink,
      requestDate,
      requestTime,
      requestIP,
      requestDevice
    });
    
    return await this.sendEmail({
      to: email,
      subject: 'Recuperación de contraseña - DOCALINK',
      html
    });
  }
  
  /**
   * 5. Enviar bienvenida
   */
  async sendWelcome({
    email,
    userName,
    userRole,
    dashboardLink,
    guideLink,
    faqLink,
    supportLink,
    supportPhone,
    facebookLink,
    instagramLink,
    twitterLink,
    linkedinLink
  }) {
    const template = await this.loadTemplate('PLANTILLA_5_BIENVENIDA.html');
    const html = this.replaceVariables(template, {
      userName,
      userRole,
      dashboardLink,
      guideLink,
      faqLink,
      supportLink,
      supportPhone,
      facebookLink,
      instagramLink,
      twitterLink,
      linkedinLink
    });
    
    return await this.sendEmail({
      to: email,
      subject: '¡Bienvenido a DOCALINK! 🎉',
      html
    });
  }
  
  /**
   * 6. Enviar cancelación de cita
   */
  async sendAppointmentCancellation({
    email,
    patientName,
    doctorName,
    specialty,
    appointmentDate,
    appointmentTime,
    clinicAddress,
    cancellationDate,
    cancellationReason,
    refundInfo,
    rescheduleLink,
    findDoctorLink,
    viewHistoryLink,
    contactSupportLink
  }) {
    const template = await this.loadTemplate('PLANTILLA_6_CANCELACION_CITA.html');
    const html = this.replaceVariables(template, {
      patientName,
      doctorName,
      specialty,
      appointmentDate,
      appointmentTime,
      clinicAddress,
      cancellationDate,
      cancellationReason,
      refundInfo,
      rescheduleLink,
      findDoctorLink,
      viewHistoryLink,
      contactSupportLink
    });
    
    return await this.sendEmail({
      to: email,
      subject: 'Cita cancelada - DOCALINK',
      html
    });
  }
}

module.exports = new EmailService();
```

---

### Paso 2: Crear Carpeta de Plantillas

Crea la estructura de carpetas:

```
backend/
├── services/
│   └── emailService.js
└── templates/
    └── emails/
        ├── PLANTILLA_1_INVITACION_MEDICO.html
        ├── PLANTILLA_2_CONFIRMACION_CITA.html
        ├── PLANTILLA_3_RECORDATORIO_CITA.html
        ├── PLANTILLA_4_RECUPERACION_PASSWORD.html
        ├── PLANTILLA_5_BIENVENIDA.html
        └── PLANTILLA_6_CANCELACION_CITA.html
```

Copia los archivos HTML que te proporcioné a la carpeta `templates/emails/`.

---

### Paso 3: Configurar Variables de Entorno

Agrega a tu archivo `.env`:

```env
# AWS SES Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key

# Email Configuration
EMAIL_FROM=noreply@docalink.com
FRONTEND_URL=http://localhost:5173
```

---

### Paso 4: Usar el Servicio en tus Controladores

#### Ejemplo 1: Invitación a Médico

```javascript
const emailService = require('../services/emailService');

// En tu controlador de invitaciones
router.post('/doctors/invitation', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const clinicId = req.user.id;
    
    // Obtener datos de la clínica
    const clinic = await db.clinics.findById(clinicId);
    
    // Generar token de invitación
    const token = crypto.randomBytes(32).toString('hex');
    
    // Guardar invitación en BD
    await db.invitations.create({
      clinicId,
      email,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    });
    
    // Construir link de invitación
    const invitationLink = `${process.env.FRONTEND_URL}/clinic/invite/${token}`;
    
    // Enviar email
    await emailService.sendDoctorInvitation({
      email,
      clinicName: clinic.name,
      invitationLink
    });
    
    res.json({
      success: true,
      data: {
        invitationLink: `/clinic/invite/${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Error al enviar invitación' });
  }
});
```

#### Ejemplo 2: Confirmación de Cita

```javascript
// En tu controlador de citas
router.post('/appointments', authenticateToken, async (req, res) => {
  try {
    const { doctorId, date, time } = req.body;
    const patientId = req.user.id;
    
    // Crear cita en BD
    const appointment = await db.appointments.create({
      patientId,
      doctorId,
      date,
      time,
      status: 'confirmed'
    });
    
    // Obtener datos necesarios
    const patient = await db.users.findById(patientId);
    const doctor = await db.users.findById(doctorId);
    const clinic = await db.clinics.findById(doctor.clinicId);
    
    // Enviar email de confirmación
    await emailService.sendAppointmentConfirmation({
      email: patient.email,
      patientName: patient.name,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      appointmentDate: formatDate(date),
      appointmentTime: time,
      clinicAddress: clinic.address,
      consultationPrice: appointment.price,
      appointmentDetailsLink: `${process.env.FRONTEND_URL}/appointments/${appointment.id}`,
      addToCalendarLink: `${process.env.FRONTEND_URL}/appointments/${appointment.id}/calendar`,
      cancelLink: `${process.env.FRONTEND_URL}/appointments/${appointment.id}/cancel`
    });
    
    res.json({ success: true, data: appointment });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Error al crear cita' });
  }
});
```

---

## 🔄 Alternativa: Usar SendGrid en lugar de AWS SES

Si prefieres usar SendGrid:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async sendEmail({ to, subject, html }) {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject,
    html
  };
  
  try {
    await sgMail.send(msg);
    console.log('✅ Email enviado');
    return { success: true };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}
```

---

## 📋 Checklist de Implementación

- [ ] Copiar plantillas HTML a `templates/emails/`
- [ ] Crear `services/emailService.js`
- [ ] Configurar AWS SES o SendGrid
- [ ] Agregar variables de entorno
- [ ] Implementar envío en controladores
- [ ] Probar cada tipo de email
- [ ] Verificar que las variables se reemplacen correctamente
- [ ] Verificar que los links funcionen
- [ ] Probar en diferentes clientes de email (Gmail, Outlook, etc.)

---

## 🧪 Cómo Probar

### 1. Prueba Individual

```javascript
// test-email.js
const emailService = require('./services/emailService');

async function test() {
  await emailService.sendDoctorInvitation({
    email: 'test@example.com',
    clinicName: 'Clínica San José',
    invitationLink: 'http://localhost:5173/clinic/invite/abc123'
  });
}

test();
```

### 2. Ejecutar

```bash
node test-email.js
```

### 3. Verificar

- ✅ Email recibido en la bandeja de entrada
- ✅ Diseño se ve bien
- ✅ Variables reemplazadas correctamente
- ✅ Links funcionan
- ✅ Responsive en móvil

---

## 🎨 Personalización

Si quieres cambiar colores, logos o textos:

1. Abre el archivo HTML de la plantilla
2. Busca el elemento que quieres cambiar
3. Modifica el HTML/CSS inline
4. Guarda y prueba

### Cambiar Color Principal

Busca `#14b8a6` y reemplázalo con tu color.

### Cambiar Logo

Busca `🏥 DOCALINK` y reemplázalo con:
```html
<img src="https://tu-dominio.com/logo.png" alt="DOCALINK" style="max-width: 150px;">
```

---

## 📞 Soporte

Si tienes dudas sobre la implementación, revisa:
- Documentación de AWS SES
- Documentación de SendGrid
- Los ejemplos de código en este documento

¡Listo! Con esto tu backend podrá enviar emails profesionales y personalizados.
