-- Inputs: master (fips, year, pop, pills, mme, deaths, suppressed)
-- Output: fips, year, pills, pills_per_capita, mme_per_capita
SELECT
    fips,
    year,
    COALESCE(pills, 0)                              AS pills,
    CAST(COALESCE(pills, 0) AS DOUBLE)
        / NULLIF(pop, 0)                            AS pills_per_capita,
    CAST(mme AS DOUBLE) / NULLIF(pop, 0)            AS mme_per_capita
FROM master
ORDER BY fips, year
