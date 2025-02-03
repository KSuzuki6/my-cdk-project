import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. VPC の作成**
    this.vpc = new ec2.Vpc(this, "RemoteRobotVPC", {
      maxAzs: 2, // アベイラビリティゾーンを 2 つ使用
      natGateways: 1, // 1 つの NAT Gateway を設定
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "PrivateSubnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: "DatabaseSubnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // **2. セキュリティグループの作成**
    this.securityGroup = new ec2.SecurityGroup(this, "RobotSecurityGroup", {
      vpc: this.vpc,
      allowAllOutbound: true, // 外部通信は許可
    });

    // **3. SSH と HTTPS のみ許可**
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic"
    );

    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access (for admin only)"
    );

    // **4. スタックの出力**
    new cdk.CfnOutput(this, "VPCId", {
      value: this.vpc.vpcId,
    });

    new cdk.CfnOutput(this, "SecurityGroupId", {
      value: this.securityGroup.securityGroupId,
    });
  }
}
