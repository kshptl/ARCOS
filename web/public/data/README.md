# web/public/data

This directory holds the JSON and Parquet artifacts emitted by `/pipeline`. It
is committed to the repo.

- **Pipeline → web contract**: Every file here MUST validate against a schema
  in `/pipeline/schemas/`. See the emission map in
  `/pipeline/src/openarcos_pipeline/emit.py`.
- **Regeneration**: run `make build-data` at the repo root, or trigger the
  `build-data` GitHub Action.
- **DO NOT hand-edit.** Changes here come from pipeline runs only.
