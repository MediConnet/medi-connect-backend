import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';

/**
 * Listar médicos públicos (sin autenticación)
 * GET /api/public/doctors
 */
export async function getAllDoctors(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC DOCTORS] GET /api/public/doctors - Listando médicos públicos');
  
  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    // Parámetros de paginación
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;
    
    // Filtros
    const specialty = queryParams.specialty;
    const city = queryParams.city;
    const search = queryParams.search;
    
    // Construir where clause
    const where: any = {
      verification_status: 'APPROVED', // Solo médicos aprobados
      category_id: 1, // Solo médicos (category_id = 1)
      users: {
        is_active: true,
      },
      provider_branches: {
        some: {
          is_active: true, // Al menos una branch activa
        },
      },
    };
    
    // Filtrar por especialidad
    if (specialty) {
      where.specialties = {
        some: {
          name: {
            contains: specialty,
            mode: 'insensitive',
          },
        },
      };
    }
    
    // Filtrar por ciudad (a través de branches)
    if (city) {
      where.provider_branches = {
        some: {
          is_active: true,
          cities: {
            name: {
              contains: city,
              mode: 'insensitive',
            },
          },
        },
      };
    }
    
    // Búsqueda por nombre o especialidad
    if (search) {
      where.OR = [
        {
          commercial_name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          specialties: {
            some: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }
    
    // Obtener médicos
    const [doctors, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        include: {
          users: {
            select: {
              email: true,
              profile_picture_url: true,
            },
          },
          specialties: {
            select: {
              id: true,
              name: true,
              color_hex: true,
            },
          },
          provider_branches: {
            where: {
              is_main: true,
              is_active: true,
            },
            take: 1,
            include: {
              cities: {
                select: {
                  id: true,
                  name: true,
                },
              },
              provider_schedules: {
                where: {
                  is_active: true,
                },
                orderBy: {
                  day_of_week: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          commercial_name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.providers.count({ where }),
    ]);
    
    // Transformar datos para el frontend
    const formattedDoctors = doctors.map(doctor => {
      const mainBranch = doctor.provider_branches[0];
      const specialty = doctor.specialties[0];
      
      // Debug: verificar especialidades
      if (doctor.specialties && doctor.specialties.length > 0) {
        console.log(`✅ [PUBLIC DOCTORS] Doctor ${doctor.commercial_name} tiene ${doctor.specialties.length} especialidad(es):`, doctor.specialties.map(s => s.name));
      } else {
        console.log(`⚠️ [PUBLIC DOCTORS] Doctor ${doctor.commercial_name} NO tiene especialidades asignadas`);
      }
      
      return {
        id: doctor.id,
        nombre: doctor.commercial_name || '',
        apellido: '', // Los médicos usan commercial_name completo
        especialidad: specialty?.name || '',
        especialidadId: specialty?.id || '',
        descripcion: doctor.description || '',
        experiencia: doctor.years_of_experience || 0,
        registro: '', // No disponible en el schema actual
        telefono: mainBranch?.phone_contact || '',
        email: doctor.users?.email || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        codigoPostal: '', // No disponible
        horarioAtencion: formatSchedule(mainBranch?.provider_schedules || []),
        imagen: doctor.logo_url || doctor.users?.profile_picture_url || '',
        calificacion: mainBranch?.rating_cache || 0,
        latitud: mainBranch?.latitude || null,
        longitud: mainBranch?.longitude || null,
        tarifas: {
          consulta: mainBranch?.consultation_fee ? Number(mainBranch.consultation_fee) : 0,
        },
        formasPago: mainBranch?.payment_methods || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    
    console.log(`✅ [PUBLIC DOCTORS] Se encontraron ${formattedDoctors.length} médicos (total: ${total})`);
    
    return successResponse({
      doctors: formattedDoctors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC DOCTORS] Error al listar médicos:', error.message);
    logger.error('Error fetching public doctors', error);
    return internalErrorResponse('Failed to fetch doctors', event);
  }
}

/**
 * Obtener médico público por ID
 * GET /api/public/doctors/{id}
 */
export async function getDoctorById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC DOCTORS] GET /api/public/doctors/{id} - Obteniendo médico');
  
  try {
    const pathParts = event.requestContext.http.path.split('/');
    const doctorId = pathParts[pathParts.length - 1];
    
    if (!doctorId) {
      return errorResponse('Doctor ID is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const doctor = await prisma.providers.findFirst({
      where: {
        id: doctorId,
        verification_status: 'APPROVED',
        category_id: 1, // Solo médicos (category_id = 1)
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        specialties: {
          select: {
            id: true,
            name: true,
            color_hex: true,
            description: true,
          },
        },
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
          include: {
            cities: {
              select: {
                id: true,
                name: true,
                state: true,
              },
            },
            provider_schedules: {
              where: {
                is_active: true,
              },
              orderBy: {
                day_of_week: 'asc',
              },
            },
          },
        },
      },
    });
    
    if (!doctor) {
      return errorResponse('Doctor not found', 404, undefined, event);
    }
    
    const mainBranch = doctor.provider_branches[0];
    const specialty = doctor.specialties[0];
    
    const formattedDoctor = {
      id: doctor.id,
      nombre: doctor.commercial_name || '',
      apellido: '',
      especialidad: specialty?.name || '',
      especialidadId: specialty?.id || '',
      descripcion: doctor.description || '',
      experiencia: doctor.years_of_experience || 0,
      registro: '',
      telefono: mainBranch?.phone_contact || '',
      email: doctor.users?.email || '',
      direccion: mainBranch?.address_text || '',
      ciudad: mainBranch?.cities?.name || '',
      codigoPostal: '',
      horarioAtencion: formatSchedule(mainBranch?.provider_schedules || []),
      imagen: doctor.logo_url || doctor.users?.profile_picture_url || '',
      calificacion: mainBranch?.rating_cache || 0,
      latitud: mainBranch?.latitude || null,
      longitud: mainBranch?.longitude || null,
      tarifas: {
        consulta: mainBranch?.consultation_fee ? Number(mainBranch.consultation_fee) : 0,
      },
      formasPago: mainBranch?.payment_methods || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log(`✅ [PUBLIC DOCTORS] Médico encontrado: ${formattedDoctor.nombre}`);
    return successResponse(formattedDoctor, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC DOCTORS] Error al obtener médico:', error.message);
    logger.error('Error fetching doctor by id', error);
    return internalErrorResponse('Failed to fetch doctor', event);
  }
}

/**
 * Buscar médicos
 * GET /api/public/doctors/search?q={query}
 */
export async function searchDoctors(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC DOCTORS] GET /api/public/doctors/search - Buscando médicos');
  
  try {
    const queryParams = event.queryStringParameters || {};
    const query = queryParams.q || queryParams.query || '';
    
    if (!query || query.trim().length === 0) {
      return errorResponse('Search query is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const doctors = await prisma.providers.findMany({
      where: {
        verification_status: 'APPROVED',
        category_id: 1, // Solo médicos (category_id = 1)
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
        OR: [
          {
            commercial_name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            specialties: {
              some: {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            provider_branches: {
              some: {
                cities: {
                  name: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        specialties: {
          select: {
            id: true,
            name: true,
            color_hex: true,
          },
          take: 1,
        },
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
          include: {
            cities: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 20,
    });
    
    const formattedDoctors = doctors.map(doctor => {
      const mainBranch = doctor.provider_branches[0];
      const specialty = doctor.specialties[0];
      
      return {
        id: doctor.id,
        nombre: doctor.commercial_name || '',
        apellido: '',
        especialidad: specialty?.name || '',
        especialidadId: specialty?.id || '',
        descripcion: doctor.description || '',
        experiencia: doctor.years_of_experience || 0,
        registro: '',
        telefono: mainBranch?.phone_contact || '',
        email: doctor.users?.email || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        codigoPostal: '',
        horarioAtencion: '',
        imagen: doctor.logo_url || doctor.users?.profile_picture_url || '',
        calificacion: mainBranch?.rating_cache || 0,
        latitud: mainBranch?.latitude || null,
        longitud: mainBranch?.longitude || null,
        tarifas: {
          consulta: mainBranch?.consultation_fee ? Number(mainBranch.consultation_fee) : 0,
        },
        formasPago: mainBranch?.payment_methods || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    
    console.log(`✅ [PUBLIC DOCTORS] Se encontraron ${formattedDoctors.length} médicos para "${query}"`);
    return successResponse(formattedDoctors, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC DOCTORS] Error al buscar médicos:', error.message);
    logger.error('Error searching doctors', error);
    return internalErrorResponse('Failed to search doctors', event);
  }
}

/**
 * Helper para formatear horarios
 */
function formatSchedule(schedules: any[]): string {
  if (!schedules || schedules.length === 0) {
    return 'Horario no disponible';
  }
  
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const activeDays = schedules
    .filter(s => s.is_active)
    .map(s => {
      const dayName = days[s.day_of_week] || '';
      const startTime = s.start_time ? new Date(s.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
      const endTime = s.end_time ? new Date(s.end_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
      return `${dayName} ${startTime}-${endTime}`;
    });
  
  return activeDays.length > 0 ? activeDays.join(', ') : 'Horario no disponible';
}

