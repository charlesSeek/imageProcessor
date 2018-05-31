'use strict';

const app = require('../app.js');
const fs = require('fs');
const chai = require('chai');
chai.use(require('chai-string'));
const expect = chai.expect;
const sinon = require('sinon');
const mockAWS = require('mock-aws-sinon');

var event, context;

describe('helpers', function () {
  describe('getImagePath', function() {
    it('should return a local filepath given an s3 key', function() {
      expect(app.helpers.getImagePath('/some/s3/key')).to.equal('/tmp/key');
    });
  });

  describe('replaceExtension', function() {
    it('should replace the extension of a given filepath', function() {
      expect(app.helpers.replaceExtension('/some/file.txt', 'jpg')).to.equal('/some/file.jpg');
    });
  });
  
  describe('applySuffix', function() {
    it('should add a suffix onto the filename', function() {
      expect(app.helpers.applySuffix('/some/file/path.txt', '-st')).to.equal('/some/file/path-st.txt');
    });
  });
});

describe('downloadImage', function () {

  let bucket = 'some-bucket';
  let key = 'some/key';
  let destination = '/tmp/morpheus.jpg'

  beforeEach((done) => {
    mockAWS('S3', 'getObject').returns({
      Body: fs.readFileSync('tests/fixtures/morpheus.jpg')
    });
    done();
  });
  afterEach((done) => {
    if (fs.existsSync(destination))
      fs.unlinkSync(destination);
    done();
  });


  it('should save the file to disk', async function() {
    await app.downloadImage(bucket, key, destination);
    expect(fs.existsSync(destination)).to.equal(true);
  }); 


});

describe('uploadImage', function() {
  let imagePath = 'tests/fixtures/morpheus.jpg';
  let response = {};
  beforeEach(function () {
    mockAWS('S3', 'putObject').returns(response);
  });

  it('should upload image to S3', async function() {
    let bucket = 'some-bucket';
    let key = '/some/key.txt';
    let newKey = await app.uploadImage(imagePath, bucket, key);
    expect(newKey).to.equal('/some/morpheus.jpg');
  });

});

describe('identifyImage', function () {
  let imagePath = 'tests/fixtures/morpheus.jpg';
  let metadata = app.identifyImage(imagePath);
  it('should get exif data', function() {
    expect(metadata.exif).to.deep.equal({ColorSpace: 1, ExifImageLength: 835, ExifImageWidth: 1600, ExifOffset: 38, Orientation: 1});
  });
  it('should get width and height', function () {
    expect(metadata.width).to.equal(1600);
    expect(metadata.height).to.equal(835);
  });
  it('should get size', function() {
    expect(metadata.fileSize).to.equal(258110);
  });
  it('should get format', function() {
    expect(metadata.format).to.equal('JPEG');
  });
  it('should get orientation', function() {
    expect(metadata.orientation).to.equal('landscape');
  });
  it('should calculate the size at 300 DPI', function () {
    expect(metadata.print.width).to.equal(135.47);
    expect(metadata.print.height).to.equal(70.7);
  });
});

describe('convertImage', function() {
  const FORMATS = [
    {
      name: 'pdfs',
      fixture: 'tests/fixtures/bt-50.pdf',
      output: '/tmp/bt-50.jpg'
    },
    {
      name: 'pngs',
      fixture: 'tests/fixtures/Mazda3.png',
      output: '/tmp/Mazda3.jpg'
    },
    {
      name: 'eps',
      fixture: 'tests/fixtures/Ferrari.eps',
      output: '/tmp/Ferrari.jpg'
    },
    {
      name: 'psds',
      fixture: 'tests/fixtures/Prado.psd',
      output: '/tmp/Prado.jpg'
    },
    {
      name: 'tifs',
      fixture: 'tests/fixtures/bt-50.tif',
      output: '/tmp/bt-50.tif.jpg'
    },
    {
      name: 'ais',
      fixture: 'tests/fixtures/dealer-tag.ai',
      output: '/tmp/dealer-tag.jpg'
    }
  ];

  for (let i=0; i < FORMATS.length; i++) {
    let format = FORMATS[i];
    let imagePath, outputPath, newPath;

    describe(format.name, function() {
      imagePath = format.fixture;
      outputPath = format.output;

      afterEach((done) => {
        if (fs.existsSync(newPath))
          fs.unlinkSync(newPath);
        done();
      });

      let profiles = Object.keys(app.PROFILES);
      for (let j=0; j < profiles.length; j++) {
        let profileName = profiles[j];
        let profile = app.PROFILES[profileName];

        describe(profileName, function () {
          let metadata;
          this.timeout(10000);

          before(function() {
            newPath = app.convertImage(imagePath, outputPath, profileName);
            metadata = app.identifyImage(newPath);
          });

          it('should produce a jpg', function() {
            expect(fs.existsSync(newPath)).to.equal(true);
          });

          it('should have a filesize less than ' + profile.filesize + 'Kb', function() {
            expect(metadata.fileSize).to.be.below(profile.filesize * 1000);
          });
          it('should have '+profile.suffix+' in the filepath', function() {
            expect(newPath).to.containIgnoreSpaces(profile.suffix);
          });

          if(profile.size !== undefined) {
            it('should be ' + profile.size + ' pixels wide', function() {
              expect(metadata.width).to.be.equal(profile.size);
            });
          }

        });
      }
  
      // it('should produce large thumbnail', function() {
      //   newPath = app.convertImage(imagePath, outputPath, 'largeThumb')
      //   expect(fs.existsSync(newPath)).to.equal(true);
      //   expect(fs.statSync(newPath).size).to.be.below(LARGE_THUMBNAIL_LIMIT_BYTES);
      //   expect(newPath).to.containIgnoreSpaces('-lt.');
      // }).timeout(5000);
  
      // it('should product small preview', function() {
      //   newPath = app.convertImage(imagePath, outputPath, 'smallPreview')
      //   expect(fs.existsSync(newPath)).to.equal(true);
      //   expect(fs.statSync(newPath).size).to.be.below(SMALL_PREVIEW_LIMIT_BYTES);
      //   expect(newPath).to.containIgnoreSpaces('-sp.');
      // }).timeout(5000);
  
      // it('should produce large preview', function() {
      //   newPath = app.convertImage(imagePath, outputPath, 'largePreview')
      //   expect(fs.existsSync(newPath)).to.equal(true);
      //   expect(fs.statSync(newPath).size).to.be.below(LARGE_PREVIEW_LIMIT_BYTES);
      //   expect(newPath).to.containIgnoreSpaces('-lp.');
      // }).timeout(5000);

    });
  }

  // describe('pdfs', function() {
  //   let imagePath = 'tests/fixtures/bt-50.pdf';
  //   let outputPath = '/tmp/bt-50.jpg';
  //   let newPath;

  //   afterEach((done) => {
  //     if (fs.existsSync(newPath))
  //       fs.unlinkSync(newPath);
  //     done();
  //   });

  //   it('should convert to jpg', function() {
  //     newPath = app.convertImage(imagePath, outputPath, null);
  //     expect(newPath).to.equal(outputPath);
  //     expect(fs.existsSync(outputPath)).to.equal(true);
  //   }).timeout(7000);

  //   it('should produce small thumbnail', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'smallThumb');
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(SMALL_THUMBNAIL_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-st.');
  //   }).timeout(3000);

  //   it('should produce large thumbnail', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'largeThumb')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(LARGE_THUMBNAIL_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-lt.');
  //   }).timeout(3000);

  //   it('should product small preview', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'smallPreview')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(SMALL_PREVIEW_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-sp.');
  //   }).timeout(3000);

  //   it('should produce large preview', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'largePreview')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(LARGE_PREVIEW_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-lp.');
  //   }).timeout(3000);
  // });
  
  // describe('png', function() {
  //   let imagePath = 'tests/fixtures/Mazda3.png';
  //   let outputPath = '/tmp/Mazda3.jpg';
  //   let newPath;

  //   afterEach((done) => {
  //     if (fs.existsSync(newPath))
  //       fs.unlinkSync(newPath);
  //     done();
  //   });

  //   it('should convert to jpg', function() {
  //     newPath = app.convertImage(imagePath, outputPath, null);
  //     expect(newPath).to.equal(outputPath);
  //     expect(fs.existsSync(outputPath)).to.equal(true);
  //   });

  //   it('should produce small thumbnail', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'smallThumb');
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(SMALL_THUMBNAIL_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-st.');
  //   });

  //   it('should produce large thumbnail', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'largeThumb')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(LARGE_THUMBNAIL_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-lt.');
  //   });

  //   it('should product small preview', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'smallPreview')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(SMALL_PREVIEW_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-sp.');
  //   });

  //   it('should produce large preview', function() {
  //     newPath = app.convertImage(imagePath, outputPath, 'largePreview')
  //     expect(fs.existsSync(newPath)).to.equal(true);
  //     expect(fs.statSync(newPath).size).to.be.below(LARGE_PREVIEW_LIMIT_BYTES);
  //     expect(newPath).to.containIgnoreSpaces('-lp.');
  //   });
  // }); 
});

// describe('handler', function() {
//   let imagePath = 'tests/fixtures/morpheus.jpg';
//   let response = {};
//   before(function () {
//     mockAWS('S3', 'putObject').returns(response);
//     mockAWS('S3', 'getObject').returns({
//       Body: fs.readFileSync('tests/fixtures/morpheus.jpg')
//     });
//   });

//   it('should generate each jpg', function() {
//     expect(exports.downloadImage).
//   });
//   it('should build make callback');
// })


// describe('processImage', function () {
//   describe('with jpg', function () {
//     beforeEach((done) => {
//       mockAWS('S3', 'getObject').returns({
//         an: {Body: fs.readFileSync('./fixtures/morpheus.jpg') }
//       });
//       event = {

//       }
//     });
//     it('Should generate a small version', async () => {
//       const result = await app.lambda_handler(event, context, (err, result) => {
//         expect(result)
//       });
//     });
//   });

//     it('verifies successful response', async () => {
//         const result = await app.lambda_handler(event,  , (err, result) => {
//             expect(result).to.be.an('object');
//             expect(result.statusCode).to.equal(200);
//             expect(result.body).to.be.an('string');

//             let response = JSON.parse(result.body);

//             expect(response).to.be.an('object');
//             expect(response.message).to.be.equal("hello world");
//             expect(response.location).to.be.an("string");
//         });
//     });
// });

