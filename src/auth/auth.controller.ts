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
import { isMultipartContentType, parseMultipartBody } from "../shared/multipart";
import { storeFilesLocally } from "../shared/uploads";
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

  // Validación de UUIDs
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isValidCityId = body.cityId && uuidRegex.test(body.cityId);
  const isValidChainId = body.chainId && uuidRegex.test(body.chainId);

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

      // ⭐ Conectar con cadena de farmacia si se proporciona chainId válido
      ...(isValidChainId
        ? { pharmacy_chains: { connect: { id: body.chainId } } }
        : {}),

      commission_percentage: 15.0,

      years_of_experience: yearsExp,

      specialties: specialtiesConnect,
      documents: body.documents ?? [],
    },
  });

  // Datos Adicionales para la Sucursal

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

  return providerId;
}

// --- CONTROLLERS ---

export async function register(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    console.log("📝 [REGISTER] Procesando registro de usuario");

    const contentType =
      event.headers["content-type"] ||
      event.headers["Content-Type"] ||
      event.headers["CONTENT-TYPE"] ||
      "";

    // ⭐ Multipart (documentos) necesita un límite mayor que JSON
    const isMultipart = isMultipartContentType(contentType);
    validatePayloadSize(event, isMultipart ? 25 * 1024 * 1024 : 200 * 1024);

    let body: any;
    let uploadedDocuments: any[] = [];

    if (isMultipart) {
      const parsed = await parseMultipartBody({
        body: event.body || undefined,
        isBase64Encoded: (event as any).isBase64Encoded,
        headers: event.headers as any,
        limits: { fileSize: 15 * 1024 * 1024, files: 20, fields: 200 },
      });

      const f = parsed.fields;
      const specialtiesRaw = f["specialties"];
      const specialties = Array.isArray(specialtiesRaw)
        ? specialtiesRaw
        : specialtiesRaw
          ? [specialtiesRaw]
          : undefined;

      body = registerSchema.parse({
        email: f["email"],
        password: f["password"],
        firstName: f["firstName"],
        lastName: f["lastName"],
        name: f["name"],
        serviceName: f["serviceName"],
        yearsOfExperience: f["yearsOfExperience"],
        phone: f["phone"],
        role: f["role"],
        address: f["address"],
        cityId: f["cityId"],
        city: f["city"],
        description: f["description"],
        price: f["price"],
        chainId: f["chainId"],
        type: f["type"],
        specialties,
        whatsapp: f["whatsapp"],
      });

      const baseUrl =
        process.env.FILE_BASE_URL ||
        `http://localhost:${process.env.PORT || 3000}`;

      uploadedDocuments = await storeFilesLocally({
        files: parsed.files.map((x) => ({
          fieldname: x.fieldname,
          filename: x.filename,
          mimetype: x.mimetype,
          buffer: x.buffer,
          size: x.size,
        })),
        baseUrl,
      });
    } else {
      body = parseBody(event.body, registerSchema);
    }

    const prisma = getPrismaClient();

    const requestedRole = body.role ? mapRoleToEnum(body.role) : enum_roles.patient;

    const isLocalDev =
      process.env.STAGE === "dev" ||
      process.env.NODE_ENV === "development" ||
      !CLIENT_ID ||
      !USER_POOL_ID;

    // =====================================================
    // ✅ Manejo idempotente para SOLICITUDES PROFESIONALES
    // =====================================================
    // Si el usuario ya existe y está intentando registrarse como profesional/proveedor,
    // validamos credenciales y (si falta) creamos el perfil de proveedor.
    const existingUser = await prisma.users.findFirst({
      where: { email: body.email },
    });

    if (existingUser) {
      if (requestedRole === enum_roles.provider) {
        // Validar contraseña (local: bcrypt; prod: cognito auth)
        if (isLocalDev) {
          if (!existingUser.password_hash) {
            return unauthorizedResponse("Credenciales inválidas");
          }
          const ok = await bcrypt.compare(body.password, existingUser.password_hash);
          if (!ok) return unauthorizedResponse("Credenciales inválidas");
        } else {
          try {
            await cognitoClient.send(
              new InitiateAuthCommand({
                AuthFlow: "USER_PASSWORD_AUTH",
                ClientId: CLIENT_ID,
                AuthParameters: {
                  USERNAME: body.email,
                  PASSWORD: body.password,
                },
              }),
            );
          } catch (err: any) {
            if (err?.name === "UserNotConfirmedException") {
              return errorResponse(
                "Usuario no confirmado. Por favor confirma tu email.",
                403,
              );
            }
            return unauthorizedResponse("Credenciales inválidas");
          }
        }

        // Asegurar role provider (sin romper cuentas ya existentes)
        if (existingUser.role !== enum_roles.provider) {
          await prisma.users.update({
            where: { id: existingUser.id },
            data: { role: enum_roles.provider },
          });
        }

        // Crear perfil proveedor si no existe
        const existingProvider = await prisma.providers.findFirst({
          where: { user_id: existingUser.id },
          select: { id: true },
        });

        if (!existingProvider) {
          const providerId = await createProviderProfile(prisma, existingUser.id, {
            ...body,
            documents: uploadedDocuments,
          });
          return successResponse(
            {
              userId: existingUser.id,
              email: existingUser.email,
              providerId,
              message: "Solicitud enviada exitosamente",
            },
            201,
          );
        }

        // Si el proveedor ya existe, tratamos este POST como reenvío de solicitud:
        // - actualizamos documentos si llegaron
        // - y marcamos el estado como PENDING para que aparezca en Admin /requests
        if (uploadedDocuments.length > 0) {
          await prisma.providers.update({
            where: { id: existingProvider.id },
            data: {
              documents: uploadedDocuments,
              verification_status: "PENDING",
            },
          });
        } else {
          // Si no llegaron documentos, no forzamos el cambio de estado.
          // (Evita mover a PENDING un proveedor aprobado por un simple reintento sin adjuntos)
        }

        // Si es clínica y no existe registro de clínica, crearlo (evitar P2002 por user_id único)
        if (body.type === "clinic") {
          const existingClinic = await prisma.clinics.findFirst({
            where: { user_id: existingUser.id },
            select: { id: true },
          });
          if (!existingClinic) {
            const representativeName =
              body.name ||
              [body.firstName, body.lastName].filter(Boolean).join(" ") ||
              "Usuario Proveedor";
            const businessName = body.serviceName || representativeName;
            const fullAddress = body.address || "Sin dirección registrada";
            await prisma.clinics.create({
              data: {
                id: randomUUID(),
                user_id: existingUser.id,
                name: businessName,
                address: fullAddress,
                phone: body.phone || "0000000000",
                whatsapp: (body as any).whatsapp || body.phone || "0000000000",
                is_active: false,
              },
            });
          }
        }

        return successResponse(
          {
            userId: existingUser.id,
            email: existingUser.email,
            message:
              uploadedDocuments.length > 0
                ? "Solicitud reenviada exitosamente"
                : "La solicitud ya fue enviada previamente",
          },
          200,
        );
      }

      // Para pacientes (u otros roles), mantenemos el comportamiento actual
      return errorResponse("El usuario ya existe", 409);
    }

    // ==========================================
    // 🛠️ MODO DESARROLLO / FALLBACK LOCAL
    // ==========================================
    if (isLocalDev) {
      console.log("🔧 [REGISTER] Modo desarrollo local");

      const passwordHash = await bcrypt.hash(body.password, 10);
      const userRole = requestedRole;

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
        await createProviderProfile(prisma, user.id, {
          ...body,
          documents: uploadedDocuments,
        });
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
    const userRole = requestedRole;

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
      await createProviderProfile(prisma, user.id, {
        ...body,
        documents: uploadedDocuments,
      });
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
    if (error.message === "Payload too large")
      return errorResponse("Payload too large", 413);
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
          // El frontend NO envía 'type', así que inferimos el tipo del provider más reciente aprobado
          const typeToSlug: Record<string, string> = {
            doctor: "doctor",
            pharmacy: "pharmacy",
            lab: "laboratory",
            laboratory: "laboratory",
            ambulance: "ambulance",
            supplies: "supplies",
            clinic: "clinic",
          };

          // Usamos `any` aquí para simplificar el tipado de las relaciones incluidas
          // (service_categories, pharmacy_chains) y evitar problemas con los tipos generados de Prisma.
          let provider: any = null;

          // Si el frontend envía 'type' (opcional), buscar ese tipo específico
          if (body.type) {
            const typeKey = body.type.toLowerCase();
            const categorySlug = typeToSlug[typeKey] ?? typeKey;

            console.log(`🔍 [LOGIN] Frontend envió type=${categorySlug}, buscando provider de ese tipo para user_id: ${user.id}`);

            provider = await prisma.providers.findFirst({
              where: {
                user_id: user.id,
                service_categories: {
                  slug: categorySlug,
                },
                verification_status: "APPROVED",
              },
              include: {
                service_categories: { select: { slug: true, name: true } },
                pharmacy_chains: true,
              },
              orderBy: {
                id: "desc", // Más reciente primero
              },
            });

            if (provider) {
              console.log(`✅ [LOGIN] Provider encontrado (con type): ${provider.id} - ${provider.commercial_name} (${categorySlug})`);
            }
          }

          // SIEMPRE buscar el provider más reciente aprobado (inferir tipo automáticamente)
          // Esto asegura que si no viene 'type' o no se encontró, devolvemos el más reciente
          if (!provider) {
            console.log(`🔍 [LOGIN] Buscando provider más reciente aprobado para user_id: ${user.id} (sin filtro de tipo)`);
            
            provider = await prisma.providers.findFirst({
              where: {
                user_id: user.id,
                verification_status: "APPROVED", // Solo providers aprobados
              },
              include: {
                service_categories: { select: { slug: true, name: true } },
                pharmacy_chains: true,
              },
              orderBy: {
                id: "desc", // Más reciente primero (el último creado/aprobado)
              },
            });

            if (provider) {
              const detectedType = provider.service_categories?.slug || 'unknown';
              console.log(`✅ [LOGIN] Provider encontrado (más reciente): ${provider.id} - ${provider.commercial_name} (tipo: ${detectedType})`);
            } else {
              console.log(`⚠️ [LOGIN] No se encontró ningún provider aprobado para user_id: ${user.id}`);
            }
          }

          if (provider) {
            // Verificar status (aunque ya filtramos por APPROVED, por seguridad)
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
            
            // ⭐ CRÍTICO: Siempre establecer serviceType desde el provider encontrado
            serviceType = provider.service_categories?.slug || null;
            
            console.log(`📋 [LOGIN] Provider seleccionado: ID=${provider.id}, Tipo=${serviceType}, Nombre=${provider.commercial_name}`);
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

      // ⭐ CRÍTICO: Siempre establecer 'tipo' si hay provider (frontend lo necesita para guards)
      if (normalizedServiceType) {
        responseData.user.serviceType = normalizedServiceType;
        responseData.user.tipo = normalizedServiceType; // Frontend usa esto para guards
      } else if (providerInfo) {
        // Si hay providerInfo pero no serviceType, intentar inferirlo
        console.warn(`⚠️ [LOGIN] Provider encontrado pero sin serviceType. providerInfo:`, providerInfo);
        // Esto no debería pasar, pero por seguridad:
        responseData.user.tipo = null;
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
    console.log("🔑 [FORGOT-PASSWORD] Procesando solicitud de recuperación");
    const body = parseBody(event.body, forgotPasswordSchema);
    
    // Validar email
    if (!body.email || !body.email.includes("@")) {
      return errorResponse("Email inválido", 400);
    }
    
    const prisma = getPrismaClient();
    
    // Buscar usuario en la base de datos
    const user = await prisma.users.findFirst({
      where: { email: body.email.toLowerCase() },
    });
    
    // IMPORTANTE: Siempre responder lo mismo (seguridad)
    // No revelar si el email existe o no
    const standardResponse = {
      success: true,
      message: "Si el email está registrado, recibirás un enlace de recuperación en los próximos minutos.",
    };
    
    // Si el usuario no existe, responder igual pero no hacer nada más
    if (!user) {
      console.log(`⚠️ [FORGOT-PASSWORD] Intento con email no registrado: ${body.email}`);
      return successResponse(standardResponse);
    }
    
    // Verificar límite de intentos (máximo 3 por hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await prisma.password_resets.count({
      where: {
        email: body.email.toLowerCase(),
        created_at: { gte: oneHourAgo },
      },
    });
    
    if (recentAttempts >= 3) {
      console.log(`⚠️ [FORGOT-PASSWORD] Límite de intentos excedido para: ${body.email}`);
      return errorResponse("Demasiados intentos. Por favor intenta en 1 hora.", 429);
    }
    
    // Generar token único y seguro
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    // Hashear el token antes de guardarlo (seguridad)
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    
    // Guardar en base de datos
    await prisma.password_resets.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        email: user.email.toLowerCase(),
        token: hashedToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        used: false,
      },
    });
    
    // Obtener nombre del usuario
    let userName = "Usuario";
    if (user.role === enum_roles.patient) {
      const patient = await prisma.patients.findFirst({
        where: { user_id: user.id },
        select: { full_name: true },
      });
      if (patient?.full_name) userName = patient.full_name;
    } else if (user.role === enum_roles.provider) {
      const provider = await prisma.providers.findFirst({
        where: { user_id: user.id },
        select: { commercial_name: true },
      });
      if (provider?.commercial_name) userName = provider.commercial_name;
    }
    
    // Enviar email (con token SIN hashear)
    const { sendEmail } = await import("../shared/email-adapter");
    const { generatePasswordResetEmail } = await import("../shared/email");
    
    const emailHtml = generatePasswordResetEmail({
      userName,
      resetToken, // Token sin hashear para el enlace
    });
    
    await sendEmail({
      to: user.email,
      subject: "Recuperación de Contraseña - DOCALINK",
      html: emailHtml,
    });
    
    console.log(`✅ [FORGOT-PASSWORD] Email de recuperación enviado a: ${user.email}`);
    
    return successResponse(standardResponse);
  } catch (error: any) {
    console.error("❌ [FORGOT-PASSWORD] Error:", error.message);
    logger.error("Error in forgotPassword", error);
    return internalErrorResponse("Error al procesar solicitud. Por favor intenta nuevamente.");
  }
}

export async function resetPassword(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    console.log("🔐 [RESET-PASSWORD] Procesando reseteo de contraseña");
    const body = parseBody(event.body, resetPasswordSchema);
    
    // Validar datos
    if (!body.token || !body.newPassword) {
      return errorResponse("Token y nueva contraseña son requeridos", 400);
    }
    
    if (body.newPassword.length < 6) {
      return errorResponse("La contraseña debe tener al menos 6 caracteres", 400);
    }
    
    const prisma = getPrismaClient();
    
    // Hashear el token recibido para comparar
    const hashedToken = crypto
      .createHash("sha256")
      .update(body.token)
      .digest("hex");
    
    // Buscar token en base de datos
    const resetRequest = await prisma.password_resets.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expires_at: { gt: new Date() }, // No expirado
      },
    });
    
    if (!resetRequest) {
      console.log("⚠️ [RESET-PASSWORD] Token inválido o expirado");
      return errorResponse(
        "Token inválido o expirado. Por favor solicita un nuevo enlace de recuperación.",
        400
      );
    }
    
    // Buscar usuario
    const user = await prisma.users.findUnique({
      where: { id: resetRequest.user_id },
    });
    
    if (!user) {
      console.log("⚠️ [RESET-PASSWORD] Usuario no encontrado para token válido");
      return notFoundResponse("Usuario no encontrado");
    }
    
    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    
    // Actualizar contraseña del usuario
    await prisma.users.update({
      where: { id: user.id },
      data: { password_hash: hashedPassword },
    });
    
    // Marcar token como usado
    await prisma.password_resets.update({
      where: { id: resetRequest.id },
      data: {
        used: true,
        used_at: new Date(),
      },
    });
    
    // (Opcional) Invalidar todas las sesiones activas del usuario
    await prisma.sessions.updateMany({
      where: { user_id: user.id },
      data: { revoked_at: new Date() },
    });
    
    console.log(`✅ [RESET-PASSWORD] Contraseña actualizada exitosamente para: ${user.email}`);
    
    return successResponse({
      success: true,
      message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.",
    });
  } catch (error: any) {
    console.error("❌ [RESET-PASSWORD] Error:", error.message);
    logger.error("Error in resetPassword", error);
    return internalErrorResponse("Error al restablecer contraseña. Por favor intenta nuevamente.");
  }
}
