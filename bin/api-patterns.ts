#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ApiPatternsStack } from '../lib/api-patterns-stack';
require('dotenv').config();

const app = new cdk.App();
const envUSA = {account: process.env.ACCOUNT, region: process.env.REGION}
new ApiPatternsStack(app, 'ApiPatternsStack', {env: envUSA});