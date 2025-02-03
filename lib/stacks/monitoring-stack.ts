import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iot from "aws-cdk-lib/aws-iot";
import * as iam from "aws-cdk-lib/aws-iam";
import * as securityhub from "aws-cdk-lib/aws-securityhub";
import * as guardduty from "aws-cdk-lib/aws-guardduty";
import { Construct } from "constructs";

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. CloudWatch ロググループを作成**
    const logGroup = new logs.LogGroup(this, "RobotLogGroup", {
      logGroupName: "/aws/robot-monitoring",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      retention: logs.RetentionDays.ONE_YEAR,
    });

    // **2. CloudWatch メトリクスを作成**
    const cpuUsageMetric = new cloudwatch.Metric({
      namespace: "RemoteRobot",
      metricName: "CPUUsage",
      period: cdk.Duration.minutes(1),
    });

    const memoryUsageMetric = new cloudwatch.Metric({
      namespace: "RemoteRobot",
      metricName: "MemoryUsage",
      period: cdk.Duration.minutes(1),
    });

    // **3. CloudWatch アラームを作成**
    new cloudwatch.Alarm(this, "CPUAlarm", {
      metric: cpuUsageMetric,
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: "ロボットの CPU 使用率が 80% を超えました。",
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new cloudwatch.Alarm(this, "MemoryAlarm", {
      metric: memoryUsageMetric,
      threshold: 75,
      evaluationPeriods: 2,
      alarmDescription: "ロボットのメモリ使用率が 75% を超えました。",
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // **4. AWS IoT Device Defender の異常監視ルール**
    new iot.CfnSecurityProfile(this, "IoTDeviceDefender", {
      securityProfileName: "RemoteRobotSecurityProfile",
      behaviors: [
        {
          name: "TooManyMessages",
          metric: "aws:iot:MessageCount",
          criteria: {
            comparisonOperator: "greater-than",
            value: { count: "1000" },
          },
        },
        {
          name: "UnauthorizedAccess",
          metric: "aws:iot:UnauthorizedConnects",
          criteria: {
            comparisonOperator: "greater-than",
            value: { count: "1" },
          },
        },
      ],
    });

    // **5. AWS Security Hub を有効化**
    new securityhub.CfnHub(this, "SecurityHub", {});

    // **6. AWS GuardDuty を有効化**
    new guardduty.CfnDetector(this, "GuardDuty", {
      enable: true,
    });

    // **7. IAM ロールの作成**
    const monitoringRole = new iam.Role(this, "MonitoringRole", {
      assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
    });

    monitoringRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudwatch:PutMetricData",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );

    // **8. スタックの出力**
    new cdk.CfnOutput(this, "LogGroupName", {
      value: logGroup.logGroupName,
    });

    new cdk.CfnOutput(this, "SecurityProfileName", {
      value: "RemoteRobotSecurityProfile",
    });
  }
}
