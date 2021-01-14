import { GitHistoryStore, Message } from './git'

const main = async () => {
  console.log('opening git history store')
  const gitStore = await GitHistoryStore.open(null)
  console.log(gitStore)

  console.log('creating new channel')
  const newChannel = await gitStore.createChannel('testChannel1')
  console.log(newChannel)
  console.log(gitStore)

  const message1 = <Message> {
    id: "message-1",
    timestamp: new Date(Date.now()),
    content: Buffer.from('this is a test message'),
    signature: 'some-signature'
  };

  console.log('appending message 1')
  const commit1 = await newChannel.appendMessage(message1);
  console.log('message1 commit ', commit1);

  const message2 = <Message> {
    id: "message-2",
    timestamp: new Date(Date.now()),
    content: Buffer.from('this is a second test message'),
    signature: 'some-signature-2'
  };

  console.log('appending message 2')
  const commit2 = await newChannel.appendMessage(message2);
  console.log('message2 commit ', commit2);

  const channelToT = await newChannel.topOfTree()
  console.log('channel tot: ', channelToT)

  console.log('enumerating history newestToOldest')
  for await (const commit of newChannel.enumerateMessages()) {
    console.log('hisorical commit (g): ', commit.id().tostrS())
  }

  console.log('enumerating history oldestToNewest')
  for await (const commit of newChannel.enumerateMessages(true)) {
    console.log('hisorical commit (g): ', commit.id().tostrS())
  }
  
  console.log('deleting channel')
  await gitStore.removeChannel(newChannel)
  console.log(gitStore)
}

main()
