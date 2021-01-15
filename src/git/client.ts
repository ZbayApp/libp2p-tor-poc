import * as fse from 'fs-extra'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { assert } from 'console'
import { ChannelMessage } from './message'

import { 
  Repository, ProxyOptions, 
  RemoteCallbacks, Reference, 
  Signature, FetchOptions, Cred
} from 'nodegit'

export class ChannelRepository {
  private basedir: string;
  private repoObject: Repository;
  private proxySettings: ProxyOptions;

  private constructor(repoObject: Repository, basepath: string, proxySettings: ProxyOptions) {
    assert(basepath !== null);
    assert(repoObject !== null);
    assert(proxySettings !== null);
    this.basedir = basepath;
    this.repoObject = repoObject;
    this.proxySettings = proxySettings;
  }

  public name() : string { 
    return path.basename(this.basedir); 
  }

  public static async open(basepath: string, proxySettings: ProxyOptions) : Promise<ChannelRepository> {
    return new ChannelRepository(
      await Repository.open(
        path.resolve(basepath, '.git')), 
      basepath, proxySettings);
  }

  public static async create(basepath: string, proxySettings: ProxyOptions) : Promise<ChannelRepository> {
    const IsBareRepository : number = 0;
    await fse.ensureDir(basepath);

    return new ChannelRepository(
      await Repository.init(
        basepath, IsBareRepository), 
      basepath, proxySettings);
  }

  /**
   * Returns the hash of the change that the local repository considers
   * as most recent. It doesn't nesessarily mean that it is the globally
   * known top of the tree. 
   */
  public async topOfTree() : Promise<string> { 
    try {
      const headCommit = await Reference.nameToId(this.repoObject, 'HEAD');
      if (headCommit === null || headCommit.isZero()) {
        return null;
      } else {
        return headCommit.tostrS();
      }
    } catch {
      // empty repo, no history yet
      return null;
    }
  }

  /**
   * Appends a new message to the git history, by storing it
   * as a file in the channel directory and creating a new commit
   * for it. On successfull save this method returns the newly
   * created commit id, which is also the new TopOfTree commitid.
   * 
   * @param message The new message to be appended to history
   */
  public async appendMessage(message: ChannelMessage) : Promise<string> {
    assert(message !== null);
    assert(message.id !== null);
    assert(message.content !== null);

    const messagePath = path.join(this.basedir, message.id);
    
    await fs.writeFile(messagePath, ChannelMessage.encode(message).finish());
    await fs.utimes(messagePath, message.timestamp, message.timestamp);
    
    const repoIndex = await this.repoObject.refreshIndex();
    await repoIndex.addByPath(message.id);
    await repoIndex.write();
    
    const author = Signature.now('Zbay', 'zbay@unknown.world');
    const committer = Signature.now('Zbay', 'zbay@unknown.world');
    const maybeParent = await this.topOfTree()

    const commit = await this.repoObject.createCommitOnHead(
      [message.id], author, committer, 
      `messageId: ${message.id}, parentId: ${maybeParent}`);

    return commit.tostrS();
  }

  /**
   * Iterates over all historical messages in a given order, returnning a new 
   * message on each step.
   * 
   * The basis for ordering messages is ther commit timestamp and commit order.
   * 
   * @param oldestFirst if set to true messages will be returned in an ascending timestamp order otherwise
   * newest messages will be returned first.
   */
  public async* enumerateMessages(oldestFirst: boolean = false) {
    var masterCommit = await this.repoObject.getMasterCommit();
    if (masterCommit !== null) {
      const historySize = masterCommit.parentcount();

      if (oldestFirst) { // oldest to newest
        for (let i = historySize - 1; i >= 0; --i) {
          yield masterCommit.parent(i);
        }
        yield masterCommit;
      } else { // newest to oldest
        yield masterCommit;
        for (let i = 0; i < historySize; ++i) {
          yield masterCommit.parent(i);
        }
      }
    }
  }

  public async synchronize(onionAddress: string) : Promise<number> { 
    const mergeTimestamp = Date.now();
    const remoteUrl = `git://${onionAddress}/${this.name()}/`;
    await this.repoObject.fetchAll(<FetchOptions> {
      callbacks: <RemoteCallbacks> {
        credentials: (url, username) => {
          console.log('credentials callback', url, username);
          return Cred.sshKeyFromAgent(username);
        },
        certificateCheck: () => 0
      },
      proxyOpts: this.proxySettings
    })
    const commitid = await this.repoObject.mergeBranches('master', 'origin/master');
    return commitid.tostrS(); 
  }
}

type ReposMap = Map<string, Repository>

/**
 * This type is reponsible for maintaining a consistentn channel history across
 * all peers of a channel. It uses GIT as the versioning mechanism and raw files
 * as the storage medium.
 */
export class GitHistoryClient {
  /**
   * Maps channelIds to repo instances.
   * 
   * Since each channel has its own repo and history, we use this 
   * structure to keep track of all known channels.
   */
  private reposMap: ReposMap;

  /**
   * This is the SOCKS5 proxy config object that routes traffic 
   * through TOR network.
   */
  private proxySettings: ProxyOptions;

  /**
   * This is the root directory where all channels have their repos stored.
   * TODO: make this path configuratble through a separate config 
   * TODO: object that default to the current user home directory.
   */
  private basedir: string = `${os.homedir()}/ZBayChannels/`;

  private constructor(proxySettings: ProxyOptions) {
    assert(proxySettings !== null);
    this.proxySettings = proxySettings;
    this.reposMap = new Map<string, Repository>();
  }
  
  /**
   * Initializes the Git-based history store. It's composed of two mechanisms:
   * 
   *  - a git daemon that exposes the local repo to other peers, so they can fetch our state of history
   *  - a local git repository that store the local state of history state.
   * 
   * by default all channels are stored in $HOME/ZbayChannels with each channel having
   * its own separate directory and a distinct git repo.
   */
  public static async open(proxySettings: ProxyOptions): Promise<GitHistoryClient> { 
    let store = new GitHistoryClient(proxySettings);
    await fse.ensureDir(store.basedir);
    for await (const repo of store.enumerateRepositories()) {
      store.reposMap.set(repo.name(), repo);
    }
    return store; 
  }

  /**
   * True if we the store is aware of a given channel, otherwise false.
   * 
   * @param channelName the channel uniqueId as known to the user
   */
  public channelExists(channelName: string) : boolean {
    return this.reposMap.has(channelName);
  }

  /**
   * Creates a new channel store for a non-existing channel.
   * 
   * If the channel already exists, this function will throw and
   * leave the object is a valid state.
   */
  public async createChannel(channelName: string) : Promise<ChannelRepository> {
    assert(channelName !== null);

    if (this.channelExists(channelName)) {
      throw new Error(`channel ${channelName} already exists`);
    }

    // create a new repo and track it in the repos map
    const repo = await ChannelRepository.create(
      path.join(this.basedir, channelName), 
      this.proxySettings);
    this.reposMap.set(repo.name(), repo);
    return repo;
  }

  public async removeChannel(channel: string | ChannelRepository) : Promise<void> {
    let channelName: string;
    if (typeof channel === 'string') {
      channelName = channel;
    } else if (channel instanceof ChannelRepository) {
      channelName = channel.name();
    }

    if (!this.channelExists(channelName)) {
      throw new Error(`channel ${channelName} does not exist`);
    }
    
    await fse.remove(
      this.reposMap.get(channelName).basedir);
    this.reposMap.delete(channelName);
  }

  private async* enumerateRepositories() {
    for (const direntry of await fs.readdir(this.basedir)) {
      const channelBasedir = path.join(this.basedir, direntry);
      if ((await fs.stat(channelBasedir)).isDirectory()) {
        yield ChannelRepository.open(channelBasedir, this.proxySettings);
      }
    }
  }
}
