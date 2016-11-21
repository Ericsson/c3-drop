
const TRANSFER_START_TIMEOUT_MS = 10000
const PERCENT_ENCODE_REGEX = /[\x00-\x20<=>*,/:;?{}@[\\\]"'()\x7f]/g

let transfers = new Map()

this.addEventListener('fetch', event => {
  let {request} = event
  if (!request.url.startsWith(registration.scope)) {
    return
  }
  let path = request.url.slice(registration.scope.length)
  if (!path.startsWith('intercept-download/')) {
    return
  }

  let transferId = path.slice('intercept-download/'.length)
  let transfer = transfers.get(transferId)
  if (!transfer) {
    console.error(`got download request for missing transfer id '${transferId}'`)
    event.respondWith(new Response("", {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''download%20error`,
      },
    }))
    return
  }

  transfers.delete(transferId)
  console.log(`got download request for id=${transferId}, name=${transfer.name}, bytes=${transfer.size}`)

  clearTimeout(transfer.startTimeoutId)
  delete transfer.startTimeoutId

  let encodedName = encodeURIComponent(transfer.name).replace(PERCENT_ENCODE_REGEX, char => {
    var hex = char.charCodeAt(0).toString(16).toUpperCase()
    return hex.length === 1 ? '%0' + hex : '%' + hex
  })

  event.respondWith(new Response(transfer.stream, {headers: {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
    'Content-Length': transfer.size,
  }}))
})

this.addEventListener('message', event => {
  console.log(`got event with type ${event.data.type}`)
  if (event.data.type === 'start-download') {
    event.waitUntil(startDownload(event.data, event.ports))
  }
})

function startDownload({name, size}, [port]) {
  return new Promise((resolve, reject) => {
    var transferId
    do {
      transferId = Math.random().toString(36).slice(2)
    } while (transfers.has(transferId))

    let url = `${registration.scope}intercept-download/${transferId}`
    console.log(`got transfer of '${name}', ${size}bytes, with ${url}`)
    port.postMessage({url})

    let stream = new ReadableStream({
      start(controller) {
        port.onmessage = ({data}) => {
          if (data.type === 'done') {
            controller.close()
            port.onmessage = null
            resolve()
          } else if (data.type === 'error') {
            let msg = `Download failed, ${data.error.name}: ${data.error.message}`
            console.error(msg)
            port.onmessage = null
            let error = new Error(msg)
            error.name = 'DownloadError'
            controller.error(error)
            reject(error)
          } else if (data.type === 'chunk') {
            let chunk = new Uint8Array(data.chunk)
            controller.enqueue(chunk)
          } else {
            console.error('transfer port received unknown message:', data)
          }
        }
      },
      cancel() {
        console.log("Stream aborted")
        transfers.delete(transferId)
      },
    })

    let transfer = {transferId, port, name, size, stream}
    transfers.set(transferId, transfer)

    transfer.startTimeoutId = setTimeout(() => {
      transfers.delete(transferId)
      transfer.stream.cancel()
      transfer.stream = null
      port.onmessage = null
    }, TRANSFER_START_TIMEOUT_MS)
  })
}
