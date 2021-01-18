import {
  GitHistoryClient,
  ChannelMessage } from './git'

const main = async () => {
  console.log('opening git history store')
  const gitStore = await GitHistoryClient.open(null)
  console.log(gitStore)

  console.log('creating new channel')
  const newChannel = await gitStore.createChannel('testChannel1')
  console.log(newChannel)
  console.log(gitStore)

  for (let i = 0; i < 100; ++i) {
    const message = new ChannelMessage({
      id: `message-${i}`,
      timestamp: Date.now(),
      content: Buffer.from(`this is a test message number ${i}`),
      signature: `some-signature-${i}`
    })
  
    const commit = await newChannel.appendMessage(message)
    console.log(`appending message ${i}: `, commit)
  }

  const channelToT = await newChannel.topOfTree()
  console.log('channel tot: ', channelToT)

  console.log('enumerating history newestToOldest')
  for await (const commit of newChannel.enumerateMessages()) {
    console.log('hisorical commit (g): ', commit)
  }

  console.log('enumerating history oldestToNewest')
  for await (const commit of newChannel.enumerateMessages()) {
    console.log('hisorical commit (g): ', commit)
  }
  
  // console.log('deleting channel')
  // await gitStore.removeChannel(newChannel)
  // console.log(gitStore)

  // const server = new GitHistoryServer();
}

main()
