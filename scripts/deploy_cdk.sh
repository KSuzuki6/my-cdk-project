#!/bin/bash
set -e

echo "CDK デプロイを開始します..."

cd $(dirname "$0")/..

# AWS CDK のビルド & デプロイ
cdk synth
cdk deploy --all --require-approval never

echo "CDK デプロイが完了しました！"
