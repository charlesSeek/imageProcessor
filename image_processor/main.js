const app = require('./app')
const event = {
    Records: [
      {
        EventSource: "aws:sns",
        EventVersion: "1.0",
        EventSubscriptionArn: "arn:aws:sns:us-east-1:678241939174:mythumbnailer-dev:c6faff22-cde6-496f-b64f-824fed06a75e",
        Sns: {
          Type: "Notification",
          MessageId: "552da9f8-b212-59d8-b1ba-ffade64a3f1f",
          TopicArn: "arn:aws:sns:us-east-1:678241939174:mythumbnailer-dev",
          Subject: null,
          Message: {
            format: "thumbnail",
            type: "image",
            postback_url: "http://vwsa.myadbox.192.168.50.53.xip.io/api/v1/assets/750/preview",
            key: "vwsa/assets/a9ac77f3-bac9-423e-8d72-8e57748789e0/92723_100x188_Hero_1_A_2.tif",
            template: "vwsa/assets/a9ac77f3-bac9-423e-8d72-8e57748789e0/92723_100x188_Hero_1_A_2.tif",
            watermark: true,
            extra_params: {
              preview: null
            },
            force_operator: false,
            role: "misc",
            brand: "vwsa",
            asset_id: "750",
            bucket: "myadbox-assets-development",
            queue: "https://sqs.us-east-1.amazonaws.com/678241939174/lambda-return-queue-dev",
            profiles: [
              "smallThumb",
              "largeThumb",
              "smallPreview",
              "originalPreview",
              "smallWatermarkedPreview"
            ],
            id: "3b1717a7-3e65-49a2-ac12-d3b27bf72f0a"
          },
          Timestamp: "2019-11-25T04:01:28.049Z",
          SignatureVersion: "1",
          Signature: "F4AFO/ewqD5SnUOmsXB0Z9a9CoFWYVzZeijGeJ97X7Yq2hg+WqlRpggZ7t2c7mUHYt3Q+VE81SJzyLOUAXNTW5WNIAnLW4M4CSJi/5U3ZU1XrlTUu8J4YjHNRtWQ4nsV8sZf++LevxMH8b+mgypKWfegM6dQBP74I2kI+b4ERv0w8rizdSkQAcHK2eTqS6j6/gPUmBYYAnGTPByHuq2jMe7+UTVAPfD3125BpfJMxd4aeLwqMdvoAJU80h1U492RRV9WeRpGkVgXqWXUiGZZZKLJty6KDa7mMQCSculnCnvW9Ly00pBbL9Ycw9nGnkIFlY3fYrOL/CjQjMswuQqiWA==",
          SigningCertUrl: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-6aad65c2f9911b05cd53efda11f913f9.pem",
          UnsubscribeUrl: "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:678241939174:mythumbnailer-dev:c6faff22-cde6-496f-b64f-824fed06a75e",
          MessageAttributes: {}
        }
      }
    ]
}
app.handler(event)