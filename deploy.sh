#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Missing .env — need MONGODB_URI and JWT_SECRET"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${MONGODB_URI:?MONGODB_URI required}"
: "${JWT_SECRET:?JWT_SECRET required}"

CLIENT_ORIGIN="${CLIENT_ORIGIN:-http://localhost:5175}"

echo "==> sam build"
sam build

echo "==> sam deploy"
# Only pass params without spaces. Company defaults live in template.yaml / Mongo.
sam deploy \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "MongoDbUri=${MONGODB_URI}" \
    "JwtSecret=${JWT_SECRET}" \
    "ClientOrigin=${CLIENT_ORIGIN}"

echo "==> outputs"
aws cloudformation describe-stacks \
  --stack-name smi-delivery-challan \
  --region ap-south-1 \
  --query 'Stacks[0].Outputs' \
  --output table
