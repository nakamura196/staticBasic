import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as dotenv from "dotenv";

dotenv.config();

export class StaticBasicStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const recordName = process.env.RECORD_NAME || "";
    const domainName = process.env.DOMAIN_NAME || "";
    const bucketName = process.env.BUCKET_NAME || "";
    const cert = process.env.CERT_ARN || "";

    // ホストゾーンIDを取得
    const hostedZoneId = route53.HostedZone.fromLookup(this, "HostedZoneId", {
      domainName,
    });

    // S3バケットを作成
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      // removalPolicy: RemovalPolicy.DESTROY,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketName,
    });

    // CloudFront用のOrigin Access Identityを作成
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity",
      {
        comment: `${bucketName}-identity`,
      }
    );

    // S3バケットポリシーを設定
    const webSiteBucketPolicyStatement = new iam.PolicyStatement({
      actions: ["s3:GetObject"],
      effect: iam.Effect.ALLOW,
      principals: [
        new aws_iam.CanonicalUserPrincipal(
          originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        ),
      ],
      resources: [`${websiteBucket.bucketArn}/*`],
    });

    websiteBucket.addToResourcePolicy(webSiteBucketPolicyStatement);

    // CloudFront Functionの設定
    const cfFunction = new aws_cloudfront.Function(this, "CloudFrontFunction", {
      code: aws_cloudfront.FunctionCode.fromFile({
        filePath: "assets/redirect.js",
      }),
    });

    // 証明書を取得
    const certificate = Certificate.fromCertificateArn(
      this,
      "Certificate",
      cert
    );

    // CloudFrontの設定
    const distribution = new aws_cloudfront.Distribution(this, "distribution", {
      domainNames: [recordName ],
      certificate,
      comment: `${bucketName}-cloudfront`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: aws_cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy:
          aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: new aws_cloudfront_origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        functionAssociations: [
          {
            function: cfFunction,
            eventType: aws_cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      priceClass: aws_cloudfront.PriceClass.PRICE_CLASS_ALL,
    });

    // Route53レコード設定
    new route53.ARecord(this, "Route53RecordSet", {
      // ドメイン指定
      recordName,
      // ホストゾーンID指定
      zone: hostedZoneId,
      // エイリアスターゲット設定
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });
  }
}
