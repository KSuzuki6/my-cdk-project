import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as securityhub from "aws-cdk-lib/aws-securityhub";
import * as guardduty from "aws-cdk-lib/aws-guardduty";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { NetworkStack } from "./network-stack"; // ✅ `network-stack.ts` をインポート

export class SecurityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, networkStack: NetworkStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. `network-stack.ts` から VPC と SG を取得**
    const vpc = networkStack.vpc;
    const securityGroup = networkStack.securityGroup;

    // **2. AWS WAF の作成**
    const wafAcl = new wafv2.CfnWebACL(this, "RemoteRobotWAF", {
      name: "RemoteRobotWAF",
      scope: "CLOUDFRONT", // CloudFront に適用
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "RemoteRobotWAF",
      },
      rules: [
        {
          name: "BlockIPRule",
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "BlockIPRule",
          },
          statement: {
            ipSetReferenceStatement: {
              arn: "arn:aws:wafv2:us-east-1:123456789012:regional/ipset/BlockedIPs",
            },
          },
        },
        {
          name: "RateLimitRule",
          priority: 2,
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitRule",
          },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: "IP",
            },
          },
        },
      ],
    });

    // **3. AWS Security Hub の有効化**
    new securityhub.CfnHub(this, "SecurityHub", {});

    // **4. AWS GuardDuty の有効化**
    new guardduty.CfnDetector(this, "GuardDuty", {
      enable: true,
    });

    // **5. セキュリティグループを `network-stack.ts` から取得し、追加のルールを設定**
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(1883), // MQTT のポート (AWS IoT との通信)
      "Allow MQTT traffic"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8883), // MQTT over TLS
      "Allow Secure MQTT traffic"
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080), // WebRTC のシグナリングサーバー (Janus Gateway)
      "Allow WebRTC Signaling"
    );

    // **6. スタックの出力**
    new cdk.CfnOutput(this, "WAFAclArn", {
      value: wafAcl.attrArn,
    });

    new cdk.CfnOutput(this, "SecurityHubStatus", {
      value: "Enabled",
    });

    new cdk.CfnOutput(this, "GuardDutyStatus", {
      value: "Enabled",
    });

    new cdk.CfnOutput(this, "SecurityGroupId", {
      value: securityGroup.securityGroupId,
    });
  }
}
