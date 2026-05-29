/**
 * @deprecated Este archivo ha sido migrado a src/clinics/doctor-associated.controller.ts
 * Mantenido temporalmente para compatibilidad con despliegues existentes.
 * Todas las nuevas integraciones deben usar las rutas en src/clinics/handler.ts
 */
export {
  getClinicInfo,
  getClinicProfile,
  updateClinicProfile,
  getClinicAppointments,
  updateClinicAppointmentStatus,
  getReceptionMessages,
  createReceptionMessage,
  markReceptionMessagesAsRead,
  getDateBlocks,
  requestDateBlock,
  getClinicNotifications,
} from '../clinics/doctor-associated.controller';
