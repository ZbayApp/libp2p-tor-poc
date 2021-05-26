import Libp2p from 'libp2p'
import { SocksProxyAgent } from 'socks-proxy-agent'
import Mplex from 'libp2p-mplex'
import { NOISE } from 'libp2p-noise'
import KademliaDHT from 'libp2p-kad-dht'
import Gossipsub from 'libp2p-gossipsub'
import PeerId from 'peer-id'
import WebsocketsOverTor from './websocketOverTor'
import Multiaddr from 'multiaddr'
import Bootstrap from 'libp2p-bootstrap'
import multihashing from 'multihashing-async'
import { Storage } from '../storage'
import { createPaths, fetchAbsolute } from '../utils'
import { ZBAY_DIR_PATH } from '../constants'
import fs from 'fs'
import path from 'path'
import { IChannelInfo } from '../storage/storage'
import fetch from 'node-fetch';
import debug from 'debug'
const log = Object.assign(debug('waggle:libp2p'), {
  error: debug('waggle:libp2p:err')
})

interface IOptions {
  env?: {
    appDataPath: string
  },
  bootstrapMultiaddrs?: Array<string>
}
interface IConstructor {
  host: string
  port: number
  agentPort: number
  agentHost: string
  options?: IOptions
  io: any
}
interface IBasicMessage {
  id: string
  type: number
  signature: string
  createdAt: number
  r: number
  message: string
  typeIndicator: number
}

interface ILibp2pStatus {
  address: string
  peerId: string
}

export class ConnectionsManager {
  host: string
  port: number
  agentHost: string
  agentPort: number
  socksProxyAgent: any
  libp2p: null | Libp2p
  localAddress: string | null
  storage: Storage
  options: IOptions
  zbayDir: string
  io: any
  peerId: PeerId
  bootstrapMultiaddrs: Array<string>
  trackerApi: any

  constructor({ host, port, agentHost, agentPort, options, io }: IConstructor) {
    this.host = host
    this.port = port
    this.io = io
    this.agentPort = agentPort
    this.agentHost = agentHost
    this.localAddress = null
    this.options = options
    this.zbayDir = options?.env?.appDataPath || ZBAY_DIR_PATH
    this.storage = new Storage(this.zbayDir, this.io)
    this.peerId = null
    this.bootstrapMultiaddrs = options?.bootstrapMultiaddrs || this.defaultBootstrapMultiaddrs()
    this.trackerApi = fetchAbsolute(fetch)('http://okmlac2qjgo2577dkyhpisceua2phwxhdybw4pssortdop6ddycntsyd.onion:7788')

    process.on('unhandledRejection', error => {
      console.error(error)
      throw error
    })
    process.on('SIGINT', function() {
      console.log('\nGracefully shutting down from SIGINT (Ctrl-C)')
      process.exit(0)
    })
  }

  private readonly createAgent = () => {
    this.socksProxyAgent = new SocksProxyAgent({ port: this.agentPort, host: this.agentHost })
  }

  private readonly defaultBootstrapMultiaddrs = () => {
    return [
      '/dns4/2lmfmbj4ql56d55lmv7cdrhdlhls62xa4p6lzy6kymxuzjlny3vnwyqd.onion/tcp/7788/ws/p2p/Qmak8HeMad8X1HGBmz2QmHfiidvGnhu6w6ugMKtx8TFc85',
    ]
  }

  private readonly getPeerId = async (): Promise<PeerId> => {
    let peerId
    const peerIdKeyPath = path.join(this.zbayDir, 'peerIdKey')
    if (!fs.existsSync(peerIdKeyPath)) {
      createPaths([this.zbayDir])
      peerId = await PeerId.create()
      fs.writeFileSync(peerIdKeyPath, peerId.toJSON().privKey)
    } else {
      const peerIdKey = fs.readFileSync(peerIdKeyPath, { encoding: 'utf8' })
      peerId = PeerId.createFromPrivKey(peerIdKey)
    }
    return peerId
  }

  private readonly getInitialPeers = async (): Promise<string[]> => {
    const options = {
      method: 'GET',
      agent: () => {
        return this.socksProxyAgent
      }
    }
    const response = await this.trackerApi('/peers', options)
    return response.json()
  }

  private readonly registerPeer = async (address: string): Promise<void> => {
    const options = {
      method: 'POST',
      body: JSON.stringify({ address: address }),
      headers: { 'Content-Type': 'application/json' },
      agent: () => {
        return this.socksProxyAgent
      }
    }
    await this.trackerApi('/register', options)
  }

  public initializeNode = async (staticPeerId?: PeerId): Promise<ILibp2pStatus> => {
    if (!staticPeerId) {
      this.peerId = await this.getPeerId()
    } else {
      this.peerId = staticPeerId
    }
    this.createAgent()

    const listenAddrs = [`/dns4/${this.host}/tcp/${this.port}/ws`]
    this.localAddress = `${listenAddrs}/p2p/${this.peerId.toB58String()}`
    console.log('local address:', this.localAddress)
    console.log('bootstrapMultiaddrs:', this.bootstrapMultiaddrs)

    this.libp2p = await this.createBootstrapNode({
      peerId: this.peerId,
      listenAddrs,
      agent: this.socksProxyAgent,
      localAddr: this.localAddress,
      bootstrapMultiaddrsList: this.bootstrapMultiaddrs
    })
    this.libp2p.connectionManager.on('peer:connect', async connection => {
      log('Connected to', connection.remotePeer.toB58String())
    })
    this.libp2p.on('peer:discovery', (peer: PeerId) => {
      console.count(`Discovered ${peer.toB58String()}`)
      // this.removeInactivePeer(peer)
    })
    this.libp2p.connectionManager.on('peer:disconnect', connection => {
      log('Disconnected from', connection.remotePeer.toB58String())
      // this.removeInactivePeer(connection.remotePeer)
    })

    return {
      address: this.localAddress,
      peerId: this.peerId.toB58String()
    }
  }

  public subscribeForTopic = async (channelData: IChannelInfo) => {
    await this.storage.subscribeForChannel(channelData.address, channelData)
  }

  public initStorage = async () => {
    await this.storage.init(this.libp2p, this.peerId)
  }

  public updateChannels = async () => {
    await this.storage.updateChannels()
  }

  public loadAllMessages = (channelAddress: string) => {
    this.storage.loadAllChannelMessages(channelAddress)
  }

  public connectToNetwork = async (target: string) => {
    log(`Attempting to dial ${target}`)
    await this.libp2p.dial(target, {
      localAddr: this.localAddress,
      remoteAddr: new Multiaddr(target)
    })
  }

  private removeInactivePeer = (peer: PeerId) => {    
    this.libp2p.dial(peer).then((value) => {
      if (value === undefined) {
        const removed = this.libp2p.peerStore.delete(peer)
        if (removed) {
          console.count(`Removed peer ${peer.toB58String()}`)
        }
      } else {
        console.count(`Dialed peer ${peer.toB58String()}`)
      }
    })
  }

  public createOnionPeerId = async (peerId: string) => {
    const key = new TextEncoder().encode(`onion${peerId.substring(0, 10)}`)
    const digest = await multihashing(key, 'sha2-256')
    return digest
  }

  public sendMessage = async (
    channelAddress: string,
    messagePayload: IBasicMessage
  ): Promise<void> => {
    const { id, type, signature, r, createdAt, message, typeIndicator } = messagePayload
    const messageToSend = {
      id,
      type,
      signature,
      createdAt,
      r,
      message,
      typeIndicator,
      channelId: channelAddress
    }
    await this.storage.sendMessage(channelAddress, messageToSend)
  }

  public initializeData = async () => {
    await this.storage.loadInitChannels()
  }

  // DMs

  public addUser = async (
    publicKey: string,
    halfKey: string
  ): Promise<void> => {
    log(`CONNECTIONS MANAGER: addUser - publicKey ${publicKey} and halfKey ${halfKey}`)
    await this.storage.addUser(publicKey, halfKey)
  }

  public initializeConversation = async (
    address: string,
    encryptedPhrase: string
  ): Promise<void> => {
    log(`INSIDE WAGGLE: ${encryptedPhrase}`)
    await this.storage.initializeConversation(address, encryptedPhrase)
  }

  public getAvailableUsers = async (): Promise<void> => {
    await this.storage.getAvailableUsers()
  }

  public getPrivateConversations = async (): Promise<void> => {
    await this.storage.getPrivateConversations()
  }

  public sendDirectMessage = async (
    channelAddress: string,
    messagePayload: IBasicMessage
  ): Promise<void> => {
    const { id, type, signature, r, createdAt, message, typeIndicator } = messagePayload
    const messageToSend = {
      id,
      type,
      signature,
      createdAt,
      r,
      message,
      typeIndicator,
      channelId: channelAddress
    }
    await this.storage.sendDirectMessage(channelAddress, messagePayload)
  }

  public subscribeForDirectMessageThread = async (address): Promise<void> => {
    await this.storage.subscribeForDirectMessageThread(address)
  }

  public subscribeForAllConversations = async (conversations: string[]) :Promise<void> => {
    await this.storage.subscribeForAllConversations(conversations)
  }

  private readonly createBootstrapNode = async ({
    peerId,
    listenAddrs,
    agent,
    localAddr,
    bootstrapMultiaddrsList
  }): Promise<Libp2p> => {
    return Libp2p.create({
      peerId,
      addresses: {
        listen: listenAddrs
      },
      modules: {
        transport: [WebsocketsOverTor],
        peerDiscovery: [Bootstrap],
        streamMuxer: [Mplex],
        connEncryption: [NOISE],
        dht: KademliaDHT,
        pubsub: Gossipsub
      },
      config: {
        peerDiscovery: {
          [Bootstrap.tag]: {
            enabled: true,
            list: bootstrapMultiaddrsList // provide array of multiaddrs
          },
          autoDial: true
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: false
          }
        },
        dht: {
          enabled: true,
          randomWalk: {
            enabled: true
          }
        },
        transport: {
          WebsocketsOverTor: {
            websocket: {
              agent
            },
            localAddr
          }
        }
      }
    })
  }
}
