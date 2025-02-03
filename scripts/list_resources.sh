#!/bin/bash
echo "AWS リソース一覧を取得中..."

echo "VPC:"
aws ec2 describe-vpcs --query 'Vpcs[*].VpcId'

echo "S3 バケット:"
aws s3 ls

echo "DynamoDB テーブル:"
aws dynamodb list-tables

echo "Lambda 関数:"
aws lambda list-functions --query 'Functions[*].FunctionName'
