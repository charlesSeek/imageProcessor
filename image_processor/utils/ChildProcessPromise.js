const childProcess = require('child_process')
exports.spawnPromise = (command, args, envOptions = {env: process.env, cwd: process.cwd()}) => {
    return new Promise((resolve, reject) => {
        console.log(`executing ${command} ${args.join(' ')}`)
        const childProc = childProcess.spawn(command, args, envOptions)
        const resultBuffers = []
        childProc.stdout.on('data', buffer => {
            resultBuffers.push(buffer)
        })
        childProc.stderr.on('data', buffer => console.log(buffer.toString()))
        childProc.on('exit', (code, signal) => {
            if (code) {
                reject(`${command} exited with ${code}`)
            } else {
                resolve(Buffer.concat(resultBuffers).toString().trim())
            }

        })
    })
}
