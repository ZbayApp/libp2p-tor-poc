import { GitHistoryStore } from './git'

const main = async () => {
  const gitStore = await GitHistoryStore.open(null)
  console.log(gitStore)
}

main()
