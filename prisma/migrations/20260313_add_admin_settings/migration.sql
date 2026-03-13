-- CreateTable
CREATE TABLE "admin_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "commission_doctor" DECIMAL(5,2) DEFAULT 15.00,
  "commission_clinic" DECIMAL(5,2) DEFAULT 10.00,
  "commission_laboratory" DECIMAL(5,2) DEFAULT 12.00,
  "commission_pharmacy" DECIMAL(5,2) DEFAULT 8.00,
  "commission_supplies" DECIMAL(5,2) DEFAULT 10.00,
  "commission_ambulance" DECIMAL(5,2) DEFAULT 15.00,
  "notify_new_requests" BOOLEAN DEFAULT TRUE,
  "notify_email_summary" BOOLEAN DEFAULT TRUE,
  "auto_approve_services" BOOLEAN DEFAULT FALSE,
  "maintenance_mode" BOOLEAN DEFAULT FALSE,
  "only_admin_can_publish_ads" BOOLEAN DEFAULT TRUE,
  "require_ad_approval" BOOLEAN DEFAULT TRUE,
  "max_ads_per_provider" INTEGER DEFAULT 1,
  "ad_approval_required" BOOLEAN DEFAULT TRUE,
  "service_approval_required" BOOLEAN DEFAULT TRUE,
  "allow_service_self_activation" BOOLEAN DEFAULT FALSE,
  "allow_ad_self_publishing" BOOLEAN DEFAULT FALSE,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_settings_id_check" CHECK ("id" = 1)
);

-- Insert default values
INSERT INTO "admin_settings" ("id") VALUES (1);
