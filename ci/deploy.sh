#!/usr/bin/env bash
# Deploy the built web assets to the S3 origin bucket and invalidate CloudFront.
# Run from the repo root after `npm --prefix web run build`.
set -euo pipefail

# AWS credentials for the flipfeedback-web-assets deploy bucket.
AWS_ACCESS_KEY_ID="AKIAZK75BVCTQ3ENNF4K"
AWS_SECRET_ACCESS_KEY="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"
AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION

BUCKET="${WEB_ASSETS_BUCKET:-flipfeedback-web-assets}"
DIST_ID="${WEB_CF_DISTRIBUTION:-E12ZYHYOIPZ7ES}"

aws s3 sync web/dist "s3://$BUCKET/" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
echo "deployed web assets to $BUCKET"
