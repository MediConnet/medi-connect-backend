import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { requireAuth, AuthContext } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse } from '../shared/response';
import { parseBody, doctorBankAccountSchema } from '../shared/validators';

/**
 * GET /api/doctors/bank-account
 * Obtener datos bancarios del médico asociado a clínica
 */
export async function getBankAccount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    // Buscar asociación del médico con clínica
    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    // Buscar cuenta bancaria
    const bankAccount = await prisma.doctor_bank_accounts.findUnique({
      where: {
        doctor_id: doctorAssociation.id,
      },
    });

    if (!bankAccount) {
      return successResponse({ data: null });
    }

    return successResponse({
      data: {
        bankName: bankAccount.bank_name,
        accountNumber: bankAccount.account_number,
        accountType: bankAccount.account_type,
        accountHolder: bankAccount.account_holder,
        identificationNumber: bankAccount.identification_number || undefined,
        createdAt: bankAccount.created_at?.toISOString(),
        updatedAt: bankAccount.updated_at?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error getting bank account:', error);
    return internalErrorResponse(error.message || 'Error al obtener cuenta bancaria');
  }
}

/**
 * PUT /api/doctors/bank-account
 * Crear o actualizar datos bancarios del médico (UPSERT)
 */
export async function upsertBankAccount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const body = parseBody(event.body, doctorBankAccountSchema);

    const prisma = getPrismaClient();

    // Buscar asociación del médico con clínica
    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    // Verificar si ya existe cuenta bancaria
    const existingAccount = await prisma.doctor_bank_accounts.findUnique({
      where: {
        doctor_id: doctorAssociation.id,
      },
    });

    let bankAccount;

    if (existingAccount) {
      // Actualizar cuenta existente
      bankAccount = await prisma.doctor_bank_accounts.update({
        where: {
          doctor_id: doctorAssociation.id,
        },
        data: {
          bank_name: body.bankName,
          account_number: body.accountNumber,
          account_type: body.accountType,
          account_holder: body.accountHolder,
          identification_number: body.identificationNumber || null,
          updated_at: new Date(),
        },
      });
    } else {
      // Crear nueva cuenta
      bankAccount = await prisma.doctor_bank_accounts.create({
        data: {
          id: randomUUID(),
          doctor_id: doctorAssociation.id,
          bank_name: body.bankName,
          account_number: body.accountNumber,
          account_type: body.accountType,
          account_holder: body.accountHolder,
          identification_number: body.identificationNumber || null,
        },
      });
    }

    return successResponse({
      data: {
        bankName: bankAccount.bank_name,
        accountNumber: bankAccount.account_number,
        accountType: bankAccount.account_type,
        accountHolder: bankAccount.account_holder,
        identificationNumber: bankAccount.identification_number || undefined,
        createdAt: bankAccount.created_at?.toISOString(),
        updatedAt: bankAccount.updated_at?.toISOString(),
      },
      message: existingAccount ? 'Cuenta bancaria actualizada correctamente' : 'Cuenta bancaria creada correctamente',
    });
  } catch (error: any) {
    console.error('Error upserting bank account:', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse(error.message || 'Error al guardar cuenta bancaria');
  }
}
