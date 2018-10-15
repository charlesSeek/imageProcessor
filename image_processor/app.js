const AWS = require('aws-sdk');
const im = require('imagemagick');
const path = require('path');
// const execSync = require('child_process').execSync;
const fs = require('fs');

const s3 = new AWS.S3();
const sqs = new AWS.SQS({region : 'us-east-1'});

const IDENTIFY_FORMAT = '%[width],%[height],%[size],%m,\n%[EXIF:*]';

exports.PROFILES = {
  smallThumb: {
    size: 300,
    filesize: 100,
    suffix: '-st',
  },
  largeThumb: {
    size: 600,
    filesize: 500,
    suffix: '-lt'
  },
  smallPreview: {
    size: 1024,
    filesize: 800,
    suffix: '-sp'
  },
  smallWatermarkedPreview: {
    size: 1024,
    watermark: true,
    filesize: 800,
    suffix: '-wmsp'
  },
  originalPreview: {
    filesize: 1024,
    suffix: '-op'
  }
}

const FORMAT_OPTIONS = {
  defaults:  ['-strip', '-interlace', 'Plane'],
  GIF: ['-flatten', '-background', 'grey'],
  PSD: ['-trim', '-flatten', '-background', 'grey'],
  PS: ['-resize', '2048x', '-density', '600', '-flatten', '-background', 'grey'],
  EPS: ['-resize', '2048x', '-density', '600', '-colorspace', 'sRGB'],
  EPT: ['-resize', '2048x', '-density', '600', '-colorspace', 'sRGB']
}

exports.downloadImage = function (bucket, s3Key, destinationPath) {
  return new Promise(function(resolve) {
    s3.getObject({
      Bucket: bucket,
      Key: s3Key
    }, function(err, response) {
      var buffer = new Buffer(response.Body, "binary");
      fs.writeFileSync(destinationPath, buffer);
      resolve(destinationPath);
    });
  });
}

exports.uploadImage = function (imagePath, bucket, baseKey) {
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

exports.identifyImage = function (imagePath) {
  return new Promise(function(resolve) {
    im.identify(['-format', IDENTIFY_FORMAT, imagePath], function(err, output) {
      if (err) throw err;

      let data = output.toString().split('\n');
      let features = data.shift().split(',');
      let metadata = {};
      metadata.width = parseInt(features[0]);
      metadata.height = parseInt(features[1]);
      metadata.fileSize = fs.statSync(imagePath).size;
      metadata.format = features[3];
      metadata.orientation = metadata.width > metadata.height ? 'landscape' : 'portrait';
      metadata.print = {
        width: Math.round((metadata.width/300)*25.4*100)/100,
        height: Math.round((metadata.height/300)*25.4*100)/100
      }
      metadata.exif = {};
      for(let i=0; i < data.length; i++) {
        if (data[i].indexOf("exif:") == -1)
          break;

        if (data[i].length > 0) {
          let pair = data[i].split(':')[1].split('=');
          metadata.exif[pair[0]] = parseInt(pair[1]);
        }
      }
      resolve(metadata);
    });
  });
}

exports.convertImage = function(imagePath, outputPath, profile_name) {
  return new Promise(async function(resolve) {
    let metadata = await exports.identifyImage(imagePath);

    let newPath = outputPath;
    let args = FORMAT_OPTIONS.defaults;

    if(FORMAT_OPTIONS[metadata.format] !== undefined) {
      args = args.concat(FORMAT_OPTIONS[metadata.format])
    }

    let profile = exports.PROFILES[profile_name];
    if(profile !== undefined) {
      args = args.concat(['-define', 'png:extent='+profile.filesize+'kb']);

      if(profile.size !== undefined) {
        let sizeTo = profile.size;
        if (metadata.orientation == 'landscape') {
          sizeTo = profile.size > metadata.width ? metadata.width : profile.size;
        } else {
          sizeTo = profile.size > metadata.height ? metadata.height : profile.size;
        }
        let resize = metadata.orientation == 'landscape' ? sizeTo+'x' : 'x'+sizeTo;

        args = args.concat(['-resize', resize]);
      }

      if(profile.watermark) {
        let fontSizer = profile.size ? profile.size : metadata.orientation == 'landscape' ? metadata.width : metadata.height;
        args = args.concat(['-fill', 'rgba(255,255,255,0.7)', '-pointsize', fontSizer/5, '-gravity', 'center', '-annotate', '-40x-40+0+0', 'myadbox']);
      }

      newPath = exports.helpers.applySuffix(newPath, profile.suffix);
    }

    // if(args.indexOf('-background') == -1) {
    //   args = args.concat(['-background', 'none']);
    // }

    if(imagePath.indexOf('.pdf') == -1) {
      args = args.concat([imagePath, newPath]);
    } else {
      args = args.concat([imagePath+'[0]', newPath]);
    }

    im.convert(args, function(err, stdout) {
      if(err) throw err;
      resolve(newPath);
    });
  });
}

exports.helpers = {
  getImagePath: function(imageKey) {
    return path.join("/tmp", path.basename(imageKey));
  },
  replaceExtension: function (imagePath, extension) {
    let imageFilename = path.basename(imagePath);
    let imageExt = path.extname(imagePath);
    let outputFilename = imageFilename.replace(imageExt, '.'+extension);
    return imagePath.replace(imageFilename, outputFilename);
  },
  applySuffix: function(filePath, suffix) {
    let extension = path.extname(filePath);
    let filename = path.basename(filePath, extension);
    let newFilename = [filename, suffix, extension].join('');
    let oldFilename = path.basename(filePath);
    return filePath.replace(oldFilename, newFilename);
  },
  cleanup: function(filepath) {
    if (fs.existsSync(filepath)) {
      console.log("Removing", filepath);
      fs.unlinkSync(filepath);
    }
  },
  cleanTemp: function(dirPath) {
    try { var files = fs.readdirSync(dirPath); }
    catch(e) { return; }
    if (files.length > 0) {
      for (var i = 0; i < files.length; i++) {
        var filePath = dirPath + '/' + files[i];
        if (fs.statSync(filePath).isFile()) {
          exports.helpers.cleanup(filePath);
        } else {
          exports.helpers.cleanTemp(filePath);
        }
      }
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

exports.handler = async function(event, context) {
  // randomly getting error while downloading file
  // therefore added this clean temp on start
  // Error: ENOSPC: no space left on device, write
  console.log("Cleaning temp")
  exports.helpers.cleanTemp('/tmp')

  for (let i = 0; i < event.Records.length; i++) {
    let record = event.Records[i];
    const job = JSON.parse(record.Sns.Message);
    console.log("Processing Job...", job);
    let response = {
      brand: job.brand,
      asset: job.asset_id
    }
    const imagePath = exports.helpers.getImagePath(job.key);
    const outputPath = exports.helpers.replaceExtension(imagePath, 'png');
    console.log("Downloading", job.bucket, job.key, imagePath);
    await exports.downloadImage(job.bucket, job.key, imagePath);

    let originalPreview = await exports.convertImage(imagePath, outputPath, 'originalPreview');

    for(let j = 0; j < job.profiles.length; j++) {
      let profile = job.profiles[j];
      console.log("Converting...", profile);
      let preview = await exports.convertImage(originalPreview, outputPath, profile);
      console.log("Uploading", preview);
      response[profile] = await exports.uploadImage(preview, job.bucket, job.key);
    }
    response.metadata = await exports.identifyImage(imagePath);
    console.log("Sending to SQS", response);
    await exports.helpers.sqs(job.queue, response);
    console.log('Done!');
  }
  context.done();

}
