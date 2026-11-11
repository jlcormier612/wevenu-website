#!/usr/bin/env bash
# Idempotent Sandbox-only ops canaries: Resend usage gauges + SNS→Resend email fanout.
# Does not touch Production, billing, Spend Cap, or Resend plan settings.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_NAME="htc-sandbox-ops-canary-role"
TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:htc-sandbox-ops-alerts"
RESEND_SECRET_ARN="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:htc/sandbox/resend-api-key*"
SUPABASE_SECRET_ARN="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:htc/sandbox/supabase-service-role-key*"
SUPABASE_URL="${SUPABASE_URL:-https://wvpsldwwjqdannqasrdf.supabase.co}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LAMBDA_ENV="Variables={RESEND_SECRET_ID=htc/sandbox/resend-api-key,SUPABASE_SERVICE_ROLE_SECRET_ID=htc/sandbox/supabase-service-role-key,SUPABASE_URL=${SUPABASE_URL},OPS_ALERT_TO=jennifer@hellotocheers.com,OPS_ALERT_FROM=Hello to Cheers Ops <jennifer@hellotocheers.com>}"

echo "account=${ACCOUNT_ID} region=${REGION}"

# --- IAM role ---
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null
fi

aws iam put-role-policy --role-name "${ROLE_NAME}" --policy-name htc-sandbox-ops-canary-inline --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],
      \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:*\"
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"cloudwatch:PutMetricData\"],
      \"Resource\": \"*\",
      \"Condition\": {\"StringEquals\": {\"cloudwatch:namespace\": \"HTC/Sandbox\"}}
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"secretsmanager:GetSecretValue\"],
      \"Resource\": [\"${RESEND_SECRET_ARN}\", \"${SUPABASE_SECRET_ARN}\"]
    }
  ]
}"

ROLE_ARN="$(aws iam get-role --role-name "${ROLE_NAME}" --query Role.Arn --output text)"
# IAM eventual consistency (role assume can lag after create/put-role-policy)
sleep 12

deploy_lambda() {
  local name="$1"
  local dir="$2"
  local handler="$3"
  local timeout="$4"
  local zip="/tmp/${name}.zip"
  (cd "${dir}" && zip -q -r "${zip}" handler.py)
  if aws lambda get-function --function-name "${name}" --region "${REGION}" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "${name}" --zip-file "fileb://${zip}" --region "${REGION}" >/dev/null
    aws lambda wait function-updated --function-name "${name}" --region "${REGION}"
    aws lambda update-function-configuration \
      --function-name "${name}" \
      --role "${ROLE_ARN}" \
      --runtime python3.12 \
      --handler "${handler}" \
      --timeout "${timeout}" \
      --memory-size 256 \
      --environment "${LAMBDA_ENV}" \
      --region "${REGION}" >/dev/null
    aws lambda wait function-updated --function-name "${name}" --region "${REGION}"
  else
    aws lambda create-function \
      --function-name "${name}" \
      --runtime python3.12 \
      --role "${ROLE_ARN}" \
      --handler "${handler}" \
      --timeout "${timeout}" \
      --memory-size 256 \
      --zip-file "fileb://${zip}" \
      --environment "${LAMBDA_ENV}" \
      --region "${REGION}" >/dev/null
  fi
  echo "lambda=${name} ok"
}

deploy_lambda "htc-sandbox-resend-usage-canary" \
  "${ROOT}/lambdas/resend_usage_canary" "handler.handler" 30

deploy_lambda "htc-sandbox-ops-alert-email" \
  "${ROOT}/lambdas/ops_alert_email" "handler.handler" 30

deploy_lambda "htc-sandbox-workflow-synthetic" \
  "${ROOT}/lambdas/workflow_synthetic" "handler.handler" 45

# EventBridge schedule for usage canary (15 minutes — stay within Resend rate limits)
RULE="htc-sandbox-resend-usage-15m"
aws events put-rule \
  --name "${RULE}" \
  --schedule-expression "rate(15 minutes)" \
  --state ENABLED \
  --description "Sandbox Resend /usage → HTC/Sandbox usage gauges" \
  --region "${REGION}" >/dev/null

USAGE_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:htc-sandbox-resend-usage-canary"
aws lambda add-permission \
  --function-name htc-sandbox-resend-usage-canary \
  --statement-id AllowEventBridgeResendUsage \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE}" \
  --region "${REGION}" >/dev/null 2>&1 || true

aws events put-targets \
  --rule "${RULE}" \
  --targets "Id=usageCanary,Arn=${USAGE_ARN}" \
  --region "${REGION}" >/dev/null

# Workflow synthetic every 15 minutes (disposable lead write path)
WF_RULE="htc-sandbox-workflow-synthetic-15m"
aws events put-rule \
  --name "${WF_RULE}" \
  --schedule-expression "rate(15 minutes)" \
  --state ENABLED \
  --description "Sandbox health + disposable inquiry write/read/delete synthetic" \
  --region "${REGION}" >/dev/null

WF_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:htc-sandbox-workflow-synthetic"
aws lambda add-permission \
  --function-name htc-sandbox-workflow-synthetic \
  --statement-id AllowEventBridgeWorkflowSynthetic \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${WF_RULE}" \
  --region "${REGION}" >/dev/null 2>&1 || true

aws events put-targets \
  --rule "${WF_RULE}" \
  --targets "Id=workflowSynthetic,Arn=${WF_ARN}" \
  --region "${REGION}" >/dev/null

# SNS → email fanout Lambda
EMAIL_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:htc-sandbox-ops-alert-email"
aws lambda add-permission \
  --function-name htc-sandbox-ops-alert-email \
  --statement-id AllowSnsOpsAlerts \
  --action lambda:InvokeFunction \
  --principal sns.amazonaws.com \
  --source-arn "${TOPIC_ARN}" \
  --region "${REGION}" >/dev/null 2>&1 || true

# Subscribe if not already
EXISTING="$(aws sns list-subscriptions-by-topic --topic-arn "${TOPIC_ARN}" --region "${REGION}" \
  --query "Subscriptions[?Endpoint=='${EMAIL_ARN}'].SubscriptionArn" --output text)"
if [[ -z "${EXISTING}" || "${EXISTING}" == "None" ]]; then
  aws sns subscribe --topic-arn "${TOPIC_ARN}" --protocol lambda --notification-endpoint "${EMAIL_ARN}" --region "${REGION}" >/dev/null
  echo "sns_lambda_subscribed"
else
  echo "sns_lambda_already=${EXISTING}"
fi

# Alarms (idempotent put-metric-alarm)
put_alarm() {
  local name="$1"
  local metric="$2"
  local op="$3"
  local thresh="$4"
  local period="$5"
  local missing="$6"
  aws cloudwatch put-metric-alarm \
    --alarm-name "${name}" \
    --alarm-description "Sandbox ops early-warning (${metric})" \
    --namespace HTC/Sandbox \
    --metric-name "${metric}" \
    --statistic Maximum \
    --period "${period}" \
    --evaluation-periods 1 \
    --threshold "${thresh}" \
    --comparison-operator "${op}" \
    --treat-missing-data "${missing}" \
    --alarm-actions "${TOPIC_ARN}" \
    --ok-actions "${TOPIC_ARN}" \
    --region "${REGION}" >/dev/null
  echo "alarm=${name}"
}

# Monthly already ~75% on Free-like 3000 — 70% gives lead time and may be in ALARM now (intentional).
put_alarm "htc-sandbox-resend-monthly-usage-high" "ResendMonthlyUsagePercent" GreaterThanOrEqualToThreshold 70 900 notBreaching
put_alarm "htc-sandbox-resend-daily-usage-high" "ResendDailyUsagePercent" GreaterThanOrEqualToThreshold 80 900 notBreaching
put_alarm "htc-sandbox-resend-usage-canary-down" "ResendUsageCanaryOk" LessThanThreshold 1 900 breaching
put_alarm "htc-sandbox-ops-alert-email-failures" "OpsAlertEmailFailure" GreaterThanOrEqualToThreshold 1 300 notBreaching
put_alarm "htc-sandbox-workflow-synthetic-down" "WorkflowSyntheticOk" LessThanThreshold 1 900 breaching
put_alarm "htc-sandbox-inquiry-write-path-down" "InquiryWritePathOk" LessThanThreshold 1 900 breaching
put_alarm "htc-sandbox-tour-attach-path-down" "TourAttachPathOk" LessThanThreshold 1 900 breaching
put_alarm "htc-sandbox-contract-draft-path-down" "ContractDraftPathOk" LessThanThreshold 1 900 breaching
put_alarm "htc-sandbox-payment-config-path-down" "PaymentConfigPathOk" LessThanThreshold 1 900 breaching

# SNS delivery failure (email PendingConfirmation contributes; monitor visibility)
aws cloudwatch put-metric-alarm \
  --alarm-name "htc-sandbox-sns-notifications-failed" \
  --alarm-description "SNS topic failed to deliver notifications" \
  --namespace AWS/SNS \
  --metric-name NumberOfNotificationsFailed \
  --dimensions "Name=TopicName,Value=htc-sandbox-ops-alerts" \
  --statistic Sum \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "${TOPIC_ARN}" \
  --ok-actions "${TOPIC_ARN}" \
  --region "${REGION}" >/dev/null
echo "alarm=htc-sandbox-sns-notifications-failed"

# Invoke usage canary once
aws lambda invoke --function-name htc-sandbox-resend-usage-canary --region "${REGION}" \
  --cli-binary-format raw-in-base64-out --payload '{}' /tmp/htc-resend-usage-invoke.json >/tmp/htc-resend-usage-invoke-meta.json
echo "usage_invoke=$(cat /tmp/htc-resend-usage-invoke.json)"

aws lambda invoke --function-name htc-sandbox-workflow-synthetic --region "${REGION}" \
  --cli-binary-format raw-in-base64-out --payload '{}' /tmp/htc-workflow-synthetic-invoke.json >/tmp/htc-workflow-synthetic-invoke-meta.json
echo "workflow_invoke=$(cat /tmp/htc-workflow-synthetic-invoke.json)"

echo "DEPLOY_OK"
