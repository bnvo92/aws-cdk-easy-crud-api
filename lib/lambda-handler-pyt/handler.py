import json
import os
import boto3
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):

    # myvariable = event['body-json']['input']

    return {
        "body": "hello from lambda",
        "statusCode": 200
    }

def dynamodb_create(event, context):

    logger.info(event)

    # sample event
    # {
    #     "userId": "A4dce9f0",
    #     "filters": [{
    #         "filter_name": "city",
    #         "filter_value": ["Missisauga", "Brampton", "Toronto", "Scarborough", "North York", "Etobicoke"]
    #     }]
    # }

    filters = event['body-json']['filters']
    user_id = event['body-json']['user_id']

    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ.get('dynamo_table')
    table = dynamodb.Table(table_name)

    response = table.put_item(
        TableName=table_name,
        Item={
            'userId': user_id,
            'filters': filters
        }
    )

    return response


def dynamodb_list(event, context):
    logger.info(event)

    dynamodb = boto3.resource('dynamodb')
    table_name = os.getenv("dynamo_table")
    table = dynamodb.Table(table_name)

    result = table.scan(
        TableName=table_name
    )

    return result

def dynamodb_get(event, context):
    logger.info(event)

    # user_id = event['body-json']['user_id']
    user_id = event['params']['path']['userId']

    dynamodb = boto3.resource('dynamodb')
    table_name = os.getenv("dynamo_table")
    table = dynamodb.Table(table_name)

    result = table.get_item(
        TableName=table_name,
        Key={
            "userId" : user_id
        }
    )

    return result

def dynamodb_delete(event, context):
    logger.info(event)

    user_id = event['params']['path']['userId']

    dynamodb = boto3.resource('dynamodb')
    table_name = os.getenv("dynamo_table")
    table = dynamodb.Table(table_name)

    result = table.delete_item(
        TableName=table_name,
        Key={
            "userId": user_id
        }
    )

    return result

def dynamodb_update(event, context):
    logger.info(event)

    user_id = event['params']['path']['userId']
    filters = event['body-json']['filters']

    dynamodb = boto3.resource('dynamodb')
    table_name = os.getenv("dynamo_table")
    table = dynamodb.Table(table_name)

    result = table.update_item(
        TableName=table_name,
        Key={
            "userId": user_id
        },
        UpdateExpression='SET filters = :fl',
        ExpressionAttributeValues = {
            ":fl": filters
        },
        ReturnValues="UPDATED_NEW"
    )

    return result