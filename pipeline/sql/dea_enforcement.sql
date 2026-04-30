-- Inputs: dea_enforcement (year, action_count, notable_actions)
-- Output: year, action_count, notable_actions (list of structs kept intact)
SELECT
    year,
    action_count,
    notable_actions
FROM dea_enforcement
ORDER BY year
