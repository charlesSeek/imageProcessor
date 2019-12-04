const { PROFILES, FORMAT_OPTIONS } = require('../const/index')

/**
 * build convert arguments
 * @params {String} inputPath
 * @params {String} outputPath
 * @params {String} profile
 * @params {Object} metadata
 * @return {Array} args
 */
exports.buildConvertArgs = (inputPath, outputPath, profile, metadata) => {
    let args = []
    if (metadata.colorspace == 'CMYK') {
        args = args.concat(['-profile', './colorprofiles/sRGB2014.icc'])
    }
    args = args.concat(FORMAT_OPTIONS.default)
    if (FORMAT_OPTIONS[metadata.format]) {
        args = args.concat(FORMAT_OPTIONS[metadata.format])
    }
    if (profile) {
        const pro = PROFILES[profile]
        if (pro) {
            args = args.concat(['-define', 'png:extent='+pro.filesize+'kb'])
            if (pro.size) {
                let sizeTo = pro.size;
                if (metadata.orientation == 'landscape') {
                    sizeTo = pro.size > metadata.width ? metadata.width : pro.size
                } else {
                    sizeTo = pro.size > metadata.height ? metadata.height : pro.size;
                }
                let resize = metadata.orientation == 'landscape' ? sizeTo+'x' : 'x'+sizeTo
                args = args.concat(['-resize', resize]);
            }
            if (pro.watermark) {
                let fontSizer = pro.size ? pro.size : metadata.orientation == 'landscape' ? metadata.width : metadata.height;
                args = args.concat([
                    '-fill',
                    'rgba(255,255,255,0.7)',
                    '-font',
                    './fonts/Arial.ttf',
                    '-pointsize', fontSizer/5,
                    '-gravity', 'center',
                    '-annotate',
                    '-40x-40+0+0',
                    'myadbox'
                ]);
            }
        }
        if(inputPath.indexOf('.pdf') == -1) {
            args = args.concat([inputPath, outputPath]);
        } else {
            args = args.concat([inputPath+'[0]', outputPath]);
        }
    }
    return args
}