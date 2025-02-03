import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { AuthStack } from "../auth-stack";

export class APIStack extends cdk.Stack {
  public readonly graphqlApi: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. 認証基盤（Cognito）を取得**
    const authStack = new AuthStack(this, "AuthStack");

    // **2. DynamoDB テーブルの作成（ロボットデータ管理）**
    const robotTable = new dynamodb.Table(this, "RobotTable", {
      partitionKey: { name: "tenant_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "robot_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // **3. GraphQL API（AWS AppSync）の作成**
    this.graphqlApi = new appsync.GraphqlApi(this, "RemoteRobotGraphQL", {
      name: "RemoteRobotGraphQL",
      schema: appsync.SchemaFile.fromAsset("graphql/schema.graphql"), // ✅ 修正1
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: authStack.userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.days(365)), // ✅ 修正2
            },
          },
        ],
      },
      xrayEnabled: true,
    });

    // **4. Lambda 関数（GraphQL リゾルバ用）**
    const robotLambda = new lambda.Function(this, "RobotLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/robot"),
      environment: {
        TABLE_NAME: robotTable.tableName,
      },
    });

    // **5. Lambda を GraphQL データソースに追加**
    const lambdaDataSource = this.graphqlApi.addLambdaDataSource(
      "LambdaDataSource",
      robotLambda
    );

    // **6. GraphQL Resolver の追加**
    lambdaDataSource.createResolver("GetRobotResolver", { // ✅ 修正3
      typeName: "Query",
      fieldName: "getRobot",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("UpdateRobotStatusResolver", { // ✅ 修正3
      typeName: "Mutation",
      fieldName: "updateRobotStatus",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    // **7. IAM ロールと権限**
    robotTable.grantReadWriteData(robotLambda);

    // **8. スタックの出力**
    new cdk.CfnOutput(this, "GraphQLAPIEndpoint", {
      value: this.graphqlApi.graphqlUrl,
    });
  }
}
