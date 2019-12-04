"use strict";
const AWS = require("aws-sdk");
const fs = require("fs");
const s3 = new AWS.S3();
const path = require("path");
const childProcess = require("child_process");
const sqs = new AWS.SQS({ region: 'us-east-1'})
exports.downloadImage = (bucket, s3Key, target) => {
    return new Promise((resolve, reject) => {
        s3.getObject({
            Bucket: bucket,
            Key: s3Key
        }, (err, res) => {
            if (err) {
                console.log("Get s3 object error:", JSON.stringify(err));
                reject('Get s3 object error')
            } else {
                const buffer = Buffer.from(res.Body, "binary");
                fs.writeFileSync(target, buffer);
                resolve(target)
            }
        })
    })
}

exports.upladImage = (imagePath, bucket, key) => {
    return new Promise((resolve, reject) => {
        const imageFileName = path.basename(imagePath);
        const baseFileName = path.basename(key);
        const uploadKey = key.replace(baseFileName, imageFileName);
        s3.putObject({
            Bucket: bucket,
            Key: uploadKey,
            Body: fs.readFileSync(imagePath),
            ACL: "public-read",
            ContentDisposition: "attachment"
        }, (err, data) => {
            if (err) {
                console.log('S3 put object error:', JSON.stringify(err));
                reject(JSON.stringify(err))
            } else {
                resolve(uploadKey)
            }
        })
    })
}
exports.sendSQS = (url, message) => {
    return new Promise((resolve, reject) => {
        const params = {
            MessageBody: JSON.stringify(message),
            QueueUrl: url
        }
        sqs.sendMessage(params, (err, data) => {
            if (err) {
                console.log(`Sending SQS failed ${JSON.stringify(err)}`)
                return reject('send SQS message failed')
            } else {
                console.log('SQS send message successfully:', JSON.stringify(data))
                return resolve()
            }
        })
    })
}