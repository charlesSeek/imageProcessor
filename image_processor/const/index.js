exports.PROFILES= {
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
exports.FORMAT_OPTIONS = {
    default: ['-strip', '-interlace', 'Plane'],
    GIF: ['-flatten', '-background', 'grey'],
    PSD: ['-trim', '-flatten', '-background', 'grey'],
    PS: ['-resize', '2048x', '-density', '600', '-flatten', '-background', 'grey'],
    EPS: ['-resize', '2048x', '-density', '600', '-colorspace', 'sRGB'],
    EPT: ['-resize', '2048x', '-density', '600', '-colorspace', 'sRGB']
}
exports.IDENTIFY_FORMAT = '%[width], %[height], %[colorspace], %[size], %m, \n%[EXIF:*]'