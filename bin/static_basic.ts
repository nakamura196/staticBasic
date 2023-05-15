#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StaticBasicStack } from '../lib/static_basic-stack';

import * as dotenv from 'dotenv';
dotenv.config();

const app = new cdk.App();
new StaticBasicStack(app, 'GdbStaticBasicStack', {
  env: {
    account: process.env.ACCOUNT || "",
    region: process.env.REGION || ""
  },
});
