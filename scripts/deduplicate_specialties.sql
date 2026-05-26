-- Run this directly against your Render PostgreSQL database.
-- It deduplicates specialties, keeping only the oldest record per name
-- (which have descriptions and colors), and reassigns provider_specialties FKs.

BEGIN;

-- Step 1: Reassign provider_specialties to point to the ORIGINAL (oldest) specialty per name
UPDATE provider_specialties ps
SET specialty_id = keep.id
FROM (
    SELECT DISTINCT ON (s.name) s.id, s.name
    FROM specialties s
    ORDER BY s.name, s.created_at ASC
) keep
WHERE ps.specialty_id IN (
    SELECT s2.id
    FROM specialties s2
    WHERE s2.name = keep.name AND s2.id != keep.id
);

-- Step 2: Delete duplicate specialties (newer ones, no longer referenced)
DELETE FROM specialties s
WHERE s.id IN (
    SELECT s2.id
    FROM (
        SELECT id, name, created_at,
               ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) AS rn
        FROM specialties
    ) s2
    WHERE s2.rn > 1
);

-- Step 3: Add UNIQUE constraint on name
ALTER TABLE specialties ADD CONSTRAINT specialties_name_key UNIQUE (name);

COMMIT;
