-- Inputs: wapo_distributors (distributor, year, pills)
-- Output: distributor, year, pills, share_pct
-- Keeps top 10 distributors per year by pill volume.
WITH totals AS (
    SELECT distributor, year, SUM(pills) AS pills
    FROM wapo_distributors
    GROUP BY distributor, year
),
national AS (
    SELECT year, SUM(pills) AS national_pills
    FROM totals
    GROUP BY year
),
ranked AS (
    SELECT
        t.distributor,
        t.year,
        t.pills,
        100.0 * t.pills / NULLIF(n.national_pills, 0) AS share_pct,
        ROW_NUMBER() OVER (PARTITION BY t.year ORDER BY t.pills DESC) AS rn
    FROM totals t
    JOIN national n USING (year)
)
SELECT distributor, year, pills, share_pct
FROM ranked
WHERE rn <= 10
ORDER BY year, pills DESC
