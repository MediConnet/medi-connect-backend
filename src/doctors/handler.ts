import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getDashboard, getProfile, updateProfile, updateSchedule } from './profile.controller';
import { getSpecialties } from './specialties.controller';
// 1. Importamos el nuevo controller
import { getAppointments, updateAppointmentStatus } from './appointments.controller';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`Doctors handler invoked: ${method} ${path}`);

  // --- RUTAS DE PERFIL ---
  if (path === '/api/doctors/profile' && method === 'GET') {
    return getProfile(event);
  }
  if (path === '/api/doctors/profile' && method === 'PUT') {
    return updateProfile(event);
  }

  // --- RUTA: DASHBOARD ---
  if (path === '/api/doctors/dashboard' && method === 'GET') {
    return getDashboard(event);
  }

  // --- RUTA: HORARIOS ---
  if (path === '/api/doctors/schedule' && (method === 'PUT' || method === 'POST')) {
    return updateSchedule(event);
  }

  // --- ESPECIALIDADES ---
  if (path === '/api/specialties' && method === 'GET') {
    return getSpecialties(event);
  }

  // --- CITAS (APPOINTMENTS) ---
  if (path === '/api/doctors/appointments' && method === 'GET') {
    return getAppointments(event);
  }

  // --- CITAS: ACTUALIZAR ESTADO ---
  if (path.match(/^\/api\/doctors\/appointments\/[a-zA-Z0-9-]+\/status$/) && method === 'PUT') {
    return updateAppointmentStatus(event);
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: `Route ${method} ${path} not found` }),
  };
};