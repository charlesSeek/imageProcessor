const Asset = require('./models/Asset')
const  { cleanDirectory }= require('./utils/FileHelper')

exports.handler =  (event, context, callback) => {
  const records = event.Records
  cleanDirectory('/tmp')
  for (let i=0;i<records.length;i++) {
    const record = records[i]
    const params = JSON.parse(record.Sns.Message)
    const asset = new Asset(params)
    asset.preProcess()
    .then(data => asset.process(data))
    .then((response) => asset.postProcess(response))
    .then(() => console.log('Asset thumbnail processing is finished'))
    .catch(err => {
      console.log(JSON.stringify(err))
    })
    
  }
}
