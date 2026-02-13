import axios from "axios";

// URL de producción para Links
const PAYPHONE_LINKS_URL = "https://pay.payphonetodoesposible.com/api/Links";

/**
 * Interfaz para petición a payphone.
 */
export interface PayPhoneLinkRequest {
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  service?: number;
  tip?: number;
  currency?: string;
  reference: string;
  clientTransactionId: string;
  storeId?: string;
  additionalData?: string;
  oneTime?: boolean;
  expireIn?: number;
}

export const payPhoneService = {
  /**
   * Genera un Link de Pago.
   * Retorna: La URL de pago (string) directamente.
   */
  async createPaymentLink(data: PayPhoneLinkRequest): Promise<string> {
    try {
      const token = process.env.PAYPHONE_TOKEN;
      const storeId = process.env.PAYPHONE_STORE_ID;

      if (!token || !storeId) {
        throw new Error(
          "CONFIG ERROR: Faltan credenciales de PayPhone en .env",
        );
      }

      // Construcción del body
      const requestBody = {
        ...data,
        storeId: storeId,
        currency: data.currency || "USD",
        oneTime: true,
      };

      console.log("📡 Conectando con PayPhone API (/Links)...");

      const response = await axios.post(PAYPHONE_LINKS_URL, requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const paymentUrl = response.data;

      if (typeof paymentUrl !== "string") {
        console.warn("⚠️ Respuesta inesperada de PayPhone:", paymentUrl);
      }

      console.log("✅ Link de PayPhone generado");
      return paymentUrl;
    } catch (error: any) {
      if (error.response) {
        console.error("❌ Respuesta de Error PayPhone:", {
          status: error.response.status,
          data: error.response.data,
        });
        throw new Error(JSON.stringify(error.response.data));
      } else if (error.request) {
        console.error("❌ No hubo respuesta de PayPhone (Timeout/Red)");
        throw new Error("No hubo respuesta del servidor de pagos");
      } else {
        console.error("❌ Error configurando petición:", error.message);
        throw new Error(error.message);
      }
    }
  },
};
