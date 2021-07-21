import { ZBAY_DIR_PATH } from "./constants"
import Node from "./entryNode"

class NodeWithData extends Node {
  pubKey: string
  signature: string
  constructor(torPath?: string, pathDevLib?: string, peerIdFileName?: string, port = 7788, socksProxyPort = 9050, torControlPort = 9051, hiddenServicePort = 7788, torAppDataPath = ZBAY_DIR_PATH) {
    super(torPath, pathDevLib, peerIdFileName, port, socksProxyPort, torControlPort, hiddenServicePort, torAppDataPath)
    this.pubKey = Math.random().toString()
    this.signature = Math.random().toString()
  }

  private createMessage(sender: string) {
    return {
      id: Math.random().toString(),
      type: 999,
      message: `Message from ${sender}: ${Math.random()}`,
      createdAt: new Date().getTime(),
      channelId: 'someTestChannel',
      signature: this.signature,
      pubKey: this.pubKey
    }
  }

  public async init(): Promise<void> {
    console.log('init NodeWithData')
    this.tor = await this.spawnTor()
    const onionAddress = await this.spawnService()
    console.log('onion', onionAddress)
    const dataServer = await this.initDataServer()
    const connectonsManager = await this.initStorage(dataServer, onionAddress)
    await this.initListeners(dataServer, connectonsManager)
    setInterval(async () => {
      await connectonsManager.storage.sendMessage('someTestChannel', this.createMessage(connectonsManager.peerId.toB58String()))
      console.log('Sent a message')
    }, 10000)
  }
}

const main = async () => {
  const node = new NodeWithData()
  await node.init()
  console.log('after init NodeWithData')
}

main().catch(err => {
  console.log(`Couldn't start NodeWithData: ${err as string}`)
})
