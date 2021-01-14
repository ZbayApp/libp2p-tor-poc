import { GitHistoryStore } from './git'

const main = async () => {
  const gitStore = await GitHistoryStore.open(null)
  console.log(gitStore)

  const newChannel = await gitStore.createChannel('testChannel1')
  console.log(newChannel)
  console.log(gitStore)

  await gitStore.removeChannel(newChannel)
  console.log(gitStore)
}

main()
