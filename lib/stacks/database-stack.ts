import * as cdk from "aws-cdk-lib";
import * as rds from "aws-cdk-lib/aws-rds";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class DatabaseStack extends cdk.Stack {
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly robotStatusTable: dynamodb.Table;
  public readonly storageBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. VPC の取得**
    const vpc = new ec2.Vpc(this, "DatabaseVPC", {
      maxAzs: 2,
      natGateways: 1,
    });

    // **2. Aurora PostgreSQL クラスターの作成**
    this.auroraCluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_2,
      }),
      defaultDatabaseName: "RemoteRobotDB",
      instances: 2,
      vpc,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      storageEncrypted: true,
    });

    // **3. DynamoDB テーブルの作成（ロボットのステータス管理）**
    this.robotStatusTable = new dynamodb.Table(this, "RobotStatusTable", {
      partitionKey: { name: "tenant_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "robot_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // **4. S3 バケットの作成（ロボットのメディア & ログ保存）**
    this.storageBucket = new s3.Bucket(this, "RobotDataBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // **5. IAM ロールの設定**
    const databaseAccessRole = new iam.Role(this, "DatabaseAccessRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // ✅ `grantConnect` の第 2 引数にデータベースユーザー名 "admin" を指定
    this.auroraCluster.grantConnect(databaseAccessRole, "admin");
    this.robotStatusTable.grantReadWriteData(databaseAccessRole);
    this.storageBucket.grantReadWrite(databaseAccessRole);

    // **6. スタックの出力**
    new cdk.CfnOutput(this, "AuroraClusterIdentifier", {
      value: this.auroraCluster.clusterIdentifier,
    });

    new cdk.CfnOutput(this, "DynamoDBTable", {
      value: this.robotStatusTable.tableName,
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: this.storageBucket.bucketName,
    });
  }
}
