/* tslint:disable */
import * as path from 'path'
import * as os from 'os'
import PeerId from 'peer-id'
import * as fs from 'fs'
import { Tor } from './index'
import { ConnectionsManager } from './connectionsManager'
import { sleep } from './sleep'
// import { sleep } from './sleep'

const main = async () => {
  const torPath = `${process.cwd()}/tor/tor`
  const settingsPath = `${process.cwd()}/tor/torrc`
  const pathDevLib = path.join.apply(null, [process.cwd(), 'tor'])
  console.log(settingsPath, 'path')
  const tor = new Tor({ torPath, settingsPath, options: {
    env: {
      LD_LIBRARY_PATH: pathDevLib,
      HOME: os.homedir()
    }
  } })
  await tor.init()
  await tor.addService({ port: 7756 })
  // await tor.addService({ port: 7756 })
  // await tor.addService({ port: 7757 })
  const address1 = tor.getServiceAddress(7756)
  // const address2 = tor.getServiceAddress(7756)
  // const address3 = tor.getServiceAddress(7757)
  // await tor.addService({ port: 7756 })
  // await tor.addService({ port: 7757 })
  // const address4 = tor.getServiceAddress(7758)
  // try 
  //   // await tor.addService({ port: 7755 })
  //   // await tor.addService({ port: 7756 },
  // await tor.addService({ port: 7758 })
  // address = tor.getServiceAddress(7757)
  //   console.log('address', address)
  // } catch (e) {
  //   console.log('no default service')
  // }
  const startLibp2p = async (add1) => {
    const peerId1 = fs.readFileSync('peerId1.json')
    const peerId2 = fs.readFileSync('peerId2.json')
    const parsedId1 = JSON.parse(peerId1.toString()) as PeerId.JSONPeerId
    const parsedId2 = JSON.parse(peerId2.toString()) as PeerId.JSONPeerId
    const peerId1Restored = await PeerId.createFromJSON(parsedId1)
    const peerId2Restored = await PeerId.createFromJSON(parsedId2)
    // console.log('nodetest', node2.address)

    const connectionsManager1 = new ConnectionsManager({ port: 7756, host: add1, agentHost: 'localhost', agentPort: 9050 })
    const node1 = await connectionsManager1.initializeNode()
    await connectionsManager1.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
    console.log('nodetest', node1.address)
    console.log('sleeping')
    await sleep(1 * 60000)
    console.log('start sending')
    connectionsManager1.startSendingMessages('test-address', node1.peerId)

    // const connectionsManager2 = new ConnectionsManager({ port: 7756, host: add2, agentHost: 'localhost', agentPort: 9050 })
    // const node2 = await connectionsManager2.initializeNode(peerId2Restored)
    // await connectionsManager2.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
    // await sleep(20000)
    // connectionsManager2.startSendingMessages('test-address', node2.peerId)
    // console.log('nodetest', node2.address)

    // const connectionsManager3 = new ConnectionsManager({ port: 7757, host: add3, agentHost: 'localhost', agentPort: 9050 })
    // const node3 = await connectionsManager3.initializeNode()
    // await connectionsManager3.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
    // // await connectionsManager3.connectToNetwork(node1.address)
    // console.log('nodetest', node3.address)

    // await sleep(10000)

    // const connectionsManager4 = new ConnectionsManager({ port: 7758, host: add4, agentHost: 'localhost', agentPort: 9050 })
    // const node4 = await connectionsManager4.initializeNode()
    // await connectionsManager4.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
    // await connectionsManager4.connectToNetwork(node2.address)
    // console.log('nodetest', node4.address)
    // await connectionsManager.connectToNetwork('/dns4/z33bvb7dtxivj7ymovqunfjrubxgrdtcqtmdeuaewmjo2wtwl7o5i5qd.onion/tcp/7755/ws/p2p/QmPqQsac5onf8mfGr3QbGsHYEUyGApanMmCHpLovFh8kq1')
    // await connectionsManager.listenForInput('test-address')
  }

  // await startLibp2p(address)
  // if (address) {
  //   await startLibp2p(address)
  // } else {
  //   const { address: newOnionAddress } = await tor.addService({ port: 7755 })
  //   await startLibp2p(newOnionAddress)
  // }
  await startLibp2p(address1)
  // const connectionsManager = new ConnectionsManager({ port, host: address, agentHost: 'localhost', agentPort: 9050 })
  // const { port, address } = await tor.addService({ port: 7755 })
  // const connectionsManager = new ConnectionsManager({ port, host: address, agentHost: 'localhost', agentPort: 9050 })
  // const node = await connectionsManager.initializeNode()
  // console.log('nodetest', node.address)
  // await connectionsManager.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
  // await connectionsManager.connectToNetwork('/dns4/4ko6lemjgq5xligdnytwxpmu2qx3mk5rbjqlarew6p33sllehjkfjxid.onion/tcp/7757/ws/p2p/QmQZnapdXBPw2A6J4Gji1J5h5yVUwDNcs2sypgYWu6sAPq')
  // await connectionsManager.listenForInput('test-address')
  // await tor.killService({ port: 7756 })
  // await tor.killService({ port: 7757 })
  // const { port, address } = await tor.addService({ port: 7755 })
  // const connectionsManager = new ConnectionsManager({ port, host: address, agentHost: 'localhost', agentPort: 9050 })
  // const node = await connectionsManager.initializeNode()
  // console.log('nodetest', node.address)
  // await connectionsManager.subscribeForTopic({topic: '/libp2p/example/chat/1.0.0', channelAddress: 'test-address' })
  // await connectionsManager.connectToNetwork('/dns4/hkzdoy3s62qqnrmhf4cyed25ty2hxlojmenxemaj2thidgwlfcoexyid.onion/tcp/7755/ws/p2p/QmTWVfrJLxXTbqBazwrFexMfh8VSQE2iv2tfhcAy7xWyfK')
  // await connectionsManager.listenForInput('test-address')
  // // console.log(tor.getServiceAddress(8888))
  // await tor.killService({ port: 8888 })
  // await tor.kill()
}
main()