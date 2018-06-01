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
            it('should be up to ' + profile.size + ' pixels wide', function() {
              let expectedSize = profile.size < metadata.width ? profile.size : metadata.width;
              expect(metadata.width).to.be.equal(expectedSize);
            });
          }

        });
      }
    });
  }
});