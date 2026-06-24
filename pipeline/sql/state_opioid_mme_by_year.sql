-- Inputs:
--   dea_retail_state_mme_year - state-level MME rows parsed from DEA retail PDFs.
-- Output columns feed web/public/data/state-opioid-mme-by-year.json.
SELECT
    state_fips,
    state,
    year,
    population,
    mme,
    mme_per_capita,
    mme_per_100k,
    included_drug_codes,
    excluded_drug_codes,
    source_urls
FROM dea_retail_state_mme_year
ORDER BY state_fips, year
