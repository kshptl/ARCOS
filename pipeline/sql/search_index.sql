-- Inputs:
--   county_metadata   (fips, name, state, pop)
--   wapo_distributors (distributor, year, pills)
--   wapo_pharmacies   (pharmacy_id, name, address, fips, total_pills)
--
-- Output columns (uniform across entity types; some fields null per type):
--   type        — 'county' | 'city' | 'zip' | 'distributor' | 'pharmacy'
--   id          — stable id (fips / zip / distributor-slug / pharmacy_id)
--   label       — user-visible primary label
--   sublabel    — user-visible secondary label
--   fips        — linking FIPS where applicable
--   state       — USPS abbrev where applicable
--   total_pills — total pills associated (nullable)
--
-- 'city' and 'zip' rows come from distinct addresses in wapo_pharmacies.
WITH counties AS (
    SELECT
        'county'                                   AS type,
        fips                                       AS id,
        name                                       AS label,
        state                                      AS sublabel,
        fips,
        state,
        NULL::DOUBLE                               AS total_pills
    FROM county_metadata
),
distributors AS (
    SELECT
        'distributor'                              AS type,
        LOWER(REGEXP_REPLACE(distributor, '[^A-Za-z0-9]+', '-', 'g')) AS id,
        distributor                                AS label,
        CAST(SUM(pills) AS VARCHAR)                AS sublabel,
        NULL                                       AS fips,
        NULL                                       AS state,
        SUM(pills)                                 AS total_pills
    FROM wapo_distributors
    GROUP BY distributor
),
pharmacies AS (
    SELECT
        'pharmacy'                                 AS type,
        pharmacy_id                                AS id,
        name                                       AS label,
        address                                    AS sublabel,
        fips,
        NULL                                       AS state,
        total_pills
    FROM wapo_pharmacies
),
cities AS (
    -- A pharmacy's address is "N STREET" in the fixture. Real data has city
    -- and state embedded; disabled until real data lands with a parsable city column.
    SELECT DISTINCT
        'city'                                     AS type,
        LOWER(REGEXP_REPLACE(address, '[^A-Za-z0-9]+', '-', 'g')) AS id,
        address                                    AS label,
        fips                                       AS sublabel,
        fips,
        NULL                                       AS state,
        NULL::DOUBLE                               AS total_pills
    FROM wapo_pharmacies
    WHERE FALSE
),
zips AS (
    -- Use [[:digit:]]{5} instead of \d{5}\b; DuckDB supports POSIX classes.
    SELECT DISTINCT
        'zip'                                      AS type,
        REGEXP_EXTRACT(address, '([[:digit:]]{5})', 1) AS id,
        REGEXP_EXTRACT(address, '([[:digit:]]{5})', 1) AS label,
        fips                                       AS sublabel,
        fips,
        NULL                                       AS state,
        NULL::DOUBLE                               AS total_pills
    FROM wapo_pharmacies
    WHERE REGEXP_EXTRACT(address, '([[:digit:]]{5})', 1) <> ''
)
SELECT type, id, label, sublabel, fips, state, total_pills FROM counties
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM distributors
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM pharmacies
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM cities
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM zips
ORDER BY type, id
