-- CreateEnum
CREATE TYPE "enum_appt_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "enum_notif_types" AS ENUM ('REMINDER', 'SYSTEM', 'BOOKING', 'cita', 'laboratorio', 'farmacia', 'ambulancia', 'insumo', 'sistema');

-- CreateEnum
CREATE TYPE "enum_roles" AS ENUM ('admin', 'user', 'provider', 'patient');

-- CreateEnum
CREATE TYPE "enum_verification" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "branch_id" UUID,
    "provider_id" UUID,
    "scheduled_for" TIMESTAMP(6),
    "status" VARCHAR(255),
    "reason" TEXT,
    "is_paid" BOOLEAN DEFAULT false,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "state" VARCHAR(255),
    "country" VARCHAR(255),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_history" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "provider_id" UUID,
    "doctor_name_snapshot" VARCHAR(255),
    "specialty_snapshot" VARCHAR(255),
    "diagnosis" TEXT,
    "date" TIMESTAMP(6),
    "treatment" TEXT,
    "indications" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "enum_notif_types" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN DEFAULT false,
    "data" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_favorites" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "branch_id" UUID,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(255) NOT NULL,
    "identification" VARCHAR(255),
    "phone" VARCHAR(20),
    "birth_date" DATE,
    "address_text" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "appointment_id" UUID,
    "payout_id" UUID,
    "stripe_payment_intent_id" VARCHAR(255),
    "amount_total" DECIMAL,
    "platform_fee" DECIMAL,
    "provider_amount" DECIMAL,
    "status" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "total_amount" DECIMAL,
    "currency" VARCHAR(3) DEFAULT 'USD',
    "status" VARCHAR(255),
    "reference_number" VARCHAR(255),
    "period_start" TIMESTAMP(6),
    "period_end" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_ads" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "badge_text" VARCHAR(255),
    "title" VARCHAR(255),
    "subtitle" VARCHAR(255),
    "image_url" VARCHAR(255),
    "action_text" VARCHAR(255),
    "bg_color_hex" VARCHAR(7),
    "accent_color_hex" VARCHAR(7),
    "target_screen" VARCHAR(255),
    "target_id" VARCHAR(255),
    "start_date" TIMESTAMP(6),
    "end_date" TIMESTAMP(6),
    "is_active" BOOLEAN DEFAULT true,
    "priority_order" INTEGER,

    CONSTRAINT "provider_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_bank_details" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "bank_name" VARCHAR(255),
    "account_number" VARCHAR(255),
    "account_type" VARCHAR(50),
    "account_holder_name" VARCHAR(255),
    "holder_identification" VARCHAR(255),
    "is_verified" BOOLEAN DEFAULT false,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_branches" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "city_id" UUID,
    "name" VARCHAR(255),
    "description" TEXT,
    "address_text" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone_contact" VARCHAR(20),
    "email_contact" VARCHAR(255),
    "image_url" VARCHAR(255),
    "opening_hours_text" TEXT,
    "is_24h" BOOLEAN DEFAULT false,
    "has_delivery" BOOLEAN DEFAULT false,
    "rating_cache" DOUBLE PRECISION DEFAULT 0,
    "is_main" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "provider_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_catalog" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "type" VARCHAR(255),
    "name" VARCHAR(255),
    "description" TEXT,
    "price" DECIMAL,
    "is_available" BOOLEAN DEFAULT true,
    "image_url" VARCHAR(255),

    CONSTRAINT "provider_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_schedules" (
    "id" UUID NOT NULL,
    "branch_id" UUID,
    "day_of_week" INTEGER,
    "start_time" TIME(6),
    "end_time" TIME(6),

    CONSTRAINT "provider_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "category_id" INTEGER,
    "commercial_name" VARCHAR(255),
    "logo_url" VARCHAR(255),
    "description" TEXT,
    "verification_status" VARCHAR(255),
    "commission_percentage" DECIMAL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "branch_id" UUID,
    "appointment_id" UUID,
    "rating" INTEGER,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "default_color_hex" VARCHAR(7),
    "allows_booking" BOOLEAN DEFAULT true,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "token" VARCHAR(255) NOT NULL,
    "device_info" VARCHAR(255),
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "color_hex" VARCHAR(7),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "enum_roles",
    "profile_picture_url" VARCHAR(255),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_providersTospecialties" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_providersTospecialties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "idx_notifications_patient_created" ON "notifications"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "_providersTospecialties_B_index" ON "_providersTospecialties"("B");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "provider_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_favorites" ADD CONSTRAINT "patient_favorites_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "provider_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_favorites" ADD CONSTRAINT "patient_favorites_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_ads" ADD CONSTRAINT "provider_ads_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_bank_details" ADD CONSTRAINT "provider_bank_details_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_branches" ADD CONSTRAINT "provider_branches_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_branches" ADD CONSTRAINT "provider_branches_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_catalog" ADD CONSTRAINT "provider_catalog_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_schedules" ADD CONSTRAINT "provider_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "provider_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "provider_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "_providersTospecialties" ADD CONSTRAINT "_providersTospecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_providersTospecialties" ADD CONSTRAINT "_providersTospecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
