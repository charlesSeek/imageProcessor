const { downloadImage, upladImage, sendSQS }= require('../utils/S3Helper')
const { refactorMetadata, 
        replaceExtension, 
        applySuffix,
        getImagePath } 
    = require('../utils/FileHelper')
const { spawnPromise } = require('../utils/ChildProcessPromise')
const { buildConvertArgs } = require('../utils/lib.js')
const { PROFILES, IDENTIFY_FORMAT } = require('../const/index')

class Asset {
    /**
     * @param  {String} bucket
     * @param  {String} key
     * @param  {String} format
     * @param  {String} postback_url
     * @param  {String} brand
     * @param  {String} asset_id
     * @param  {Boolean} watermark
     * @param  {Array[String]} profiles
     * @param  {String} queue
     * @param  {String} id
     */
    constructor({bucket, key, format, postback_url, brand, asset_id, watermark, profiles, queue, id}) {
        this.bucket = bucket
        this.s3Key = key
        this.format = format
        this.postback_url = postback_url
        this.brand = brand
        this.asset_id = asset_id
        this.watermark = watermark
        this.profiles = profiles
        this.queue = queue
        this.id = id
    }
    /**
     * Asset preprocess method, including:
     * 1. download original asset file from aws
     * 2. copy color profile to /tmp
     * 3. Get original file metadata
     * 4. Generate original preview png file
     * @returns {Promise}
     */
    async preProcess() {
        try {
            const bucket = this.bucket
            const s3Key = this.s3Key
            const target = getImagePath(s3Key)
            const imagePath = await downloadImage(bucket, s3Key, target)
            console.log(`Downloading ${imagePath} successfully`)
            const formatData = await spawnPromise(
                '/opt/bin/identify',
                ['-format', IDENTIFY_FORMAT, imagePath]
            )
            const metadata = refactorMetadata(formatData)
            console.log(`Getting metadata ${JSON.stringify(metadata)} successfully`)
            const outputPath = replaceExtension(imagePath, 'png')
            const args = buildConvertArgs(imagePath, outputPath, 'originalPreview', metadata)
            await spawnPromise(
                '/opt/bin/convert',
                args
            )
            return Promise.resolve({originalPreview: outputPath, metadata})
        } catch (err) {
            return Promise.reject(JSON.stringify(err))
        }
    }
    /**
     * Generating multiple size thumbnails based on profiles and upload them to AWS
     * @param {JSON} metadata 
     * @param {String} originalPreview
     * @returns {Promise}
     */
    async process({metadata, originalPreview}) {
        const profiles = this.profiles
        const S3Keys = []
        const brand = this.brand
        const asset = this.asset_id
        const id = this.id
        const response = {brand, asset, id}
        for (let profile of profiles) {
            const pro = PROFILES[profile]
            let args = []
            if (pro) {
                const outputPath = applySuffix(originalPreview, pro.suffix)
                args = buildConvertArgs(originalPreview, outputPath, profile, metadata)
                try {
                    await spawnPromise(
                        '/opt/bin/convert',
                        args
                    )
                    console.log(`Generating ${profile} successfully`)
                    const bucket = this.bucket
                    const key = this.s3Key
                    const uploadKey = await upladImage(outputPath, bucket, key)
                    console.log(`Uploading ${uploadKey} successfully`)
                    response[profile] = uploadKey
                } catch (err) {
                    console.log(`${JSON.stringify(err)}`)
                }
            }
        }
        response.metadata = metadata
        console.log(`Response ${JSON.stringify(response)}`)
        return Promise.resolve(response)
    }
    /**
     * After thumbnails processing, send message to SQS
     * @params {Object} response
     */
    async postProcess(response) {
        const queue = this.queue
        try {
            await sendSQS(queue, response)
            console.log(`send SQS message successfully, ${JSON.stringify(response)}`)
        } catch (err) {
            console.log(`Sending SQS message failed ${JSON.stringify(err)}`)
        }
    }

}
module.exports = Asset