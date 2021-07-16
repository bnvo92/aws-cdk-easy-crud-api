import { Construct, Stack, StackProps, RemovalPolicy, Duration } from '@aws-cdk/core';
import { RestApi, LambdaIntegration, Cors, Model, IntegrationOptions} from '@aws-cdk/aws-apigateway';
import { Runtime, Alias } from '@aws-cdk/aws-lambda';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { LambdaDeploymentGroup, LambdaDeploymentConfig } from '@aws-cdk/aws-codedeploy';

interface mylambdaProps extends StackProps {
  readonly functionEntry: string
  readonly lambdaEnvConfigs: Record<string,string>
  readonly index: string
  readonly integrationOptions : IntegrationOptions
}

export class lambdaFuncConstruct extends Construct {

  public readonly LambdaIntegration: LambdaIntegration
  public readonly LambdaAlias: Alias
  public readonly LambdaFunc: PythonFunction

  constructor(scope: Construct, id: string, props: mylambdaProps) {
    super(scope, id);

    const lambda_role = new Role(this, 'lambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'This is a custom role for lambda',
    });

    // add custom lambda policies
    const lambda_policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        // 'ec2:CreateNetworkInterface',
        // 'ec2:DescribeNetworkInterfaces',
        // 'ec2:DeleteNetworkInterface',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*']
    });

    lambda_role.addToPolicy(lambda_policy);

    // python https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-python-readme.html
    const myLambdaFunction = new PythonFunction(this, 'Function', {
      runtime: Runtime.PYTHON_3_8,
      index: 'handler.py',
      handler: 'handler',
      entry: props.functionEntry,
      environment : props.lambdaEnvConfigs,
      role: lambda_role,
      timeout: Duration.seconds(30)
    });

    const handlerAlias = new Alias(this, 'alias', {
      aliasName: 'Current',
      version: myLambdaFunction.currentVersion
    });

    new LambdaDeploymentGroup(this, 'DeploymentGroup' , {
      alias: handlerAlias,
      deploymentConfig: LambdaDeploymentConfig.ALL_AT_ONCE,
    });

    const HandlerLambdaintegration = new LambdaIntegration(handlerAlias, props.integrationOptions );

    this.LambdaIntegration = HandlerLambdaintegration
    this.LambdaAlias = handlerAlias
    this.LambdaFunc = myLambdaFunction

  }
};

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // define api
    const Api = new RestApi(this, 'MyLambdaRestApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS
      },
      description: `Api Patterns - Vanilla Lambda Stack`,
    })
    
    const CorsResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,auth-header'"
    }
    const CorsMethodResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': true,
      'method.response.header.Access-Control-Allow-Headers': true
    }

    const methodOptions = {
      methodResponses: [{ 
        statusCode: '200', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      },{
        statusCode: '400', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      }],
      // requestParameters: {'method.request.header.auth-header': true}
    }

    const IntegrationOps = {
      proxy: false,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: CorsResponseParameters,
          responseModel: Model.EMPTY_MODEL,
          responseTemplates: {
            'application/json': ``
          },
        },{
          selectionPattern: '4\\d{2}',
          statusCode: '400',
          responseParameters: CorsResponseParameters,
          responseTemplates: {
            'application/json': ``,
          },
        }
      ],
      // http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
      requestTemplates: {
        'application/json': integrationOpsRequestTemplate
      }
    }
    
    const myLambdaEnvConfigs = {
      "dynamodb_table": "mytable"
    }

    const filtersResource = Api.root.addResource('filters')

    const myLambdaFunction = new lambdaFuncConstruct(this, 'CreateLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'handler',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    });

    const myLambdaIntegration = new LambdaIntegration(myLambdaFunction.LambdaAlias, IntegrationOps );
    const myMethod = filtersResource.addMethod('GET', myLambdaIntegration, methodOptions);

    }};

const integrationOpsRequestTemplate = `##  See http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
    ##  This template will pass through all parameters including path, querystring, header, stage variables, and context through to the integration endpoint via the body/payload
    #set($allParams = $input.params())
    {
    "body-json" : $input.json('$'),
    "params" : {
    #foreach($type in $allParams.keySet())
        #set($params = $allParams.get($type))
    "$type" : {
        #foreach($paramName in $params.keySet())
        "$paramName" : "$util.escapeJavaScript($params.get($paramName))"
            #if($foreach.hasNext),#end
        #end
    }
        #if($foreach.hasNext),#end
    #end
    },
    "stage-variables" : {
    #foreach($key in $stageVariables.keySet())
    "$key" : "$util.escapeJavaScript($stageVariables.get($key))"
        #if($foreach.hasNext),#end
    #end
    },
    "context" : {
        "account-id" : "$context.identity.accountId",
        "api-id" : "$context.apiId",
        "api-key" : "$context.identity.apiKey",
        "authorizer-principal-id" : "$context.authorizer.principalId",
        "caller" : "$context.identity.caller",
        "cognito-authentication-provider" : "$context.identity.cognitoAuthenticationProvider",
        "cognito-authentication-type" : "$context.identity.cognitoAuthenticationType",
        "cognito-identity-id" : "$context.identity.cognitoIdentityId",
        "cognito-identity-pool-id" : "$context.identity.cognitoIdentityPoolId",
        "http-method" : "$context.httpMethod",
        "stage" : "$context.stage",
        "source-ip" : "$context.identity.sourceIp",
        "user" : "$context.identity.user",
        "user-agent" : "$context.identity.userAgent",
        "user-arn" : "$context.identity.userArn",
        "request-id" : "$context.requestId",
        "resource-id" : "$context.resourceId",
        "resource-path" : "$context.resourcePath"
        }
    }`