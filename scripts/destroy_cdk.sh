#!/bin/bash
set -e

echo "CDK スタックを削除します..."

cd $(dirname "$0")/..

# CDK スタックの削除
cdk destroy --all --force

echo "CDK スタックが削除されました！"
