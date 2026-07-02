import axios from "axios";
import crypto from "crypto";

const NUVEI_BASE_URL = process.env.NUVEI_BASE_URL || "https://ccapi-stg.paymentez.com";

export interface NuveiDebitRequest {
  cardToken: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  amount: number; // Decimal (e.g. 10.50)
  description: string;
  devReference: string;
  taxableAmount?: number;
  vat?: number;
}

export interface NuveiVerifyRequest {
  cardToken: string;
  userId: string;
  amount: number;
  developerReference: string;
  type: string; // e.g. "Diners"
}

export interface NuveiRefundRequest {
  transactionId: string;
  amount?: number; // Optional: If omitted, refunds the full amount
}

function getAuthHeaders() {
  const appCode = process.env.NUVEI_SERVER_APP_CODE || "NUVEISTG-EC-SERVER";
  const appKey = process.env.NUVEI_SERVER_APP_KEY || "Kn9v6ICvoRXQozQG2rK92WtjG6l08a";

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHash("sha256").update(appKey + timestamp).digest("hex");
  const tokenString = `${appCode};${timestamp};${signature}`;
  const authToken = Buffer.from(tokenString).toString("base64");

  return {
    "Auth-Token": authToken,
    "Content-Type": "application/json",
  };
}

export const nuveiService = {
  /**
   * Debita con token de tarjeta.
   */
  async debitWithToken(data: NuveiDebitRequest) {
    const url = `${NUVEI_BASE_URL}/v2/transaction/debit`;
    
    const requestBody = {
      user: {
        id: data.userId,
        email: data.userEmail,
        phone: data.userPhone || "+593999999999",
      },
      order: {
        amount: data.amount,
        description: data.description.substring(0, 250),
        dev_reference: data.devReference,
        vat: data.vat || 0,
        taxable_amount: data.taxableAmount || 0,
      },
      card: {
        token: data.cardToken,
      },
    };

    console.log(`📡 [NUVEI] Debitando con Token contra: ${url}`);
    
    try {
      const response = await axios.post(url, requestBody, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error("❌ [NUVEI] Error en débito:", error.response.data);
        throw new Error(JSON.stringify(error.response.data));
      }
      throw error;
    }
  },

  /**
   * Verifica transacciones Diners (Obligatorio).
   */
  async verifyTransaction(data: NuveiVerifyRequest) {
    const url = `${NUVEI_BASE_URL}/v2/transaction/verify`;

    const requestBody = {
      card: {
        token: data.cardToken,
      },
      user: {
        id: data.userId,
      },
      transaction: {
        amount: data.amount,
        dev_reference: data.developerReference,
      },
    };

    console.log(`📡 [NUVEI] Verificando transacción Diners/Discover contra: ${url}`);

    try {
      const response = await axios.post(url, requestBody, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error("❌ [NUVEI] Error en verificación Diners:", error.response.data);
        throw new Error(JSON.stringify(error.response.data));
      }
      throw error;
    }
  },

  /**
   * Procesa reembolsos (Obligatorio por banco).
   */
  async refund(data: NuveiRefundRequest) {
    const url = `${NUVEI_BASE_URL}/v2/transaction/refund`;

    const requestBody: any = {
      transaction: {
        id: data.transactionId,
      },
    };

    if (data.amount != null) {
      requestBody.transaction.amount = data.amount;
    }

    console.log(`📡 [NUVEI] Procesando reembolso de transacción ID: ${data.transactionId} contra: ${url}`);

    try {
      const response = await axios.post(url, requestBody, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error("❌ [NUVEI] Error en reembolso:", error.response.data);
        throw new Error(JSON.stringify(error.response.data));
      }
      throw error;
    }
  },
};
