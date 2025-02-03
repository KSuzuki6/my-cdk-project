import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NetworkStack } from "./network-stack";
import { DatabaseStack } from "./database-stack";
import { SecurityStack } from "./security-stack";
import { APIStack } from "./api-stack";
import { IoTStack } from "./iot-stack";
import { MonitoringStack } from "./monitoring-stack";
import { HostingStack } from "./hosting-stack";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. ネットワークスタック（VPC, サブネット, NAT, セキュリティグループ）**
    const networkStack = new NetworkStack(this, "NetworkStack");

    // **2. データベーススタック（Aurora PostgreSQL, DynamoDB, S3）**
    const databaseStack = new DatabaseStack(this, "DatabaseStack", {
    //   vpc: networkStack.vpc, // ✅ ネットワークスタックの VPC を再利用
    });

    // **3. セキュリティスタック（WAF, Security Hub, GuardDuty, IAM）**
    const securityStack = new SecurityStack(this, "SecurityStack", networkStack);

    // **4. ホスティングスタック（S3, CloudFront）**
    const hostingStack = new HostingStack(this, "HostingStack");

    // **5. API スタック（GraphQL API, REST API）**
    const apiStack = new APIStack(this, "APIStack", {
    //   vpc: networkStack.vpc, // ✅ ネットワークスタックの VPC を再利用
    //   securityGroup: networkStack.securityGroup, // ✅ ネットワークの SG を適用
    //   database: databaseStack.auroraCluster, // ✅ データベースを API で利用
    });

    // **6. MQTT スタック（AWS IoT Core, Greengrass, DynamoDB）**
    const iotStack = new IoTStack(this, "IoTStack", {
    //   vpc: networkStack.vpc, // ✅ ネットワークスタックの VPC を再利用
    //   securityGroup: networkStack.securityGroup, // ✅ セキュリティグループを適用
    //   databaseTable: databaseStack.robotStatusTable, // ✅ DynamoDB を MQTT で利用
    });

    // **7. 監視スタック（CloudWatch, Security Hub, GuardDuty）**
    new MonitoringStack(this, "MonitoringStack", {
    //   vpc: networkStack.vpc, // ✅ VPC を監視
    //   securityGroup: networkStack.securityGroup, // ✅ SG を監視
    });

    // **8. スタックの出力**
    new cdk.CfnOutput(this, "VPCId", {
      value: networkStack.vpc.vpcId,
    });

    new cdk.CfnOutput(this, "DatabaseClusterId", {
      value: databaseStack.auroraCluster.clusterIdentifier,
    });

    new cdk.CfnOutput(this, "SecurityGroupId", {
      value: networkStack.securityGroup.securityGroupId,
    });

    new cdk.CfnOutput(this, "GraphQLApiEndpoint", {
      value: apiStack.graphqlApi.graphqlUrl,
    });

    // new cdk.CfnOutput(this, "MQTTTable", {
    //   value: iotStack.databaseTable.tableName,
    // });

    new cdk.CfnOutput(this, "CloudFrontDistribution", {
      value: hostingStack.distribution.distributionDomainName,
    });
  }
}
