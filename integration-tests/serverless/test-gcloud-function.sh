#!/bin/bash

set -e

DD_TRACE_JS_ROOT_DIR_PATH="${SERVERLESS_INTEGRATION_DIR_PATH}/../../"

yarn --cwd ${DD_TRACE_JS_ROOT_DIR_PATH} pack --filename "${SERVERLESS_INTEGRATION_DIR_PATH}/test-project/dd-trace-integration-test.tgz"

ls "${SERVERLESS_INTEGRATION_DIR_PATH}/test-project/"

STAGE=$(xxd -l 4 -c 4 -p </dev/random)

function cleanup {
    gcloud functions delete dd-trace-js-sls-mini-agent-integration-test-${STAGE} --region us-east1 --gen2 --quiet 
}
trap cleanup EXIT

echo "Deploying integration test cloud function"

OUTPUT=$(gcloud functions deploy dd-trace-js-sls-mini-agent-integration-test-${STAGE} \
--gen2 \
--runtime=nodejs18 \
--region=us-east1 \
--source="${SERVERLESS_INTEGRATION_DIR_PATH}/test-project/" \
--entry-point=helloGET \
--trigger-http \
--allow-unauthenticated \
--set-env-vars NODE_OPTIONS="-r dd-trace/init",DD_TRACE_DEBUG="true",DD_MINI_AGENT_PATH="/workspace/node_modules/david-test-datadog-sma/datadog-serverless-agent-linux-amd64/datadog-serverless-trace-mini-agent")

echo "Calling deployed cloud function"
# TRIGGER_URL=$(echo $OUTPUT | awk '{for (I=1;I<NF;I++) if ($I == "uri:") print $(I+1)}')
# curl -s ${TRIGGER_URL}
gcloud functions call dd-trace-js-sls-mini-agent-integration-test-${STAGE} --region us-east1 --gen2 --project datadog-sandbox

echo "Waiting 20 seconds before tailing logs"
sleep 20

LOGS=$(gcloud functions logs read dd-trace-js-sls-mini-agent-integration-test-${STAGE} --region us-east1 --gen2 --limit 500)

echo "$LOGS"

if echo "$LOGS" | grep -q "Successfully buffered traces to be flushed"; then
    echo "Mini Agent received traces"
    exit 0
else
    echo "Mini Agent DID NOT receive traces"
    exit 1
fi