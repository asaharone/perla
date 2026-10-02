#!/usr/bin/env bash
# Perla Helsa · Board Cockpit · оновлення знімка з BigQuery
# Потрібен gcloud з доступом до perla-holistic-com (gcloud auth login) або
# у сесії Claude — коннектор BigQuery: тоді запити з sql/ запускає Claude і зберігає результат у data/raw/<name>.json.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT=perla-holistic-com
for f in sql/*.sql; do
  name=$(basename "$f" .sql); name=${name#??_}
  echo "→ $name"
  bq query --use_legacy_sql=false --format=json --project_id="$PROJECT" --max_rows=10000 < "$f" > "data/raw/$name.json"
done
python3 build.py
