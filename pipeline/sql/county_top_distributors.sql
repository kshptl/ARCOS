-- Inputs: wapo_distributors_by_county (fips, distributor, year, pills)
-- Output: fips, distributor, pills, share_pct
-- For each county, aggregate distributor pills across all years and compute
-- that distributor's share of the county's total. Keeps the top 10 per county
-- so /county/[fips] pages can render a manageable "Top distributors into this
-- county" chart.
WITH totals AS (
    SELECT fips, distributor, SUM(pills) AS pills
    FROM wapo_distributors_by_county
    GROUP BY fips, distributor
),
county_total AS (
    SELECT fips, SUM(pills) AS county_pills
    FROM totals
    GROUP BY fips
),
ranked AS (
    SELECT
        t.fips,
        t.distributor,
        t.pills,
        100.0 * t.pills / NULLIF(c.county_pills, 0) AS share_pct,
        ROW_NUMBER() OVER (PARTITION BY t.fips ORDER BY t.pills DESC) AS rn
    FROM totals t
    JOIN county_total c USING (fips)
)
SELECT fips, distributor, pills, share_pct
FROM ranked
WHERE rn <= 10
ORDER BY fips, pills DESC
