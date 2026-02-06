import {
  ChangePasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { randomUUID } from "crypto";
import { enum_roles } from "../generated/prisma/client";
import { requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
  unauthorizedResponse,
} from "../shared/response";
import { validatePayloadSize } from "../shared/security";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  parseBody,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from "../shared/validators";

// --- CONFIGURACIÓN ---
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";
const CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID || "";

// --- HELPERS ---

const getDeviceInfo = (event: APIGatewayProxyEventV2): string => {
  return (
    event.headers["user-agent"] ||
    event.headers["User-Agent"] ||
    "Dispositivo Desconocido"
  );
};

function generateLocalJWT(payload: {
  sub: string;
  email: string;
  role: string | null;
}): string {
  const header = { alg: "HS256", typ: "JWT" };
  const base64UrlEncode = (str: string): string =>
    Buffer.from(str)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    sub: payload.sub,
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    iat: now,
    exp: now + 3600,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  const secret = process.env.JWT_SECRET || "local-dev-secret-key";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function mapRoleToEnum(role: string): enum_roles {
  const roleMap: Record<string, enum_roles> = {
    PATIENT: enum_roles.patient,
    DOCTOR: enum_roles.provider,
    PHARMACY: enum_roles.provider,
    LABORATORY: enum_roles.provider,
    AMBULANCE: enum_roles.provider,
    CLINIC: enum_roles.provider,
    PROVIDER: enum_roles.provider,
    patient: enum_roles.patient,
    doctor: enum_roles.provider,
    provider: enum_roles.provider,
    admin: enum_roles.admin,
    user: enum_roles.user,
  };
  return (
    roleMap[role.toUpperCase()] ||
    roleMap[role.toLowerCase()] ||
    enum_roles.patient
  );
}

// HELPER: Crea el perfil de proveedor
async function createProviderProfile(prisma: any, userId: string, body: any) {
  const providerId = randomUUID();

  let representativeName = body.name;
  if (!representativeName && (body.firstName || body.lastName)) {
    representativeName = [body.firstName, body.lastName]
      .filter(Boolean)
      .join(" ");
  }
  if (!representativeName) representativeName = "Usuario Proveedor";

  let businessName = body.serviceName;
  if (!businessName) businessName = representativeName;

  const typeToSlug: Record<string, string> = {
    doctor: "doctor",
    pharmacy: "pharmacy",
    lab: "laboratory",
    laboratory: "laboratory",
    ambulance: "ambulance",
    supplies: "supplies",
    clinic: "clinic",
  };
  const categorySlug = body.type ? typeToSlug[body.type] || "doctor" : "doctor";

  const category = await prisma.service_categories.findFirst({
    where: { slug: categorySlug },
    select: { id: true },
  });
  const categoryId = category ? category.id : null;

  // Parsear experiencia para la tabla providers
  let yearsExp = 0;
  if (body.yearsOfExperience) {
    const parsedExp = parseInt(body.yearsOfExperience.toString(), 10);
    if (!isNaN(parsedExp)) yearsExp = parsedExp;
  }

  let specialtiesConnect = {};
  if (
    body.specialties &&
    Array.isArray(body.specialties) &&
    body.specialties.length > 0
  ) {
    specialtiesConnect = {
      connect: body.specialties.map((specialtyId: string) => ({
        id: specialtyId,
      })),
    };
  }

  // Crear Provider (Entidad Legal / Persona)
  await prisma.providers.create({
    data: {
      id: providerId,
      users: { connect: { id: userId } },

      commercial_name: representativeName,
      verification_status: "PENDING",
      description: body.description || "Perfil profesional",
      logo_url: null,

      ...(categoryId
        ? { service_categories: { connect: { id: categoryId } } }
        : {}),

      commission_percentage: 15.0,

      years_of_experience: yearsExp,

      specialties: specialtiesConnect,
    },
  });

  // Datos Adicionales para la Sucursal
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isValidCityId = body.cityId && uuidRegex.test(body.cityId);

  const fullAddress = body.address || "Sin dirección registrada";

  let fee = null;
  if (body.price) {
    const parsed = parseFloat(body.price.toString());
    if (!isNaN(parsed)) fee = parsed;
  }

  // Crear Sucursal (Local Físico)
  await prisma.provider_branches.create({
    data: {
      id: randomUUID(),

      providers: { connect: { id: providerId } },

      ...(isValidCityId ? { cities: { connect: { id: body.cityId } } } : {}),

      name: businessName,
      address_text: fullAddress,
      description: body.description || null,
      consultation_fee: fee,

      phone_contact: body.phone || body.whatsapp || null,
      email_contact: body.email,
      is_main: true,
      is_active: true,
    },
  });

  // Lógica Clínicas
  if (body.type === "clinic") {
    await prisma.clinics.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        name: businessName,
        address: fullAddress,
        phone: body.phone || "0000000000",
        is_active: false,
      },
    });
  }

  console.log(
    `✅ [HELPER] Proveedor "${representativeName}" creado con éxito con ${body.specialties?.length || 0} especialidades.`,
  );
}

// --- CONTROLLERS ---

export async function register(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    console.log("📝 [REGISTER] Procesando registro de usuario");
    validatePayloadSize(event);

    const body = parseBody(event.body, registerSchema);
    const prisma = getPrismaClient();

    const isLocalDev =
      process.env.STAGE === "dev" ||
      process.env.NODE_ENV === "development" ||
      !CLIENT_ID ||
      !USER_POOL_ID;

    // ==========================================
    // 🛠️ MODO DESARROLLO / FALLBACK LOCAL
    // ==========================================
    if (isLocalDev) {
      console.log("🔧 [REGISTER] Modo desarrollo local");

      const existingUser = await prisma.users.findFirst({
        where: { email: body.email },
      });
      if (existingUser) {
        return errorResponse("El usuario ya existe", 409);
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      const userRole = body.role
        ? mapRoleToEnum(body.role)
        : enum_roles.patient;

      const user = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: body.email,
          password_hash: passwordHash,
          role: userRole,
          is_active: true,
        },
      });

      if (userRole === enum_roles.patient) {
        const fullName =
          [body.firstName, body.lastName].filter(Boolean).join(" ") ||
          body.email;
        await prisma.patients.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            full_name: fullName,
            phone: body.phone || null,
          },
        });
      } else if (userRole === enum_roles.provider) {
        await createProviderProfile(prisma, user.id, body);
      }

      return successResponse(
        {
          userId: user.id,
          email: user.email,
          message: "Usuario registrado exitosamente",
        },
        201,
      );
    }

    // ==========================================
    // ☁️ MODO PRODUCCIÓN (COGNITO)
    // ==========================================
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        { Name: "email", Value: body.email },
        ...(body.phone ? [{ Name: "phone_number", Value: body.phone }] : []),
      ],
    });

    const cognitoResponse = await cognitoClient.send(signUpCommand);
    const cognitoSub = cognitoResponse.UserSub || randomUUID();
    const userRole = body.role ? mapRoleToEnum(body.role) : enum_roles.patient;

    const user = await prisma.users.create({
      data: {
        id: cognitoSub,
        email: body.email,
        password_hash: "",
        role: userRole,
      },
    });

    if (userRole === enum_roles.patient) {
      const fullName =
        [body.firstName, body.lastName].filter(Boolean).join(" ") || body.email;
      await prisma.patients.create({
        data: {
          id: randomUUID(),
          user_id: user.id,
          full_name: fullName,
          phone: body.phone || null,
        },
      });
    } else if (userRole === enum_roles.provider) {
      await createProviderProfile(prisma, user.id, body);
    }

    return successResponse(
      {
        userId: user.id,
        email: user.email,
        message:
          "Usuario registrado exitosamente. Por favor confirma tu email.",
      },
      201,
    );
  } catch (error: any) {
    console.error("❌ [REGISTER] Error al registrar usuario:", error.message);
    if (error.message.includes("Validation error"))
      return errorResponse(error.message, 400);
    if (error.name === "UsernameExistsException")
      return errorResponse("El usuario ya existe", 409);
    if (error.code === "P2002")
      return errorResponse("El usuario ya existe", 409);
    return internalErrorResponse("Error al registrar usuario");
  }
}

export async function login(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    console.log("🔐 [LOGIN] Procesando inicio de sesión");
    const body = parseBody(event.body, loginSchema);
    const isLocalDev =
      process.env.STAGE === "dev" ||
      process.env.NODE_ENV === "development" ||
      !CLIENT_ID ||
      !USER_POOL_ID;

    if (isLocalDev) {
      console.log("🔧 [LOGIN] Modo desarrollo local");
      const prisma = getPrismaClient();

      const user = await prisma.users.findFirst({
        where: { email: body.email },
      });

      if (!user) return unauthorizedResponse("Credenciales inválidas");

      const isProduction =
        process.env.STAGE === "prod" || process.env.NODE_ENV === "production";
      const isDevelopment = !isProduction;

      if (!user.is_active && !isDevelopment)
        return unauthorizedResponse("La cuenta de usuario está inactiva");
      if (!user.password_hash)
        return unauthorizedResponse("Credenciales inválidas");

      const passwordMatch = await bcrypt.compare(
        body.password,
        user.password_hash,
      );

      if (!passwordMatch) return unauthorizedResponse("Credenciales inválidas");

      let patientInfo = null;
      if (user.role === enum_roles.patient) {
        patientInfo = await prisma.patients.findFirst({
          where: { user_id: user.id },
          select: { full_name: true, phone: true },
        });
      }

      let providerInfo = null;
      let serviceType = null;

      if (user.role === enum_roles.provider) {
        const clinic = await prisma.clinics.findFirst({
          where: { user_id: user.id },
          select: { id: true, name: true, logo_url: true },
        });

        if (clinic) {
          providerInfo = {
            id: clinic.id,
            commercialName: clinic.name,
            logoUrl: clinic.logo_url,
          };
          serviceType = "clinic";
        } else {
          const provider = await prisma.providers.findFirst({
            where: {
              user_id: user.id,
            },
            include: {
              service_categories: { select: { slug: true, name: true } },
              pharmacy_chains: true,
            },
            orderBy: { id: "desc" },
          });

          if (provider) {
            // BLOQUEO DE LOGIN SI NO ES 'APPROVED'
            if (provider.verification_status !== "APPROVED") {
              return unauthorizedResponse(
                "Tu cuenta está en proceso de verificación. Debes esperar a ser aprobado para ingresar.",
              );
            }

            const isChainMember =
              !!provider.chain_id && !!provider.pharmacy_chains;
            const chain = provider.pharmacy_chains;

            providerInfo = {
              id: provider.id,
              commercialName:
                isChainMember && chain ? chain.name : provider.commercial_name,
              logoUrl:
                isChainMember && chain
                  ? chain.logo_url || null
                  : provider.logo_url,
              isChainMember: isChainMember,
              chainName: isChainMember && chain ? chain.name : null,
              chainLogo: isChainMember && chain ? chain.logo_url : null,
            };
            serviceType = provider.service_categories?.slug || null;
          }
        }
      }

      const jwtToken = generateLocalJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await prisma.sessions.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            token: jwtToken,
            device_info: getDeviceInfo(event),
            expires_at: expiresAt,
          },
        });

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        prisma.sessions
          .deleteMany({
            where: { expires_at: { lt: thirtyDaysAgo } },
          })
          .catch((err) => console.error("⚠️ [LOGIN] Error limpieza:", err));
      } catch (sessionError) {
        console.error("❌ [LOGIN] Error guardando sesión:", sessionError);
      }

      const normalizedRole = user.role
        ? String(user.role).toLowerCase()
        : "patient";
      const normalizedServiceType = serviceType
        ? String(serviceType).toLowerCase()
        : null;

      let firstName = "";
      let lastName = "";
      if (patientInfo && patientInfo.full_name) {
        const nameParts = patientInfo.full_name.trim().split(/\s+/);
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(" ") || "";
      }

      const responseData: any = {
        token: jwtToken,
        accessToken: jwtToken,
        refreshToken: jwtToken,
        idToken: jwtToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: normalizedRole,
          profilePictureUrl: user.profile_picture_url,
          firstName: firstName,
          lastName: lastName,
          name: patientInfo?.full_name || providerInfo?.commercialName || "",
          phone: patientInfo?.phone || null,
        },
      };

      if (providerInfo) {
        responseData.user.name = providerInfo.commercialName;
        responseData.user.provider = providerInfo;
      }

      if (normalizedServiceType) {
        responseData.user.serviceType = normalizedServiceType;
        responseData.user.tipo = normalizedServiceType;
      }

      return successResponse(responseData);
    }

    console.log("🔐 [LOGIN] Autenticando con Cognito");
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: body.email, PASSWORD: body.password },
    });

    const response = await cognitoClient.send(authCommand);
    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    console.error("❌ [LOGIN] Error:", error.message);
    if (error.name === "NotAuthorizedException")
      return unauthorizedResponse("Credenciales inválidas");
    return internalErrorResponse("Error al iniciar sesión");
  }
}

export async function logout(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const token = event.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const prisma = getPrismaClient();
      await prisma.sessions.updateMany({
        where: { token: token },
        data: { revoked_at: new Date() },
      });
    }
    return successResponse({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    return successResponse({ message: "Sesión cerrada" });
  }
}

export async function refresh(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, refreshTokenSchema);
    const refreshToken = body.refreshToken;
    const isLocalDev =
      process.env.STAGE === "dev" ||
      process.env.NODE_ENV === "development" ||
      !CLIENT_ID ||
      !USER_POOL_ID;

    if (isLocalDev) {
      const parts = refreshToken.split(".");
      if (parts.length !== 3)
        return unauthorizedResponse("Formato de token inválido");

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
      const decoded = JSON.parse(jsonPayload);

      const prisma = getPrismaClient();
      const user = await prisma.users.findFirst({
        where: { OR: [{ id: decoded.sub }, { email: decoded.email }] },
      });

      if (!user) return unauthorizedResponse("Usuario no encontrado");

      const normalizedRole = user.role
        ? String(user.role).toLowerCase()
        : "patient";
      const newToken = generateLocalJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      let serviceType = null;
      let providerInfo = null;
      if (user.role === enum_roles.provider) {
        const provider = await prisma.providers.findFirst({
          where: {
            user_id: user.id,
            verification_status: { in: ["APPROVED", "PENDING"] },
          },
          include: {
            service_categories: { select: { slug: true } },
            pharmacy_chains: true,
          },
          orderBy: { id: "desc" },
        });
        if (provider) {
          serviceType = provider.service_categories?.slug;
          const isChainMember =
            !!provider.chain_id && !!provider.pharmacy_chains;
          const chain = provider.pharmacy_chains;
          providerInfo = {
            id: provider.id,
            commercialName:
              isChainMember && chain ? chain.name : provider.commercial_name,
            logoUrl:
              isChainMember && chain
                ? chain.logo_url || null
                : provider.logo_url,
            isChainMember: isChainMember,
            chainName: isChainMember && chain ? chain.name : null,
            chainLogo: isChainMember && chain ? chain.logo_url : null,
          };
        }
      }
      const normalizedServiceType = serviceType
        ? String(serviceType).toLowerCase()
        : null;

      const responseData: any = {
        token: newToken,
        accessToken: newToken,
        refreshToken: newToken,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: normalizedRole,
        },
      };

      if (normalizedServiceType) {
        responseData.user.serviceType = normalizedServiceType;
        responseData.user.tipo = normalizedServiceType;
      }

      if (providerInfo) {
        responseData.user.name = providerInfo.commercialName;
        responseData.user.provider = providerInfo;
      }

      return successResponse(responseData);
    }

    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    const response = await cognitoClient.send(authCommand);
    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: refreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    logger.error("Error in refresh", error);
    return internalErrorResponse("Error al refrescar token");
  }
}

export async function me(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("👤 [ME] Obteniendo info usuario");
  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;

  const prisma = getPrismaClient();
  const user = await prisma.users.findUnique({
    where: { id: authResult.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      profile_picture_url: true,
      is_active: true,
      created_at: true,
    },
  });

  if (!user) return notFoundResponse("Usuario no encontrado");

  const normalizedRole = user.role
    ? String(user.role).toLowerCase()
    : "patient";
  const responseData: any = {
    id: user.id,
    userId: user.id,
    email: user.email,
    role: normalizedRole,
    profilePictureUrl: user.profile_picture_url,
    isActive: user.is_active,
    createdAt: user.created_at,
  };

  if (user.role === enum_roles.provider) {
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: user.id,
        verification_status: { in: ["APPROVED", "PENDING"] },
      },
      include: {
        service_categories: { select: { slug: true, name: true } },
        pharmacy_chains: true,
      },
      orderBy: { id: "desc" },
    });

    if (provider) {
      const serviceType = provider.service_categories?.slug || null;
      const normalizedServiceType = serviceType
        ? String(serviceType).toLowerCase()
        : null;

      const isChainMember = !!provider.chain_id && !!provider.pharmacy_chains;
      const chain = provider.pharmacy_chains;
      const displayName =
        isChainMember && chain ? chain.name : provider.commercial_name;
      const displayLogo =
        isChainMember && chain ? chain.logo_url || null : provider.logo_url;

      if (normalizedServiceType) {
        responseData.serviceType = normalizedServiceType;
        responseData.tipo = normalizedServiceType;
      }
      responseData.name = displayName;
      responseData.provider = {
        id: provider.id,
        commercialName: displayName,
        logoUrl: displayLogo,
        isChainMember: isChainMember,
        chainName: isChainMember && chain ? chain.name : null,
        chainLogo: isChainMember && chain ? chain.logo_url : null,
      };
    }
  }

  return successResponse(responseData);
}

export async function changePassword(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;

  try {
    const body = parseBody(event.body, changePasswordSchema);
    const cmd = new ChangePasswordCommand({
      AccessToken: event.headers.authorization?.replace("Bearer ", "") || "",
      PreviousPassword: body.currentPassword,
      ProposedPassword: body.newPassword,
    });
    await cognitoClient.send(cmd);
    return successResponse({ message: "Contraseña cambiada exitosamente" });
  } catch (error: any) {
    return internalErrorResponse("Error al cambiar contraseña");
  }
}

export async function forgotPassword(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, forgotPasswordSchema);
    const cmd = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
    });
    await cognitoClient.send(cmd);
    return successResponse({
      message: "Código de recuperación enviado",
    });
  } catch (error: any) {
    return successResponse({
      message: "Si el correo existe, se ha enviado un código de recuperación",
    });
  }
}

export async function resetPassword(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, resetPasswordSchema);
    const cmd = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
      ConfirmationCode: body.code,
      Password: body.newPassword,
    });
    await cognitoClient.send(cmd);
    return successResponse({ message: "Contraseña restablecida exitosamente" });
  } catch (error: any) {
    if (error.name === "CodeMismatchException")
      return errorResponse("Código de verificación inválido", 400);
    return internalErrorResponse("Error al restablecer la contraseña");
  }
}
