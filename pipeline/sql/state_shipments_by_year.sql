-- Inputs (registered as views by aggregate.py):
--   master  — (fips, year, pop, pills, deaths, suppressed)
-- Output columns: state, year, pills, pills_per_capita
SELECT
    LEFT(fips, 2)                                   AS state_fips,
    year,
    SUM(COALESCE(pills, 0))                         AS pills,
    CAST(SUM(COALESCE(pills, 0)) AS DOUBLE)
        / NULLIF(SUM(COALESCE(pop, 0)), 0)          AS pills_per_capita
FROM master
GROUP BY LEFT(fips, 2), year
ORDER BY state_fips, year
