import { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Eventos mock para testing local de handlers
 */

export function createMockEvent(
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
    pathParameters?: Record<string, string>;
    jwtClaims?: any;
  } = {}
): APIGatewayProxyEventV2 {
  const {
    body,
    headers = {},
    queryStringParameters,
    pathParameters,
    jwtClaims,
  } = options;

  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: queryStringParameters
      ? new URLSearchParams(queryStringParameters).toString()
      : '',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      ...(jwtClaims && {
        authorizer: {
          jwt: {
            claims: jwtClaims,
            scopes: [],
          },
        },
      }),
    },
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    pathParameters,
    queryStringParameters,
  };
}

// Eventos específicos para testing

export const loginEvent = createMockEvent('POST', '/api/auth/login', {
  body: {
    email: 'test@example.com',
    password: 'TestPassword123!',
  },
});

export const registerEvent = createMockEvent('POST', '/api/auth/register', {
  body: {
    email: 'newuser@example.com',
    password: 'NewPassword123!',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
  },
});

export const meEvent = createMockEvent('GET', '/api/auth/me', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-user-id-123',
    email: 'test@example.com',
  },
});

export const getDoctorProfileEvent = createMockEvent('GET', '/api/doctors/profile', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-user-id-123',
    email: 'doctor@example.com',
  },
});

export const updateDoctorProfileEvent = createMockEvent('PUT', '/api/doctors/profile', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-user-id-123',
    email: 'doctor@example.com',
  },
  body: {
    specialization: 'Cardiology',
    hospital: 'General Hospital',
    bio: 'Experienced cardiologist',
  },
});

export const getDoctorAppointmentsEvent = createMockEvent('GET', '/api/doctors/appointments', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-user-id-123',
    email: 'doctor@example.com',
  },
  queryStringParameters: {
    status: 'SCHEDULED',
    limit: '10',
    offset: '0',
  },
});

export const getAdminDashboardStatsEvent = createMockEvent('GET', '/api/admin/dashboard/stats', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-admin-id-123',
    email: 'admin@example.com',
  },
});

export const getAdminRequestsEvent = createMockEvent('GET', '/api/admin/requests', {
  headers: {
    Authorization: 'Bearer mock-jwt-token',
  },
  jwtClaims: {
    sub: 'cognito-admin-id-123',
    email: 'admin@example.com',
  },
  queryStringParameters: {
    type: 'all',
    status: 'PENDING',
  },
});

export const getStoresEvent = createMockEvent('GET', '/api/supplies/stores', {
  queryStringParameters: {
    limit: '20',
    offset: '0',
  },
});

export const getStoreEvent = createMockEvent('GET', '/api/supplies/stores/1', {});

export const getProductsEvent = createMockEvent('GET', '/api/supplies/products', {
  queryStringParameters: {
    search: 'paracetamol',
    limit: '50',
  },
});
