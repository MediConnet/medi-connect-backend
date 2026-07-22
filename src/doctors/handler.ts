import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
  successResponse,
} from "../shared/response";

import {
  getAppointments,
  updateAppointmentStatus,
} from "./appointments.controller";
import { getDoctorAvailability } from "./availability.controller";
import { getBankAccount, upsertBankAccount } from "./bank-account.controller";
import {
  getBlockedSlots,
  createBlockedSlot,
  deleteBlockedSlot,
} from "./blocked-slots.controller";
import { 
  getConsultationPrices, 
  createConsultationPrice,
  updateConsultationPrice,
  deleteConsultationPrice,
} from "./consultation-prices.controller";
import { getDashboard } from "./dashboard.controller";
import { createDiagnosis, getDiagnosis } from "./diagnoses.controller";
import { 
  addSpecialty, 
  updateSpecialtyFee, 
  removeSpecialty 
} from "./manage-specialties.controller";
import { getPatients } from "./patients.controller";
import { getDoctorPaymentById, getDoctorPayments } from "./payments.controller";
import { getProfile, updateProfile } from "./profile.controller";
import { getSpecialties } from "./specialties.controller";
import { getDoctorReviews } from "./reviews.controller";
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from "./services.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info("Doctors handler invoked", { method, path });

  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // --- Services Catalog (Aesthetic Treatments / Provider Services) ---
    if (path === "/api/doctors/services") {
      if (method === "GET") return await getServices(event);
      if (method === "POST") return await createService(event);
    }

    if (path.startsWith("/api/doctors/services/")) {
      const serviceId = path.split("/").pop();
      if (serviceId && serviceId !== "services") {
        if (method === "PUT") return await updateService(event);
        if (method === "DELETE") return await deleteService(event);
      }
    }
    // --- Profile ---
    if (path === "/api/doctors/profile") {
      if (method === "GET") return await getProfile(event);
      if (method === "PUT") return await updateProfile(event);
    }

    // --- Dashboard ---
    if (path === "/api/doctors/dashboard") {
      if (method === "GET") return await getDashboard(event);
    }

    // --- Consultation Prices (Tarifas de Consulta) ---
    if (path === "/api/doctors/consultation-prices") {
      if (method === "GET") return await getConsultationPrices(event);
      if (method === "POST") return await createConsultationPrice(event);
    }

    // Update or delete specific consultation price
    if (path.startsWith("/api/doctors/consultation-prices/")) {
      const priceId = path.split('/').pop();
      if (priceId && priceId !== 'consultation-prices') {
        if (method === "PUT") return await updateConsultationPrice(event);
        if (method === "DELETE") return await deleteConsultationPrice(event);
      }
    }

    // --- Appointments ---
    if (path === "/api/doctors/appointments") {
      if (method === "GET") return await getAppointments(event);
    }

    // Update status (PUT /status)
    if (
      path.startsWith("/api/doctors/appointments/") &&
      path.endsWith("/status")
    ) {
      if (method === "PUT") return await updateAppointmentStatus(event);
    }

    // --- Availability (Horarios Disponibles) ---
    if (path === "/api/doctors/availability") {
      if (method === "GET") return await getDoctorAvailability(event);
    }

    // --- Diagnosis Routes (POST /diagnosis y GET /diagnosis) ---
    if (
      path.startsWith("/api/doctors/appointments/") &&
      path.endsWith("/diagnosis")
    ) {
      if (method === "POST") return await createDiagnosis(event);
      if (method === "GET") return await getDiagnosis(event);
    }

    // --- Patients ---
    if (path === "/api/doctors/patients") {
      if (method === "GET") return await getPatients(event);
    }

    // --- Reviews ---
    if (path === "/api/doctors/reviews" && method === "GET") {
      return await getDoctorReviews(event);
    }

    // --- Payments ---
    if (
      path === "/api/doctors/payments" ||
      path.startsWith("/api/doctors/payments?")
    ) {
      if (method === "GET") return await getDoctorPayments(event);
    }

    // Payment detail by ID
    if (path.startsWith("/api/doctors/payments/") && !path.includes("?")) {
      if (method === "GET") return await getDoctorPaymentById(event);
    }

    // --- Bank Account ---
    if (path === "/api/doctors/bank-account") {
      if (method === "GET") return await getBankAccount(event);
      if (method === "PUT") return await upsertBankAccount(event);
    }

    // --- Specialties ---
    if (path === "/api/specialties") {
      if (method === "GET") return await getSpecialties(event);
    }

    // --- Manage Specialties (Individual) ---
    if (path === "/api/doctors/specialties") {
      if (method === "POST") return await addSpecialty(event);
    }

    if (path.startsWith("/api/doctors/specialties/")) {
      const specialtyId = path.split('/').pop();
      if (specialtyId && specialtyId !== 'specialties') {
        if (method === "PUT") return await updateSpecialtyFee(event);
        if (method === "DELETE") return await removeSpecialty(event);
      }
    }

    // --- Blocked Slots (Independent Doctors) ---
    if (
      path === "/api/doctors/blocked-slots" ||
      path.startsWith("/api/doctors/blocked-slots?")
    ) {
      if (method === "GET") return await getBlockedSlots(event);
      if (method === "POST") return await createBlockedSlot(event);
    }

    if (path.startsWith("/api/doctors/blocked-slots/")) {
      if (method === "DELETE") return await deleteBlockedSlot(event);
    }

    return errorResponse("Not found", 404);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error: ${error.message}`);
    return internalErrorResponse(error.message || "Internal server error");
  }
}
