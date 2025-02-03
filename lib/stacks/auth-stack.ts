import * as cdk from "aws-cdk-lib";
import {
  UserPool,
  UserPoolClient,
  UserPoolIdentityProviderAmazon,
  UserPoolIdentityProviderGoogle,
  CfnUserPoolGroup,
  CfnIdentityPool,
} from "aws-cdk-lib/aws-cognito";
import { Role, FederatedPrincipal, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class AuthStack extends cdk.Stack {
  public readonly userPool: UserPool;
  public readonly identityPool: CfnIdentityPool;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // **1. Cognito ユーザープールの作成**
    this.userPool = new UserPool(this, "RemoteRobotUserPool", {
      userPoolName: "RemoteRobotUserPool",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // **2. ユーザープールクライアントの作成**
    const userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // **3. マルチテナント対応のユーザーグループを作成**
    const tenantGroupAdmin = new CfnUserPoolGroup(this, "TenantAdminGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "TenantAdmin",
      description: "テナント管理者",
    });

    const tenantGroupUser = new CfnUserPoolGroup(this, "TenantUserGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "TenantUser",
      description: "テナントの標準ユーザー",
    });

    // **4. ID プールを作成し、IAM と連携**
    this.identityPool = new CfnIdentityPool(this, "IdentityPool", {
      identityPoolName: "RemoteRobotIdentityPool",
      allowUnauthenticatedIdentities: false, // 認証済みユーザーのみアクセス
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // **5. 認証済みユーザー向けの IAM ロール**
    const authenticatedRole = new Role(this, "CognitoAuthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    authenticatedRole.addToPolicy(
      new PolicyStatement({
        actions: ["iot:Connect", "iot:Publish", "iot:Subscribe", "iot:Receive"],
        resources: ["*"],
      })
    );

    // **6. IAM ロールを ID プールに割り当て**
    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: this.identityPool.ref,
    });
  }
}
