import * as cdk from "aws-cdk-lib";
import * as iot from "aws-cdk-lib/aws-iot";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class IoTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. DynamoDB テーブル（ロボットのステータス保存）**
    const robotStatusTable = new dynamodb.Table(this, "RobotStatusTable", {
      partitionKey: { name: "tenant_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "robot_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // **2. AWS IoT Core のルールを作成**
    const iotRuleRole = new iam.Role(this, "IoTRuleRole", {
      assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
    });

    robotStatusTable.grantWriteData(iotRuleRole);

    const iotRule = new iot.CfnTopicRule(this, "MqttToDynamoDBRule", {
      ruleName: "MqttToDynamoDBRule",
      topicRulePayload: {
        actions: [
          {
            dynamoDBv2: {
              roleArn: iotRuleRole.roleArn,
              putItem: {
                tableName: robotStatusTable.tableName,
              },
            },
          },
        ],
        sql: "SELECT * FROM 'tenant/+/robot/+/status'",
        awsIotSqlVersion: "2016-03-23",
      },
    });

    // **3. IoT Greengrass のエッジデバイス登録**
    const greengrassRole = new iam.Role(this, "GreengrassRole", {
      assumedBy: new iam.ServicePrincipal("greengrass.amazonaws.com"),
    });

    greengrassRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSIoTFullAccess")
    );

    // **4. スタックの出力**
    new cdk.CfnOutput(this, "IoTRuleName", {
      value: iotRule.ruleName!,
    });

    new cdk.CfnOutput(this, "DynamoDBTable", {
      value: robotStatusTable.tableName,
    });
  }
}
