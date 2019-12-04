const path = require("path")
const fs = require('fs')
exports.getImagePath = (imageKey) => {
    return path.join("/tmp", path.basename(imageKey));
}
exports.replaceExtension = (imagePath, extension) => {
    const imageFilename = path.basename(imagePath);
    const imageExt = path.extname(imagePath);
    const outputFilename = imageFilename.replace(imageExt, '.'+extension);
    return imagePath.replace(imageFilename, outputFilename);
}
exports.applySuffix = (filePath, suffix) => {
    const extension = path.extname(filePath);
    const filename = path.basename(filePath, extension);
    const newFilename = [filename, suffix, extension].join('');
    const oldFilename = path.basename(filePath);
    return filePath.replace(oldFilename, newFilename);
}
exports.cleanup = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
}
exports.cleanDirectory = (dir) => {
    const files = fs.readdirSync(dir)
    if (files.length > 0) {
        for (let i=0;i<files.length;i++) {
            const filePath = `${dir}/${files[i]}`
            if (fs.statSync(filePath).isFile()) {
                this.cleanup(filePath)
            } else {
                if (fs.statSync(filePath).isDirectory()) {
                    this.cleanDirectory
                }
            }
            
        }
    }
}
exports.copyFile = (src, dest) => {
    return new Promise((resolve, reject) => {
        fs.copyFile(src, dest, err => {
            if (err) {
                reject('color profile copy failed')
            } else {
                resolve()
            }
        })
    })
}
exports.refactorMetadata = (formatData) => {
    const data = formatData.toString().split("\n")
    const features = data.shift().split(",").map(feature => feature.trim())
    const metadata = {}
    metadata.width = parseInt(features[0])
    metadata.height = parseInt(features[1])
    metadata.colorspace = features[2]
    metadata.fileSize = features[3]
    metadata.format = features[4]
    metadata.orientation =  metadata.width > metadata.height ? 'landscape' : 'portrait'
    metadata.print = {
        width: Math.round((metadata.width / 300) * 25.4 * 100) / 100,
        height: Math.round((metadata.height / 300) * 25.4 * 100) / 100
    }
    metadata.exif = {}
    for (let i=0; i< data.length; i++) {
        if (data[i].indexOf("exif:") == -1) break;
        if (data[i].length > 0) {
            const pair = data[i].split(':')[1].split('=')
            metadata.exif[pair[0]] = parseInt(pair[1]);
        }
    }
    return metadata
 }