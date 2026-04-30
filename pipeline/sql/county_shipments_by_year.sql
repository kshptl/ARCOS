-- Inputs: master (fips, year, pop, pills, deaths, suppressed)
-- Output: fips, year, pills, pills_per_capita
SELECT
    fips,
    year,
    COALESCE(pills, 0)                              AS pills,
    CAST(COALESCE(pills, 0) AS DOUBLE)
        / NULLIF(pop, 0)                            AS pills_per_capita
FROM master
ORDER BY fips, year
