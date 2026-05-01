-- Inputs: dea_enforcement (year, action_count, by_type, notable_actions)
-- Output: year, action_count, by_type (map as JSON/struct), notable_actions
SELECT
    year,
    action_count,
    by_type,
    notable_actions
FROM dea_enforcement
ORDER BY year
