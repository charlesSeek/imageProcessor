const AWS = require('aws-sdk');
const im = require('imagemagick');
const path = require('path');
const execSync = require('child_process').execSync;
const fs = require('fs');
const RestClient = require('node-rest-client').Client;

const s3 = new AWS.S3();

const IDENTIFY_COMMAND = "identify -format \"%[width],%[height],%[size],%m,\n%[EXIF:*]\" ";
const CONVERT_COMMAND = "convert  "

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
      let sizeTo = profile.size;
      if (metadata.orientation == 'landscape') {
        sizeTo = profile.size > metadata.width ? metadata.width : profile.size;
      }
      else {
        sizeTo = profile.size > metadata.height ? metadata.height : profile.size;
      }
      let resize = metadata.orientation == 'landscape' ? sizeTo+'x' : 'x'+sizeTo;
      
      args.push(['-resize', resize].join(' '));
    }

    if(profile.watermark) {
      let fontSizer = profile.size ? profile.size : metadata.orientation == 'landscape' ? metadata.width : metadata.height;
      args.push(['-fill', '"rgba(255,255,255,0.7)"', '-pointsize', fontSizer/5, '-gravity', 'center', '-annotate', '-40x-40+0+0', 'myadbox'].join(' '));
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
      let keys = {};
      for(let i = 0; i < previews.length; i++){
        let preview = previews[i];
        let newKey = await exports.uploadImage(preview.file, bucket, key);
        keys[preview.name] = {key: newKey, metadata: preview.metadata};
      }
      resolve(keys);
    });
  },
  postback: function(url, imageMetadata, previewKeys) {
    params = {
      secret: 'HCpvuiUNRLwbMmtaqvkvdbLBE2ZeVgJhJdiUeUFuTGGZXxGG4m',
      orientation: imageMetadata.orientation,
      size: {
        dimensions: imageMetadata.width + 'x' + imageMetadata.height + ' pixels',
        print_dimensions: imageMetadata.print.width + 'x' + imageMetadata.print.height + ' mm (@ 300DPI)'
      },
      preview_small: previewKeys.smallThumb.key,
      preview_large: previewKeys.largeThumb.key,
      preview_low_res: previewKeys.smallPreview.key,
      preview_high_res: previewKeys.originalPreview.key,
      preview_low_res_wm: previewKeys.smallWatermarkedPreview.key
    };

    return new Promise(function(resolve) {
      try {
        let client = new RestClient();
        client.post(url, {data: params}, function(data, resp){
          resolve(resp);
        });
      }
      catch(e) {
        console.log(e.message);
      }
    })
  }
}

exports.handler = async function(event, context, finished) {
  try {
    const params = JSON.parse(event.body).params;
    const imagePath = exports.helpers.getImagePath(params.key);
    const outputPath = exports.helpers.replaceExtension(imagePath, 'jpg');
    await exports.downloadImage(params.bucket, params.key, imagePath);
    const previews = exports.helpers.buildPreviews(imagePath, outputPath);
    const previewKeys = await exports.helpers.uploadPreviews(previews, params.bucket, params.key);
    const imageMetadata = exports.identifyImage(imagePath);
    await exports.helpers.postback(params.postback_url, imageMetadata, previewKeys);
    finished(null, {statusCode: 200});
  }
  catch (err) {
    finished(err.message, {statusCode: 500});
  }
}