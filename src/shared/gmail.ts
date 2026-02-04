import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Configuración de OAuth2
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = path.join(process.cwd(), 'gmail-token.json');
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  'client_secret_480603606214-mk267u8e65jh73he4vlm7dhgllh10o9h.apps.googleusercontent.com (1).json'
);

interface GmailCredentials {
  web: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Cargar credenciales de OAuth2 desde el archivo JSON
 */
function loadCredentials(): GmailCredentials {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error('Error al cargar credenciales de Gmail: ' + error);
  }
}

/**
 * Crear cliente OAuth2
 */
function createOAuth2Client() {
  const credentials = loadCredentials();
  const { client_id, client_secret } = credentials.web;
  
  // Usar redirect URI configurado en Google Cloud Console
  // Debe coincidir exactamente con el configurado en la consola
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback';
  
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

/**
 * Obtener URL de autorización para OAuth2
 */
export function getAuthUrl(): string {
  const oAuth2Client = createOAuth2Client();
  
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Forzar consentimiento para obtener refresh_token
  });
}

/**
 * Guardar token en archivo
 */
function saveToken(token: TokenData): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  console.log('✅ Token guardado en:', TOKEN_PATH);
}

/**
 * Cargar token desde archivo
 */
function loadToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error al cargar token:', error);
  }
  return null;
}

/**
 * Obtener token desde código de autorización
 */
export async function getTokenFromCode(code: string): Promise<TokenData> {
  const oAuth2Client = createOAuth2Client();
  
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('No se recibieron tokens válidos');
    }
    
    const tokenData: TokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || SCOPES.join(' '),
      token_type: tokens.token_type || 'Bearer',
      expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
    };
    
    saveToken(tokenData);
    return tokenData;
  } catch (error: any) {
    throw new Error('Error al obtener token: ' + error.message);
  }
}

/**
 * Obtener cliente OAuth2 autenticado
 */
async function getAuthenticatedClient() {
  const oAuth2Client = createOAuth2Client();
  const token = loadToken();
  
  if (!token) {
    throw new Error(
      'No hay token guardado. Por favor, autoriza la aplicación primero visitando: /api/gmail/authorize'
    );
  }
  
  oAuth2Client.setCredentials(token);
  
  // Verificar si el token está expirado y renovarlo si es necesario
  if (token.expiry_date && Date.now() >= token.expiry_date) {
    console.log('🔄 Token expirado, renovando...');
    try {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      const newToken: TokenData = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || token.refresh_token,
        scope: credentials.scope || token.scope,
        token_type: credentials.token_type || token.token_type,
        expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000,
      };
      saveToken(newToken);
      oAuth2Client.setCredentials(newToken);
    } catch (error: any) {
      throw new Error('Error al renovar token: ' + error.message);
    }
  }
  
  return oAuth2Client;
}

/**
 * Crear mensaje en formato MIME para Gmail
 */
function createMimeMessage(to: string, subject: string, body: string, isHtml: boolean = false): string {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: ' + (isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'),
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ];
  
  const message = messageParts.join('\n');
  
  // Codificar en base64url
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Enviar correo usando Gmail API
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  isHtml: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    const encodedMessage = createMimeMessage(to, subject, body, isHtml);
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    
    console.log('✅ Correo enviado exitosamente:', response.data.id);
    
    return {
      success: true,
      messageId: response.data.id || undefined,
    };
  } catch (error: any) {
    console.error('❌ Error al enviar correo:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verificar si hay token guardado
 */
export function hasToken(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

/**
 * Eliminar token guardado
 */
export function deleteToken(): void {
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH);
    console.log('✅ Token eliminado');
  }
}
