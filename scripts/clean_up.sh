#!/bin/bash
set -e

echo "不要な S3 バケットを削除..."
aws s3 rb s3://remote-robot-frontend --force
aws s3 rb s3://remote-robot-data --force

echo "DynamoDB テーブルを削除..."
aws dynamodb delete-table --table-name RobotStatus

echo "未使用の Lambda 関数を削除..."
aws lambda delete-function --function-name UnusedLambdaFunction

echo "クリーンアップが完了しました！"
