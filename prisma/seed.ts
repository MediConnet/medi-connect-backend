import { PrismaClient, users, providers, cities, service_categories, provider_branches } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Cargar variables de entorno
dotenv.config();

// Crear un pool de PostgreSQL para usar como adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Crear el adapter de Prisma para PostgreSQL
const adapter = new PrismaPg(pool);

// Usar el cliente generado con un adapter de PostgreSQL
const prisma = new PrismaClient({
  log: process.env.STAGE === 'dev' ? ['query', 'error', 'warn'] : ['error'],
  adapter,
} as any);

// Helper para convertir día de la semana
function dayToNumber(day: string): number {
  const days: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };
  return days[day.toLowerCase()] ?? 1;
}

// Helper para crear o encontrar
async function findOrCreate<T>(
  model: any,
  where: any,
  createData: any
): Promise<T> {
  const existing = await model.findFirst({ where });
  if (existing) {
    return existing as T;
  }
  return (await model.create({ data: createData })) as T;
}

async function main() {
  console.log('🌱 Iniciando seed de datos...');

  // 1. Crear ciudades
  console.log('📍 Creando ciudades...');
  const quito = await findOrCreate<cities>(
    prisma.cities,
    { name: 'Quito' },
    {
      id: randomUUID(),
      name: 'Quito',
      state: 'Pichincha',
      country: 'Ecuador',
    }
  );

  const guayaquil = await findOrCreate<cities>(
    prisma.cities,
    { name: 'Guayaquil' },
    {
      id: randomUUID(),
      name: 'Guayaquil',
      state: 'Guayas',
      country: 'Ecuador',
    }
  );

  const cuenca = await findOrCreate<cities>(
    prisma.cities,
    { name: 'Cuenca' },
    {
      id: randomUUID(),
      name: 'Cuenca',
      state: 'Azuay',
      country: 'Ecuador',
    }
  );

  console.log('✅ Ciudades creadas');

  // 2. Crear categorías de servicio
  console.log('🏷️ Creando categorías de servicio...');
  const doctorCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'doctor' },
    {
      name: 'Doctor',
      slug: 'doctor',
      default_color_hex: '#3b82f6',
      allows_booking: true,
    }
  );

  const pharmacyCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'pharmacy' },
    {
      name: 'Farmacia',
      slug: 'pharmacy',
      default_color_hex: '#22c55e',
      allows_booking: false,
    }
  );

  const laboratoryCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'laboratory' },
    {
      name: 'Laboratorio',
      slug: 'laboratory',
      default_color_hex: '#a855f7',
      allows_booking: false,
    }
  );

  const ambulanceCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'ambulance' },
    {
      name: 'Ambulancia',
      slug: 'ambulance',
      default_color_hex: '#ef4444',
      allows_booking: true,
    }
  );

  const suppliesCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'supplies' },
    {
      name: 'Insumos Médicos',
      slug: 'supplies',
      default_color_hex: '#f97316',
      allows_booking: false,
    }
  );

  console.log('✅ Categorías de servicio creadas');

  // 3. Crear usuarios administradores
  console.log('👨‍💼 Creando usuarios administradores...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await findOrCreate<users>(
    prisma.users,
    { email: 'admin@medicones.com' },
    {
      id: randomUUID(),
      email: 'admin@medicones.com',
      password_hash: adminPassword,
      role: 'admin',
      is_active: true,
    }
  );

  const admin2Password = await bcrypt.hash('admin123', 10);
  await findOrCreate<users>(
    prisma.users,
    { email: 'admin2@medicones.com' },
    {
      id: randomUUID(),
      email: 'admin2@medicones.com',
      password_hash: admin2Password,
      role: 'admin',
      is_active: true,
    }
  );

  console.log('✅ Usuarios administradores creados');

  // 4. Crear doctores
  console.log('👨‍⚕️ Creando doctores...');
  
  // Dr. Juan Pérez
  const doctorPassword = await bcrypt.hash('doctor123', 10);
  const doctorUser = await findOrCreate<users>(
    prisma.users,
    { email: 'doctor@medicones.com' },
    {
      id: randomUUID(),
      email: 'doctor@medicones.com',
      password_hash: doctorPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const doctorProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: doctorUser.id },
    {
      id: randomUUID(),
      user_id: doctorUser.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. Juan Pérez',
      description: 'Especialista en cardiología con más de 10 años de experiencia.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const doctorBranch = await findOrCreate<provider_branches>(
    prisma.provider_branches,
    { 
      provider_id: doctorProvider.id,
      name: 'Consultorio Principal',
    },
    {
      id: randomUUID(),
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
    }
  );

  // Crear horarios para el doctor
  const doctorSchedules = [
    { day: 'monday', start: '09:00:00', end: '17:00:00' },
    { day: 'tuesday', start: '09:00:00', end: '17:00:00' },
    { day: 'wednesday', start: '09:00:00', end: '17:00:00' },
    { day: 'thursday', start: '09:00:00', end: '17:00:00' },
    { day: 'friday', start: '09:00:00', end: '17:00:00' },
  ];

  for (const schedule of doctorSchedules) {
    const dayNum = dayToNumber(schedule.day);
    const existing = await prisma.provider_schedules.findFirst({
      where: {
        branch_id: doctorBranch.id,
        day_of_week: dayNum,
      },
    });
    
    if (!existing) {
      await prisma.provider_schedules.create({
        data: {
          id: randomUUID(),
          branch_id: doctorBranch.id,
          day_of_week: dayNum,
          start_time: new Date(`1970-01-01T${schedule.start}`),
          end_time: new Date(`1970-01-01T${schedule.end}`),
        },
      });
    }
  }

  // Dr. María González
  const doctor2Password = await bcrypt.hash('doctor123', 10);
  const doctor2User = await findOrCreate<users>(
    prisma.users,
    { email: 'maria.gonzalez@medicones.com' },
    {
      id: randomUUID(),
      email: 'maria.gonzalez@medicones.com',
      password_hash: doctor2Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: doctor2User.id },
    {
      id: randomUUID(),
      user_id: doctor2User.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. María González',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  // Dr. Carlos Mendoza
  const doctor3Password = await bcrypt.hash('doctor123', 10);
  const doctor3User = await findOrCreate<users>(
    prisma.users,
    { email: 'carlos.mendoza@medicones.com' },
    {
      id: randomUUID(),
      email: 'carlos.mendoza@medicones.com',
      password_hash: doctor3Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: doctor3User.id },
    {
      id: randomUUID(),
      user_id: doctor3User.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. Carlos Mendoza',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  // Dra. Ana Martínez
  const doctor4Password = await bcrypt.hash('doctor123', 10);
  const doctor4User = await findOrCreate<users>(
    prisma.users,
    { email: 'ana.martinez@medicones.com' },
    {
      id: randomUUID(),
      email: 'ana.martinez@medicones.com',
      password_hash: doctor4Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: doctor4User.id },
    {
      id: randomUUID(),
      user_id: doctor4User.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dra. Ana Martínez',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  // Dr. Roberto Sánchez
  const doctor5Password = await bcrypt.hash('doctor123', 10);
  const doctor5User = await findOrCreate<users>(
    prisma.users,
    { email: 'roberto.sanchez@medicones.com' },
    {
      id: randomUUID(),
      email: 'roberto.sanchez@medicones.com',
      password_hash: doctor5Password,
      role: 'provider',
      is_active: true,
    }
  );

  const doctor5Provider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: doctor5User.id },
    {
      id: randomUUID(),
      user_id: doctor5User.id,
      category_id: doctorCategory.id,
      commercial_name: 'Dr. Roberto Sánchez',
      description: 'Especialista en Cardiología Intervencionista con más de 10 años de experiencia. Egresado del Instituto Nacional de Cardiología.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  await findOrCreate<provider_branches>(
    prisma.provider_branches,
    {
      provider_id: doctor5Provider.id,
      name: 'Consultorio Principal',
    },
    {
      id: randomUUID(),
      provider_id: doctor5Provider.id,
      city_id: quito.id,
      name: 'Consultorio Principal',
      address_text: 'Av. Reforma 222, Consultorio 304, Quito',
      is_main: true,
      is_active: true,
    }
  );

  console.log('✅ Doctores creados');

  // 5. Crear farmacias
  console.log('💊 Creando farmacias...');
  
  // Farmacia Fybeca
  const pharmacyPassword = await bcrypt.hash('farmacia123', 10);
  const pharmacyUser = await findOrCreate<users>(
    prisma.users,
    { email: 'farmacia@medicones.com' },
    {
      id: randomUUID(),
      email: 'farmacia@medicones.com',
      password_hash: pharmacyPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const pharmacyProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: pharmacyUser.id },
    {
      id: randomUUID(),
      user_id: pharmacyUser.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'Fybeca',
      logo_url: 'https://scalashopping.com/wp-content/uploads/2018/08/logo-Fybeca-01-1024x683.png',
      description: 'Somos parte de tu vida. Encuentra medicinas, productos de cuidado personal, belleza, maternidad y más. Calidad y servicio garantizado en todo el Ecuador.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const pharmacyBranch = await findOrCreate<provider_branches>(
    prisma.provider_branches,
    {
      provider_id: pharmacyProvider.id,
      name: 'Fybeca - Sucursal Principal',
    },
    {
      id: randomUUID(),
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
    }
  );

  // Crear horarios para la farmacia
  const pharmacySchedules = [
    { day: 'monday', start: '08:00:00', end: '22:00:00' },
    { day: 'tuesday', start: '08:00:00', end: '22:00:00' },
    { day: 'wednesday', start: '08:00:00', end: '22:00:00' },
    { day: 'thursday', start: '08:00:00', end: '22:00:00' },
    { day: 'friday', start: '08:00:00', end: '22:00:00' },
    { day: 'saturday', start: '09:00:00', end: '21:00:00' },
    { day: 'sunday', start: '10:00:00', end: '20:00:00' },
  ];

  for (const schedule of pharmacySchedules) {
    const dayNum = dayToNumber(schedule.day);
    const existing = await prisma.provider_schedules.findFirst({
      where: {
        branch_id: pharmacyBranch.id,
        day_of_week: dayNum,
      },
    });
    
    if (!existing) {
      await prisma.provider_schedules.create({
        data: {
          id: randomUUID(),
          branch_id: pharmacyBranch.id,
          day_of_week: dayNum,
          start_time: new Date(`1970-01-01T${schedule.start}`),
          end_time: new Date(`1970-01-01T${schedule.end}`),
        },
      });
    }
  }

  // Farmacia Salud Total
  const pharmacy2Password = await bcrypt.hash('farmacia123', 10);
  const pharmacy2User = await findOrCreate<users>(
    prisma.users,
    { email: 'saludtotal@medicones.com' },
    {
      id: randomUUID(),
      email: 'saludtotal@medicones.com',
      password_hash: pharmacy2Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: pharmacy2User.id },
    {
      id: randomUUID(),
      user_id: pharmacy2User.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'Farmacia Salud Total',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  // Farmacia San José
  const pharmacy3Password = await bcrypt.hash('farmacia123', 10);
  const pharmacy3User = await findOrCreate<users>(
    prisma.users,
    { email: 'sanjose@medicones.com' },
    {
      id: randomUUID(),
      email: 'sanjose@medicones.com',
      password_hash: pharmacy3Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: pharmacy3User.id },
    {
      id: randomUUID(),
      user_id: pharmacy3User.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'Farmacia San José',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  console.log('✅ Farmacias creadas');

  // 6. Crear laboratorios
  console.log('🧪 Creando laboratorios...');
  
  const labPassword = await bcrypt.hash('lab123', 10);
  const labUser = await findOrCreate<users>(
    prisma.users,
    { email: 'lab@medicones.com' },
    {
      id: randomUUID(),
      email: 'lab@medicones.com',
      password_hash: labPassword,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: labUser.id },
    {
      id: randomUUID(),
      user_id: labUser.id,
      category_id: laboratoryCategory.id,
      commercial_name: 'Laboratorio Clínico Vital',
      description: 'Laboratorio de análisis clínicos de alta complejidad. Certificación ISO 9001. Resultados en línea 24/7.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const lab2Password = await bcrypt.hash('lab123', 10);
  const lab2User = await findOrCreate<users>(
    prisma.users,
    { email: 'labdiagnostico@medicones.com' },
    {
      id: randomUUID(),
      email: 'labdiagnostico@medicones.com',
      password_hash: lab2Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: lab2User.id },
    {
      id: randomUUID(),
      user_id: lab2User.id,
      category_id: laboratoryCategory.id,
      commercial_name: 'Laboratorio Diagnóstico',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const lab3Password = await bcrypt.hash('lab123', 10);
  const lab3User = await findOrCreate<users>(
    prisma.users,
    { email: 'labxyz@medicones.com' },
    {
      id: randomUUID(),
      email: 'labxyz@medicones.com',
      password_hash: lab3Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: lab3User.id },
    {
      id: randomUUID(),
      user_id: lab3User.id,
      category_id: laboratoryCategory.id,
      commercial_name: 'Laboratorio Clínico XYZ',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  console.log('✅ Laboratorios creados');

  // 7. Crear ambulancias
  console.log('🚑 Creando ambulancias...');
  
  const ambulancePassword = await bcrypt.hash('ambulancia123', 10);
  const ambulanceUser = await findOrCreate<users>(
    prisma.users,
    { email: 'ambulancia@medicones.com' },
    {
      id: randomUUID(),
      email: 'ambulancia@medicones.com',
      password_hash: ambulancePassword,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: ambulanceUser.id },
    {
      id: randomUUID(),
      user_id: ambulanceUser.id,
      category_id: ambulanceCategory.id,
      commercial_name: 'Ambulancias VidaRápida',
      description: 'Servicio de ambulancia 24/7. Unidades de terapia intensiva móvil y traslados programados.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const ambulance2Password = await bcrypt.hash('ambulancia123', 10);
  const ambulance2User = await findOrCreate<users>(
    prisma.users,
    { email: 'ambulanciasrapidas@medicones.com' },
    {
      id: randomUUID(),
      email: 'ambulanciasrapidas@medicones.com',
      password_hash: ambulance2Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: ambulance2User.id },
    {
      id: randomUUID(),
      user_id: ambulance2User.id,
      category_id: ambulanceCategory.id,
      commercial_name: 'Ambulancias Rápidas 24/7',
      description: 'Servicio de traslado terrestre de urgencia y terapia intensiva. Unidades equipadas con desfibrilador y oxígeno.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  console.log('✅ Ambulancias creadas');

  // 8. Crear insumos médicos
  console.log('📦 Creando insumos médicos...');
  
  const suppliesPassword = await bcrypt.hash('insumos123', 10);
  const suppliesUser = await findOrCreate<users>(
    prisma.users,
    { email: 'insumos@medicones.com' },
    {
      id: randomUUID(),
      email: 'insumos@medicones.com',
      password_hash: suppliesPassword,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: suppliesUser.id },
    {
      id: randomUUID(),
      user_id: suppliesUser.id,
      category_id: suppliesCategory.id,
      commercial_name: 'Insumos Médicos Plus',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  const supplies2Password = await bcrypt.hash('insumos123', 10);
  const supplies2User = await findOrCreate<users>(
    prisma.users,
    { email: 'insumosabc@medicones.com' },
    {
      id: randomUUID(),
      email: 'insumosabc@medicones.com',
      password_hash: supplies2Password,
      role: 'provider',
      is_active: true,
    }
  );

  await findOrCreate<providers>(
    prisma.providers,
    { user_id: supplies2User.id },
    {
      id: randomUUID(),
      user_id: supplies2User.id,
      category_id: suppliesCategory.id,
      commercial_name: 'Insumos Médicos ABC',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  console.log('✅ Insumos médicos creados');

  console.log('🎉 Seed completado exitosamente!');
  console.log('\n📊 Resumen:');
  console.log('  - 2 Administradores');
  console.log('  - 5 Doctores');
  console.log('  - 3 Farmacias');
  console.log('  - 3 Laboratorios');
  console.log('  - 2 Ambulancias');
  console.log('  - 2 Insumos Médicos');
  console.log('  - 3 Ciudades');
  console.log('  - 5 Categorías de Servicio');
}

main()
  .catch((e) => {
    console.error('❌ Error al crear datos iniciales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
