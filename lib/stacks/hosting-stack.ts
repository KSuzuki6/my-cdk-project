import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as efs from "aws-cdk-lib/aws-efs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

export class HostingStack extends cdk.Stack {
  public readonly robotDataBucket: s3.Bucket;
  public readonly robotEfs: efs.FileSystem;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. S3 バケットの作成**
    this.robotDataBucket = new s3.Bucket(this, "RobotDataBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // **2. IAM ポリシーの設定 (S3 アクセス)**
    const s3AccessRole = new iam.Role(this, "S3AccessRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    this.robotDataBucket.grantReadWrite(s3AccessRole);


    // **2. CloudFront Function の定義**
    const authFunction = new cloudfront.Function(this, "AuthFunction", {
        functionName: "CognitoJWTAuth",
        code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {
            var request = event.request;
            var headers = request.headers;
  
            if (!headers.authorization || !headers.authorization.value.startsWith("Bearer ")) {
              return {
                statusCode: 403,
                statusDescription: "Forbidden",
                body: "Missing Authorization Header"
              };
            }
  
            var token = headers.authorization.value.split("Bearer ")[1];
  
            // JWT デコード (ヘッダー部分のみ)
            var tokenParts = token.split(".");
            if (tokenParts.length !== 3) {
              return {
                statusCode: 403,
                statusDescription: "Forbidden",
                body: "Invalid Token Format"
              };
            }
  
            var payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf8"));
  
            // 有効期限 (exp) チェック
            var currentTimestamp = Math.floor(new Date().getTime() / 1000);
            if (payload.exp < currentTimestamp) {
              return {
                statusCode: 403,
                statusDescription: "Forbidden",
                body: "Token Expired"
              };
            }
  
            return request; // 認証成功
          }
        `),
      });
  
      // **3. CloudFront ディストリビューションの作成**
      this.distribution = new cloudfront.Distribution(this, "RobotDataDistribution", {
        defaultBehavior: {
          origin: new origins.S3Origin(this.robotDataBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              function: authFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      });
  

    // **4. スタックの出力**
    new cdk.CfnOutput(this, "S3BucketName", {
      value: this.robotDataBucket.bucketName,
    });

    new cdk.CfnOutput(this, "CloudFrontDistribution", {
      value: this.distribution.distributionDomainName,
    });
  }
}
