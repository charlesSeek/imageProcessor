const AWS = require('aws-sdk');
const im = require('imagemagick');
const path = require('path');
const execSync = require('child_process').execSync;
const fs = require('fs');
const needle = require('needle');

const s3 = new AWS.S3();

const IDENTIFY_COMMAND = "identify -format \"%[width],%[height],%[size],%m,\n%[EXIF:*]\" ";
const CONVERT_COMMAND = "convert  "

exports.PROFILES = {
  smallThumb: {
    size: 300,
    filesize: 100,
    suffix: '-st'
  },
  largeThumb: {
    size: 600,
    filesize: 500,
    suffix: '-lt'
  },
  smallPreview: {
    filesize: 1024,
    suffix: '-sp'
  },
  largePreview: {
    filesize: 2048,
    suffix: '-lp'
  }
}

const FORMAT_OPTIONS = {
  defaults:  '-strip -interlace Plane -background white -flatten',
  PNG: '-background gray',
  PSD: '-trim',
  TIFF: '-background gray',
  PS: '-resize 2048x -density 600'
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
        ACL: 'public-read'
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
  let metadata = {};
  let data = execSync(IDENTIFY_COMMAND+imagePath).toString().split('\n');
  let features = data.shift().split(',');
  metadata.width = parseInt(features[0]);
  metadata.height = parseInt(features[1]);
  metadata.fileSize = parseInt(features[2]);
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
  return metadata;
}

exports.convertImage = function(imagePath, outputPath, profile_name) {
  
  let newPath = outputPath;
  let metadata = exports.identifyImage(imagePath);

  let args = [FORMAT_OPTIONS.defaults];
  if(FORMAT_OPTIONS[metadata.format] !== undefined) {
    args.push(FORMAT_OPTIONS[metadata.format])
  }
  let profile = exports.PROFILES[profile_name];
  if(profile !== undefined) {
    args.push(['-define jpeg:extent=', profile.filesize, 'kb'].join(''));
    if(profile.size !== undefined) {
      let resize = metadata.orientation == 'landscape' ? profile.size+'x' : 'x'+profile.size;
      args.push(['-resize', resize].join(' '));
    }
    
    newPath = exports.helpers.applySuffix(newPath, profile.suffix);
  }
  
  execSync([CONVERT_COMMAND, args.join(' '), imagePath, newPath].join(' '));
  return newPath;
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
  buildPreviews: function(imagePath, outputPath) {
    let profiles = Object.keys(exports.PROFILES);
    let previews = [];
    for(let i = 0; i < profiles.length; i++) {
      let profile = profiles[i];
      let file = exports.convertImage(imagePath, outputPath, profile);
      let metadata = exports.identifyImage(file);
      previews.push({
        name: profile,
        file: file,
        metadata: metadata
      });
    }
    return previews;
  },
  uploadPreviews: function(previews, bucket, key) {
    return new Promise(async function(resolve) {
      let keys = [];
      for(let i = 0; i < previews.length; i++){
        let preview = previews[i];
        let newKey = await exports.uploadImage(preview.file, bucket, imageKey);
        keys.push({
            name: preview.name,
            metadata: preview.metadata,
            key: newKey
        });
      }
      resolve(keys);
    });
  },
  postback: function(url, previewKeys) {
    params = {
      secret: 'HCpvuiUNRLwbMmtaqvkvdbLBE2ZeVgJhJdiUeUFuTGGZXxGG4m',
      previews: previewKeys
    };

    return new Promise(function(resolve) {
      needle.post(url, params).on('done', function(err, resp){
        resolve(resp);
      })
    })
  }
}

exports.handler = async function(event, context, finished) {
  const imagePath = exports.helpers.getImagePath(event.key);
  const outputPath = exports.helpers.replaceExtension(imagePath, 'jpg');

  await exports.downloadImage(bucket, event.key, imagePath);

  const previews = exports.helpers.buildPreviews(imagePath, outputPath);
  const previewKeys = await exports.helpers.uploadPreviews(previews, event.bucket, imageKey);
  await exports.helpers.postback(event.postback_url, previewKeys);
  finished();
}