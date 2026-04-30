-- Inputs: master (fips, year, deaths, suppressed)
-- Output: fips, year, deaths, suppressed
-- Preserves nulls and the suppressed flag verbatim.
SELECT
    fips,
    year,
    deaths,
    suppressed
FROM master
WHERE deaths IS NOT NULL OR suppressed = TRUE
ORDER BY fips, year
