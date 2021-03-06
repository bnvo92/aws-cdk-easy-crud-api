import { Construct, Stack, StackProps, RemovalPolicy, Duration } from '@aws-cdk/core';
import * as path from 'path';
import { RestApi, Deployment, Cors, Stage, EndpointType, SecurityPolicy, DomainName, Model, LambdaIntegration, IntegrationOptions} from '@aws-cdk/aws-apigateway';
import { Function, Runtime, Code, Alias } from '@aws-cdk/aws-lambda';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { LambdaDeploymentConfig, LambdaDeploymentGroup } from '@aws-cdk/aws-codedeploy';


interface mylambdaProps extends StackProps {
  readonly functionEntry: string
  readonly lambdaEnvConfigs: Record<string,string>
  readonly index: string
  readonly integrationOptions: IntegrationOptions
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
    const myLambdaFunction = new PythonFunction(this, 'MyGetFunction', {
      runtime: Runtime.PYTHON_3_8,
      index: 'handler.py',
      handler: props.index,
      entry: './lib/lambda-handler-pyt',
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

export class DynamodbConstruct extends Construct {
  public readonly TableName: string
  public readonly Table: Table
  public readonly DynamodbRole: Role

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id);

    const DynamodbTableName = 'myCDKDemoFilteringTable'
    const DynamodbTable = new Table(this, DynamodbTableName, {
      partitionKey: { 
        name: 'userId',
        type: AttributeType.STRING
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: `${DynamodbTableName}`
    });

    const dynamoPolicy = new Policy(this, 'dynamoPolicy', {
      statements: [
        new PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem'
          ],
          effect: Effect.ALLOW,
          resources: [DynamodbTable.tableArn],
        }),
      ],
    });

    const dynamoRole = new Role(this, 'getRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    dynamoRole.attachInlinePolicy(dynamoPolicy);

    this.TableName = DynamodbTableName
    this.Table = DynamodbTable
    this.DynamodbRole = dynamoRole
  }
};



export class ApiPatternsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const Api = new RestApi(this, 'myDemoApi', {
      description: `My test demo Api`,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS
      }
    })

    const CorsResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    }
    const CorsMethodResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': true,
      'method.response.header.Access-Control-Allow-Headers': true
    }

    const MethodOptions = {
      methodResponses: [{ 
        statusCode: '200', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      },{
        statusCode: '400', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      }],
    }

    const requestTemplate = `#set($allParams = $input.params())
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
      }
    }`
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
            'application/json': `{
            "error": "Bad input!"
            }`
          },
        }
      ],
      // http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
      requestTemplates: {
        'application/json': requestTemplate
      }
    }
    const methodOptionsPathParam = {
      methodResponses: [{ 
        statusCode: '200', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      },{
        statusCode: '400', 
        responseParameters: CorsMethodResponseParameters,
        responseTemplate: { 'application/json': Model.EMPTY_MODEL}
      }],
      requestParameters: {'method.request.path.userId': true}
    }

    const DynamodbTable = new DynamodbConstruct(this, 'dynamoConstruct')

    const myLambdaEnvConfigs = {
      'dynamo_table': 'mytable',
      'HOSTNAME': 'somedatabaseUrl'
    }

    const filtersResource = Api.root.addResource('filters')

    // create lambda
    const createLambdaFunction = new lambdaFuncConstruct(this, 'CreateLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'dynamodb_create',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })

    DynamodbTable.Table.grantReadWriteData(createLambdaFunction.LambdaFunc);
    const createLambdaIntegration = new LambdaIntegration(createLambdaFunction.LambdaAlias, IntegrationOps );
    const createFilters = filtersResource.addMethod('POST', createLambdaIntegration, MethodOptions);
    

    // list
    const listLambdaFunction = new lambdaFuncConstruct(this, 'ListLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'dynamodb_list',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(listLambdaFunction.LambdaFunc);
    const ListLambdaIntegration = new LambdaIntegration(listLambdaFunction.LambdaAlias, IntegrationOps );
    const listFilters = filtersResource.addMethod('GET', ListLambdaIntegration, MethodOptions);

    // get item
    const getLambdaFunction = new lambdaFuncConstruct(this, 'GetLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'dynamodb_get',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(getLambdaFunction.LambdaFunc);
    const getLambdaIntegration = new LambdaIntegration(getLambdaFunction.LambdaAlias, IntegrationOps );

    const filtersUserIdResource = filtersResource.addResource('{userId}')
    const getFilters = filtersUserIdResource.addMethod('GET', getLambdaIntegration, methodOptionsPathParam);

    // delete
    const deleteLambdaFunction = new lambdaFuncConstruct(this, 'DeleteLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'dynamodb_delete',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })
    DynamodbTable.Table.grantReadWriteData(deleteLambdaFunction.LambdaFunc);
    const deleteLambdaIntegration = new LambdaIntegration(deleteLambdaFunction.LambdaAlias, IntegrationOps );
    const deleteFilters = filtersUserIdResource.addMethod('DELETE', deleteLambdaIntegration, methodOptionsPathParam);

    // update
    const updateLambdaFunction = new lambdaFuncConstruct(this, 'UpdateLambda', {
      functionEntry: './lib/lambda-handler-pyt',
      index: 'dynamodb_update',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })

    DynamodbTable.Table.grantReadWriteData(updateLambdaFunction.LambdaFunc);
    const updateLambdaIntegration = new LambdaIntegration(updateLambdaFunction.LambdaAlias, IntegrationOps );
    const updateFilters = filtersUserIdResource.addMethod('PATCH', updateLambdaIntegration, methodOptionsPathParam);
    
    const sqlalchemyEnvConfigs = {
      'HOSTNAME': 'distilrdb-dev.ceyljztmm2mf.us-east-1.rds.amazonaws.com',
      'USER': 'ds_lambda',
      'SCHEMA': 'public',
      'PORT': '5432',
      'PASSWORD': 'HS*WU1YV8s#w',
      'DATABASE': 'postgres',
      'DRIVER': 'postgresql'
    };

    const SqlAlchResourceLambdaFunction = new lambdaFuncConstruct(this, 'SqlAlchLambda', {
      functionEntry: './lib/lambda-sqlalchemy',
      index: 'handler',
      lambdaEnvConfigs: myLambdaEnvConfigs,
      integrationOptions: IntegrationOps
    })

    const SqlAlchResource = Api.root.addResource('sqlalchemy')

    const SqlAlchIntegration = new LambdaIntegration(SqlAlchResourceLambdaFunction.LambdaAlias, IntegrationOps)
    const SqlAlchGetMethod = SqlAlchResource.addMethod('GET', SqlAlchIntegration, MethodOptions)

  }};
