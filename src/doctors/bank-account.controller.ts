import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { requireAuth, AuthContext } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse } from '../shared/response';
import { parseBody, doctorBankAccountSchema } from '../shared/validators';

/**
 * GET /api/doctors/bank-account
 * Obtener datos bancarios del médico (independiente o asociado a clínica)
 */
export async function getBankAccount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const bankAccount = await prisma.doctor_bank_accounts.findUnique({
      where: { user_id: authContext.user.id },
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
 * Crear o actualizar datos bancarios del médico (independiente o asociado a clínica)
 */
export async function upsertBankAccount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const body = parseBody(event.body, doctorBankAccountSchema);
    const prisma = getPrismaClient();

    const existingAccount = await prisma.doctor_bank_accounts.findUnique({
      where: { user_id: authContext.user.id },
    });

    let bankAccount;

    if (existingAccount) {
      bankAccount = await prisma.doctor_bank_accounts.update({
        where: { user_id: authContext.user.id },
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
      bankAccount = await prisma.doctor_bank_accounts.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
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
