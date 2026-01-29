# 📧 Configuración del Servicio de Email

Este documento explica cómo configurar el servicio de email para las notificaciones automáticas.

## Variables de Entorno

Agrega las siguientes variables de entorno a tu archivo `.env`:

```env
# Configuración SMTP
SMTP_HOST=smtp.gmail.com          # Servidor SMTP (Gmail, SendGrid, AWS SES, etc.)
SMTP_PORT=587                      # Puerto SMTP (587 para TLS, 465 para SSL)
SMTP_USER=tu-email@gmail.com       # Usuario/Email del remitente
SMTP_PASSWORD=tu-contraseña       # Contraseña o API key
SMTP_FROM=MediConnet <noreply@mediconnet.com>  # Email del remitente (opcional)
SMTP_SECURE=false                  # true para SSL (puerto 465), false para TLS (puerto 587)
```

## Ejemplos de Configuración

### Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password  # Necesitas generar una "App Password" en Gmail
SMTP_FROM=MediConnet <tu-email@gmail.com>
SMTP_SECURE=false
```

**Nota:** Para Gmail, necesitas:
1. Habilitar "Acceso de aplicaciones menos seguras" O
2. Generar una "App Password" desde tu cuenta de Google

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=tu-api-key-de-sendgrid
SMTP_FROM=MediConnet <noreply@tudominio.com>
SMTP_SECURE=false
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Ajusta la región
SMTP_PORT=587
SMTP_USER=tu-smtp-username
SMTP_PASSWORD=tu-smtp-password
SMTP_FROM=MediConnet <noreply@tudominio.com>
SMTP_SECURE=false
```

## Modo Desarrollo

Si no configuras las variables de entorno, el sistema funcionará en **modo desarrollo**:
- Los emails no se enviarán realmente
- Se mostrarán logs en consola con el contenido del email
- Esto permite probar sin configurar un servicio de email

## Job de Recordatorios 24h Antes

El job de recordatorios se ejecuta manualmente o puede configurarse con un cron job.

### Ejecutar Manualmente

```bash
ts-node src/jobs/appointment-reminders.ts
```

### Configurar Cron Job (Linux/Mac)

Agrega a tu crontab para ejecutar diariamente a las 8:00 AM:

```bash
0 8 * * * cd /ruta/al/proyecto && ts-node src/jobs/appointment-reminders.ts
```

### Configurar con AWS EventBridge (Producción)

Para producción en AWS, puedes usar EventBridge para ejecutar el job como una Lambda function en un schedule.

## Pruebas

Para probar el servicio de email:

1. Configura las variables de entorno
2. Reinicia el servidor
3. Crea o actualiza una cita en una clínica
4. Verifica que se envíen los emails

## Troubleshooting

### Error: "Authentication failed"
- Verifica que las credenciales sean correctas
- Para Gmail, asegúrate de usar una "App Password"
- Para SendGrid, verifica que el API key sea válido

### Error: "Connection timeout"
- Verifica que el `SMTP_HOST` y `SMTP_PORT` sean correctos
- Verifica que no haya un firewall bloqueando la conexión

### Emails no se envían
- Verifica los logs en consola
- En modo desarrollo, los emails solo se loguean, no se envían
- Verifica que las variables de entorno estén configuradas correctamente
