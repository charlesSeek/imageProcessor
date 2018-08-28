const AWS  = require('aws-sdk');
const path = require('path');
const s3   = new AWS.S3();
const sqs  = new AWS.SQS({region : 'us-east-1'});
const fs   = require('fs');
const Chromeless = require('chromeless').default;

const helpers = {
  cleanup: function(filepath) {
    if (fs.existsSync(filepath)) {
      console.log("Removing", filepath);
      fs.unlinkSync(filepath);
    }
  },
  sqs: function(queueUrl, message) {
    return new Promise(function(resolve) {
      const params = {
        MessageBody: JSON.stringify(message),
        QueueUrl: queueUrl
      };
      sqs.sendMessage(params, function(err,data){
        if(err) {
          console.log('error:',"Fail Send Message" + err);
        }
        resolve();
      });
    });
  }
}

const generate  = async function(job) {
  let chromeless = new Chromeless({
    debug: true,
    remote: {
      endpointUrl: 'https://2779gb4ur5.execute-api.us-east-1.amazonaws.com/dev/',
      apiKey: 'bjg5CP2aRL156AETLUlQk2qcVPxprlspgLvgoBHf'
    }
  });

  let screenshot = await chromeless
      .goto(job.url)
      .screenshot();
  await chromeless.end();
  return screenshot;
}

const uploadImage = function (imagePath, bucket, baseKey) {
  return new Promise(function(resolve) {
    let imageFilename = path.basename(imagePath);
    let baseFilename = path.basename(baseKey);
    let uploadKey = baseKey.replace(baseFilename, imageFilename);

    s3.putObject(
      {
        Bucket: bucket,
        Key: uploadKey,
        Body: fs.readFileSync(imagePath),
        ACL: 'public-read',
        ContentDisposition: 'attachment'
      },
      function(err, data) {
        if(err) {
          console.log(err);
          resolve(null);
        }
        resolve(uploadKey);
    });
  });
}

exports.handler = async function(event, context) {
  try {
    for (let i = 0; i < event.Records.length; i++) {
      let record = event.Records[i];
      const job = JSON.parse(record.Sns.Message);
      console.log("Processing HTML Screenshot...", job);
      let screenshot = await generate(job)
      console.log("Screenshot", screenshot)
      let key = await uploadImage(screenshot, job.bucket, job.key);
      helpers.cleanup(screenshot)
      job.success = true
      await helpers.sqs(job.queue, job);
    }
    context.done();
  } catch (err) {
    console.log(err)
  }
}
