-- Inputs: wapo_pharmacies (pharmacy_id, name, address, fips, total_pills)
-- Output: pharmacy_id, name, address, fips, total_pills
-- Deduplicates by pharmacy_id (summing pills if the source has per-year rows).
SELECT
    pharmacy_id,
    FIRST(name) AS name,
    FIRST(address) AS address,
    FIRST(fips) AS fips,
    SUM(total_pills) AS total_pills
FROM wapo_pharmacies
GROUP BY pharmacy_id
ORDER BY total_pills DESC
