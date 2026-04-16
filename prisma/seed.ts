import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  appointments,
  cities,
  clinic_doctors,
  clinics,
  patients,
  pharmacy_chains,
  PrismaClient,
  provider_branches,
  providers,
  service_categories,
  specialties,
  users
} from '../src/generated/prisma/client';

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

  const clinicCategory = await findOrCreate<service_categories>(
    prisma.service_categories,
    { slug: 'clinic' },
    {
      name: 'Clínica',
      slug: 'clinic',
      default_color_hex: '#14b8a6',
      allows_booking: true,
    }
  );

  console.log('✅ Categorías de servicio creadas');

  // 2.5. Crear las 20 especialidades médicas
  console.log('🏥 Creando especialidades médicas...');
  const specialtiesList = [
    { name: 'Medicina General', description: 'Atención médica general y preventiva', color_hex: '#4CAF50' },
    { name: 'Cardiología', description: 'Especialidad médica que se encarga del corazón y sistema circulatorio', color_hex: '#F44336' },
    { name: 'Dermatología', description: 'Especialidad médica que trata enfermedades de la piel', color_hex: '#FF9800' },
    { name: 'Ginecología', description: 'Especialidad médica que trata la salud reproductiva de la mujer', color_hex: '#E91E63' },
    { name: 'Pediatría', description: 'Especialidad médica que trata la salud de niños y adolescentes', color_hex: '#00BCD4' },
    { name: 'Oftalmología', description: 'Especialidad médica que trata enfermedades de los ojos', color_hex: '#2196F3' },
    { name: 'Traumatología', description: 'Especialidad médica que trata lesiones del sistema musculoesquelético', color_hex: '#9C27B0' },
    { name: 'Neurología', description: 'Especialidad médica que trata enfermedades del sistema nervioso', color_hex: '#3F51B5' },
    { name: 'Psiquiatría', description: 'Especialidad médica que trata trastornos mentales y emocionales', color_hex: '#009688' },
    { name: 'Urología', description: 'Especialidad médica que trata el sistema urinario y reproductor masculino', color_hex: '#795548' },
    { name: 'Endocrinología', description: 'Especialidad médica que trata enfermedades del sistema endocrino', color_hex: '#FF5722' },
    { name: 'Gastroenterología', description: 'Especialidad médica que trata enfermedades del sistema digestivo', color_hex: '#607D8B' },
    { name: 'Neumología', description: 'Especialidad médica que trata enfermedades del sistema respiratorio', color_hex: '#00ACC1' },
    { name: 'Otorrinolaringología', description: 'Especialidad médica que trata oído, nariz y garganta', color_hex: '#8BC34A' },
    { name: 'Oncología', description: 'Especialidad médica que trata el cáncer', color_hex: '#E53935' },
    { name: 'Reumatología', description: 'Especialidad médica que trata enfermedades reumáticas', color_hex: '#AB47BC' },
    { name: 'Nefrología', description: 'Especialidad médica que trata enfermedades de los riñones', color_hex: '#26A69A' },
    { name: 'Cirugía General', description: 'Especialidad médica quirúrgica de procedimientos generales', color_hex: '#5C6BC0' },
    { name: 'Anestesiología', description: 'Especialidad médica que administra anestesia y manejo del dolor', color_hex: '#42A5F5' },
    { name: 'Odontología', description: 'Especialidad médica que trata la salud bucal y dental', color_hex: '#66BB6A' },
  ];

  let createdCount = 0;
  let existingCount = 0;
  let errorCount = 0;
  
  for (const specialty of specialtiesList) {
    try {
      const existing = await prisma.specialties.findFirst({
        where: { name: specialty.name },
      });
      
      if (existing) {
        console.log(`  ⚠️  Especialidad ya existe: ${specialty.name}`);
        existingCount++;
      } else {
        await prisma.specialties.create({
          data: {
            id: randomUUID(),
            name: specialty.name,
            description: specialty.description,
            color_hex: specialty.color_hex,
          },
        });
        console.log(`  ✅ Creada: ${specialty.name}`);
        createdCount++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error al crear especialidad ${specialty.name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`✅ Especialidades procesadas: ${createdCount} creadas, ${existingCount} ya existían${errorCount > 0 ? `, ${errorCount} errores` : ''}`);

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

  // 5. Crear cadenas de farmacias
  console.log('🏪 Creando cadenas de farmacias...');
  const pharmacyChainsData = [
    {
      name: 'Fybeca',
      logoUrl: 'https://scalashopping.com/wp-content/uploads/2018/08/logo-Fybeca-01-1024x683.png',
      isActive: true,
    },
    {
      name: 'Sana Sana',
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKWAttN0PrToBQ9ZKbVicBbTL9RoFXG2TiKQ&s',
      isActive: true,
    },
    {
      name: "Pharmacy's",
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQj7nO9P5Hx_jBWhln5kKvzrWxn8XCSz_1SSw&s',
      isActive: true,
    },
    {
      name: 'MegaFarmacias',
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtktD8217ZZ0okM9bxmMokMWFfX9i27xbYgA&s',
      isActive: true,
    },
  ];

  const createdChains: any[] = [];
  for (const chainData of pharmacyChainsData) {
    const chain = await prisma.pharmacy_chains.upsert({
      where: { name: chainData.name },
      update: {
        logo_url: chainData.logoUrl,
        is_active: chainData.isActive,
        updated_at: new Date(),
      },
      create: {
        id: randomUUID(),
        name: chainData.name,
        logo_url: chainData.logoUrl,
        is_active: chainData.isActive,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    createdChains.push(chain);
    console.log(`  ✅ Cadena creada: ${chain.name}`);
  }
  console.log(`✅ ${createdChains.length} cadenas de farmacias creadas`);

  // 6. Crear farmacias
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

  // Buscar la cadena Fybeca
  const fybecaChain = createdChains.find((c) => c.name === 'Fybeca');
  
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
      chain_id: fybecaChain?.id || null, // ⭐ Asociar con la cadena
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

  // Farmacia Kevin (kevinfarmacia@gmail.com) - Asociada a Sana Sana
  const kevinPharmacyPassword = await bcrypt.hash('kevincata20', 10);
  const kevinPharmacyUser = await findOrCreate<users>(
    prisma.users,
    { email: 'kevinfarmacia@gmail.com' },
    {
      id: randomUUID(),
      email: 'kevinfarmacia@gmail.com',
      password_hash: kevinPharmacyPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const sanaSanaChain = createdChains.find((c) => c.name === 'Sana Sana');
  
  const kevinPharmacyProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: kevinPharmacyUser.id },
    {
      id: randomUUID(),
      user_id: kevinPharmacyUser.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'Farmacia Kevin',
      logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKWAttN0PrToBQ9ZKbVicBbTL9RoFXG2TiKQ&s',
      description: 'Farmacia de confianza con amplio surtido de medicamentos y productos de cuidado personal.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
      chain_id: sanaSanaChain?.id || null,
    }
  );

  const kevinPharmacyBranch = await findOrCreate<provider_branches>(
    prisma.provider_branches,
    {
      provider_id: kevinPharmacyProvider.id,
      name: 'Farmacia Kevin - Sucursal Principal',
    },
    {
      id: randomUUID(),
      provider_id: kevinPharmacyProvider.id,
      city_id: quito.id,
      name: 'Farmacia Kevin - Sucursal Principal',
      address_text: 'Av. 6 de Diciembre N24-156, Quito, Ecuador',
      latitude: -0.1807,
      longitude: -78.4678,
      phone_contact: '+593 99 123 4567',
      email_contact: 'kevinfarmacia@gmail.com',
      opening_hours_text: 'Lun-Dom: 7:00-23:00',
      is_24h: false,
      has_delivery: true,
      is_main: true,
      is_active: true,
    }
  );

  // Horarios para Farmacia Kevin
  for (const schedule of pharmacySchedules) {
    const dayNum = dayToNumber(schedule.day);
    const existing = await prisma.provider_schedules.findFirst({
      where: {
        branch_id: kevinPharmacyBranch.id,
        day_of_week: dayNum,
      },
    });
    
    if (!existing) {
      await prisma.provider_schedules.create({
        data: {
          id: randomUUID(),
          branch_id: kevinPharmacyBranch.id,
          day_of_week: dayNum,
          start_time: new Date(`1970-01-01T${schedule.start}`),
          end_time: new Date(`1970-01-01T${schedule.end}`),
        },
      });
    }
  }

  // Farmacia Pharmacy's - Asociada a Pharmacy's
  const pharmacysChain = createdChains.find((c) => c.name === "Pharmacy's");
  const pharmacysPassword = await bcrypt.hash('pharmacys123', 10);
  const pharmacysUser = await findOrCreate<users>(
    prisma.users,
    { email: 'pharmacys@medicones.com' },
    {
      id: randomUUID(),
      email: 'pharmacys@medicones.com',
      password_hash: pharmacysPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const pharmacysProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: pharmacysUser.id },
    {
      id: randomUUID(),
      user_id: pharmacysUser.id,
      category_id: pharmacyCategory.id,
      commercial_name: "Pharmacy's",
      logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQj7nO9P5Hx_jBWhln5kKvzrWxn8XCSz_1SSw&s',
      description: 'Tu farmacia de confianza con los mejores precios y servicio al cliente.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
      chain_id: pharmacysChain?.id || null,
    }
  );

  const pharmacysBranch = await findOrCreate<provider_branches>(
    prisma.provider_branches,
    {
      provider_id: pharmacysProvider.id,
      name: "Pharmacy's - Sucursal Centro",
    },
    {
      id: randomUUID(),
      provider_id: pharmacysProvider.id,
      city_id: guayaquil.id,
      name: "Pharmacy's - Sucursal Centro",
      address_text: 'Av. 9 de Octubre y Malecón, Guayaquil, Ecuador',
      latitude: -2.1709,
      longitude: -79.9224,
      phone_contact: '+593 99 234 5678',
      email_contact: 'pharmacys@medicones.com',
      opening_hours_text: 'Lun-Dom: 8:00-21:00',
      is_24h: false,
      has_delivery: true,
      is_main: true,
      is_active: true,
    }
  );

  // Horarios para Pharmacy's
  for (const schedule of pharmacySchedules) {
    const dayNum = dayToNumber(schedule.day);
    const existing = await prisma.provider_schedules.findFirst({
      where: {
        branch_id: pharmacysBranch.id,
        day_of_week: dayNum,
      },
    });
    
    if (!existing) {
      await prisma.provider_schedules.create({
        data: {
          id: randomUUID(),
          branch_id: pharmacysBranch.id,
          day_of_week: dayNum,
          start_time: new Date(`1970-01-01T${schedule.start}`),
          end_time: new Date(`1970-01-01T${schedule.end}`),
        },
      });
    }
  }

  // Farmacia MegaFarmacias - Asociada a MegaFarmacias
  const megaFarmaciasChain = createdChains.find((c) => c.name === 'MegaFarmacias');
  const megaFarmaciasPassword = await bcrypt.hash('mega123', 10);
  const megaFarmaciasUser = await findOrCreate<users>(
    prisma.users,
    { email: 'megafarmacias@medicones.com' },
    {
      id: randomUUID(),
      email: 'megafarmacias@medicones.com',
      password_hash: megaFarmaciasPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const megaFarmaciasProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: megaFarmaciasUser.id },
    {
      id: randomUUID(),
      user_id: megaFarmaciasUser.id,
      category_id: pharmacyCategory.id,
      commercial_name: 'MegaFarmacias',
      logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtktD8217ZZ0okM9bxmMokMWFfX9i27xbYgA&s',
      description: 'La cadena de farmacias más grande del país. Medicamentos, productos de belleza y cuidado personal.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
      chain_id: megaFarmaciasChain?.id || null,
    }
  );

  const megaFarmaciasBranch = await findOrCreate<provider_branches>(
    prisma.provider_branches,
    {
      provider_id: megaFarmaciasProvider.id,
      name: 'MegaFarmacias - Sucursal Norte',
    },
    {
      id: randomUUID(),
      provider_id: megaFarmaciasProvider.id,
      city_id: quito.id,
      name: 'MegaFarmacias - Sucursal Norte',
      address_text: 'Av. Naciones Unidas y Av. 6 de Diciembre, Quito, Ecuador',
      latitude: -0.1807,
      longitude: -78.4678,
      phone_contact: '+593 99 345 6789',
      email_contact: 'megafarmacias@medicones.com',
      opening_hours_text: 'Lun-Dom: 24 horas',
      is_24h: true,
      has_delivery: true,
      is_main: true,
      is_active: true,
    }
  );

  // Horarios para MegaFarmacias (24 horas)
  for (let day = 0; day <= 6; day++) {
    const existing = await prisma.provider_schedules.findFirst({
      where: {
        branch_id: megaFarmaciasBranch.id,
        day_of_week: day,
      },
    });
    
    if (!existing) {
      await prisma.provider_schedules.create({
        data: {
          id: randomUUID(),
          branch_id: megaFarmaciasBranch.id,
          day_of_week: day,
          start_time: new Date('1970-01-01T00:00:00'),
          end_time: new Date('1970-01-01T23:59:59'),
        },
      });
    }
  }

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

  // 8.5. Crear clínica
  console.log('🏥 Creando clínica...');
  
  const clinicPassword = await bcrypt.hash('clinic123', 10);
  const clinicUser = await findOrCreate<users>(
    prisma.users,
    { email: 'clinic@medicones.com' },
    {
      id: randomUUID(),
      email: 'clinic@medicones.com',
      password_hash: clinicPassword,
      role: 'provider',
      is_active: true,
    }
  );

  const clinicProvider = await findOrCreate<providers>(
    prisma.providers,
    { user_id: clinicUser.id },
    {
      id: randomUUID(),
      user_id: clinicUser.id,
      category_id: clinicCategory.id,
      commercial_name: 'Clínica Central',
      description: 'Clínica médica con múltiples especialidades y médicos asociados. Ofrecemos atención integral de salud con tecnología de vanguardia.',
      verification_status: 'APPROVED',
      commission_percentage: 15.0,
    }
  );

  // Crear registro en tabla clinics
  const clinic = await findOrCreate<clinics>(
    prisma.clinics,
    { user_id: clinicUser.id },
    {
      id: randomUUID(),
      user_id: clinicUser.id,
      name: 'Clínica Central',
      address: 'Av. Principal 456, Quito',
      phone: '0998765432',
      whatsapp: '0998765432',
      description: 'Clínica médica con múltiples especialidades y médicos asociados. Ofrecemos atención integral de salud con tecnología de vanguardia.',
      is_active: true,
    }
  );

  // Crear especialidades de la clínica
  const clinicSpecialties = [
    'Medicina General',
    'Cardiología',
    'Pediatría',
    'Ginecología',
    'Traumatología',
    'Neurología',
  ];

  for (const specialty of clinicSpecialties) {
    await findOrCreate(
      prisma.clinic_specialties,
      { clinic_id: clinic.id, specialty },
      {
        id: randomUUID(),
        clinic_id: clinic.id,
        specialty,
      }
    );
  }

  // Crear horarios de la clínica
  const clinicSchedules = [
    { day: 'monday', start: '08:00:00', end: '18:00:00' },
    { day: 'tuesday', start: '08:00:00', end: '18:00:00' },
    { day: 'wednesday', start: '08:00:00', end: '18:00:00' },
    { day: 'thursday', start: '08:00:00', end: '18:00:00' },
    { day: 'friday', start: '08:00:00', end: '18:00:00' },
    { day: 'saturday', start: '09:00:00', end: '13:00:00' },
  ];

  for (const schedule of clinicSchedules) {
    const dayNum = dayToNumber(schedule.day);
    const existing = await prisma.clinic_schedules.findFirst({
      where: {
        clinic_id: clinic.id,
        day_of_week: dayNum,
      },
    });
    
    if (!existing) {
      await prisma.clinic_schedules.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          day_of_week: dayNum,
          enabled: true,
          start_time: new Date(`1970-01-01T${schedule.start}`),
          end_time: new Date(`1970-01-01T${schedule.end}`),
        },
      });
    }
  }

  console.log('✅ Clínica creada');

  // ==========================================
  // 8.1. Médicos Asociados a la Clínica
  // ==========================================
  console.log('👨‍⚕️ Creando médicos asociados a la clínica...');

  // Buscar algunos doctores existentes para asociarlos a la clínica
  const doctorsToAssociate = await prisma.providers.findMany({
    where: {
      service_categories: {
        slug: 'doctor'
      }
    },
    include: {
      users: true
    },
    take: 3
  });

  const clinicDoctors: clinic_doctors[] = [];
  const clinicDoctorNames: string[] = []; // Para usar en notificaciones
  for (let i = 0; i < doctorsToAssociate.length; i++) {
    const doctor = doctorsToAssociate[i];
    if (!doctor.users) continue;

    const clinicDoctor = await findOrCreate<clinic_doctors>(
      prisma.clinic_doctors,
      {
        clinic_id: clinic.id,
        user_id: doctor.users.id
      },
      {
        id: randomUUID(),
        clinic_id: clinic.id,
        user_id: doctor.users.id,
        office_number: `10${i + 1}`,
        is_active: true,
        is_invited: false,
      }
    );
    clinicDoctors.push(clinicDoctor);
    clinicDoctorNames.push(doctor.commercial_name ?? 'Doctor');
    console.log(`  ✅ Médico asociado: ${doctor.commercial_name}`);
  }

  // ==========================================
  // 8.2. Citas de la Clínica
  // ==========================================
  console.log('📅 Creando citas de la clínica...');

  // Buscar pacientes existentes
  const existingPatients = await prisma.patients.findMany({
    take: 3
  });

  if (clinicDoctors.length > 0 && existingPatients.length > 0) {
    // Obtener los providers correspondientes a los médicos asociados
    const providerIds: string[] = [];
    for (const clinicDoctor of clinicDoctors) {
      if (clinicDoctor.user_id) {
        const provider = await prisma.providers.findFirst({
          where: { user_id: clinicDoctor.user_id }
        });
        if (provider) {
          providerIds.push(provider.id);
        }
      }
    }

    if (providerIds.length > 0) {
      const today = new Date();
      const dates = [
        new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Mañana
        new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // Pasado mañana
        new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // En 3 días
      ];

      for (let i = 0; i < Math.min(3, dates.length); i++) {
        const appointmentDate = dates[i];
        appointmentDate.setHours(9 + i, 0, 0, 0);
        const providerId = providerIds[i % providerIds.length];

        await findOrCreate(
          prisma.appointments,
          {
            clinic_id: clinic.id,
            provider_id: providerId,
            scheduled_for: appointmentDate
          },
          {
            id: randomUUID(),
            clinic_id: clinic.id,
            provider_id: providerId,
            patient_id: existingPatients[i % existingPatients.length].id,
            scheduled_for: appointmentDate,
            status: i === 0 ? 'CONFIRMED' : 'CONFIRMED',
            reason: `Consulta de rutina - Cita ${i + 1}`,
            reception_status: i === 0 ? 'arrived' : null,
            reception_notes: i === 0 ? 'Paciente llegó puntual' : null,
            is_paid: false,
          }
        );
      }
      console.log(`  ✅ ${Math.min(3, dates.length)} citas creadas`);
    }
  }

  // ==========================================
  // 8.3. Mensajes de Recepción
  // ==========================================
  console.log('💬 Creando mensajes de recepción...');

  if (clinicDoctors.length > 0) {
    const messages = [
      {
        message: 'Buenos días Dr. Necesito confirmar su disponibilidad para la próxima semana.',
        sender_type: 'clinic',
      },
      {
        message: 'Buenos días. Sí, estoy disponible todos los días de la semana.',
        sender_type: 'doctor',
      },
      {
        message: 'Perfecto. Le enviaremos el calendario actualizado.',
        sender_type: 'clinic',
      },
    ];

    for (const msg of messages) {
      await prisma.reception_messages.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          doctor_id: clinicDoctors[0].id,
          message: msg.message,
          sender_type: msg.sender_type,
          is_read: msg.sender_type === 'doctor', // Los mensajes de clínica no leídos
        },
      });
    }
    console.log(`  ✅ ${messages.length} mensajes creados`);
  }

  // ==========================================
  // 8.4. Solicitudes de Bloqueo de Fecha
  // ==========================================
  console.log('🚫 Creando solicitudes de bloqueo de fecha...');

  if (clinicDoctors.length > 0) {
    const blockDate = new Date();
    blockDate.setDate(blockDate.getDate() + 7);
    blockDate.setHours(0, 0, 0, 0);

    await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        clinic_id: clinic.id,
        doctor_id: clinicDoctors[0].id,
        date: blockDate,
        reason: 'Vacaciones personales',
        status: 'pending',
      },
    });

    // Una solicitud aprobada
    const approvedDate = new Date();
    approvedDate.setDate(approvedDate.getDate() + 14);
    approvedDate.setHours(0, 0, 0, 0);

    await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        clinic_id: clinic.id,
        doctor_id: clinicDoctors[0].id,
        date: approvedDate,
        reason: 'Conferencia médica',
        status: 'approved',
      },
    });

    console.log('  ✅ 2 solicitudes de bloqueo creadas (1 pendiente, 1 aprobada)');
  }

  // ==========================================
  // 8.5. Notificaciones de Clínica
  // ==========================================
  console.log('🔔 Creando notificaciones de clínica...');

  if (clinicDoctors.length > 0 && existingPatients.length > 0) {
    const notifications = [
      {
        type: 'cita',
        title: 'Nueva cita agendada',
        body: `Dr. ${clinicDoctorNames[0]} - ${existingPatients[0].full_name} - ${new Date().toLocaleDateString('es-EC')} 09:00`,
        data: {
          appointment_id: randomUUID(),
          doctor_id: clinicDoctors[0].id,
          doctor_name: clinicDoctorNames[0],
          patient_name: existingPatients[0].full_name,
          date: new Date().toISOString().split('T')[0],
          time: '09:00',
        },
      },
      {
        type: 'cita_cancelada',
        title: 'Cita cancelada',
        body: `Dr. ${clinicDoctorNames[0]} - ${existingPatients[0].full_name} - ${new Date().toLocaleDateString('es-EC')} 10:00`,
        data: {
          appointment_id: randomUUID(),
          doctor_id: clinicDoctors[0].id,
          doctor_name: clinicDoctorNames[0],
          patient_name: existingPatients[0].full_name,
          date: new Date().toISOString().split('T')[0],
          time: '10:00',
        },
      },
    ];

    for (const notif of notifications) {
      await prisma.clinic_notifications.create({
        data: {
          id: randomUUID(),
          clinic_id: clinic.id,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          is_read: false,
          data: notif.data as any,
        },
      });
    }
    console.log(`  ✅ ${notifications.length} notificaciones creadas`);
  }

  // ==========================================
  // 9. Pacientes y Citas para pruebas
  // ==========================================
  console.log('👤 Creando pacientes y citas de prueba...');

  // A. Crear un Paciente de prueba
  const patientPassword = await bcrypt.hash('paciente123', 10);
  const patientUser = await findOrCreate<users>(
    prisma.users,
    { email: 'paciente@test.com' },
    {
      id: randomUUID(),
      email: 'paciente@test.com',
      password_hash: patientPassword,
      role: 'patient',
      is_active: true,
      profile_picture_url: 'https://i.pravatar.cc/300',
    }
  );

  const patientProfile = await findOrCreate<patients>(
    prisma.patients,
    { user_id: patientUser.id },
    {
      id: randomUUID(),
      user_id: patientUser.id,
      full_name: 'Pepito Pérez Test',
      phone: '0991234567',
    }
  );

  // B. Buscar al Dr. Juan Pérez
  const drJuan = await prisma.providers.findFirst({
    where: { commercial_name: 'Dr. Juan Pérez' }
  });

  if (drJuan) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    await findOrCreate<appointments>(
      prisma.appointments,
      { 
        patient_id: patientProfile.id,
        provider_id: drJuan.id,
        scheduled_for: tomorrow
      }, 
      {
        id: randomUUID(),
        patient_id: patientProfile.id, 
        provider_id: drJuan.id,
        branch_id: (await prisma.provider_branches.findFirst({ where: { provider_id: drJuan.id } }))?.id,
        scheduled_for: tomorrow,
        status: 'CONFIRMED',
        reason: 'Chequeo general y dolor de cabeza',
        is_paid: false
      }
    );
    console.log(`✅ Cita creada para el Dr. Juan Pérez con el paciente ${patientProfile.full_name}`);
  }

  console.log('🎉 Seed completado exitosamente!');
  console.log('\n📊 Resumen:');
  console.log('  - 2 Administradores');
  console.log('  - 5 Doctores');
  console.log('  - 4 Cadenas de Farmacias');
  console.log('  - 6 Farmacias');
  console.log('  - 3 Laboratorios');
  console.log('  - 2 Ambulancias');
  console.log('  - 2 Insumos Médicos');
  console.log('  - 1 Clínica');
  console.log(`  - ${clinicDoctors.length} Médicos Asociados a Clínica`);
  console.log('  - Citas de clínica creadas');
  console.log('  - Mensajes de recepción creados');
  console.log('  - Solicitudes de bloqueo creadas');
  console.log('  - Notificaciones de clínica creadas');
  console.log('  - 3 Ciudades');
  console.log('  - 6 Categorías de Servicio');
  console.log('  - 20 Especialidades Médicas');
}

main()
  .catch((e) => {
    console.error('❌ Error al crear datos iniciales:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
