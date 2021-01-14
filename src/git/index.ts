import * as fse from 'fs-extra'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { assert } from 'console';
import { Repository, ProxyOptions } from 'nodegit'

export class Message {
  timestamp: number;
  message: string;
  signature: string;
}

export class ChannelRepository {
  basedir: string;
  parentId: string | null;
  repoObject: Repository;

  private constructor(repoObject: Repository, basepath: string) {
    assert(basepath != null);
    assert(repoObject !== null)
    this.basedir = basepath;
    this.repoObject = repoObject;
  }

  public name() : string { 
    return path.basename(this.basedir); 
  }

  public static async open(basepath: string) : Promise<ChannelRepository> {
    console.log('opening channel at basepath ', basepath)
    return new ChannelRepository(
      await Repository.open(
        path.resolve(basepath, '.git')), 
      basepath);
  }

  public static async create(basepath: string) : Promise<ChannelRepository> {
    const IsBareRepository : number = 0;
    await fse.ensureDir(basepath);
    return new ChannelRepository(
      await Repository.init(
        basepath, IsBareRepository),
      basepath);
  }

  // TODO: implement
  public async getCurrentHEAD() : Promise<string> { return null; }
  public async getParentId(id: string): Promise<string> { return null; }
  public async loadAllMessages() : Promise<Message[]> { return null; }
  public async addCommit(
    messageId: string, 
    messagePayload: Buffer, 
    date: number, 
    parentId: string | null) : Promise<void> { return null; }
  public async pullChanges(
    onionAddress: string, 
    mergeTimeFromSource: number | null = null) : Promise<number> { return null; }

}

type ReposMap = Map<string, Repository>

/**
 * This type is reponsible for maintaining a consistentn channel history across
 * all peers of a channel. It uses GIT as the versioning mechanism and raw files
 * as the storage medium.
 */
export class GitHistoryStore {
  /**
   * Maps channelIds to repo instances.
   * 
   * Since each channel has its own repo and history, we use this 
   * structure to keep track of all known channels.
   */
  private _reposMap: ReposMap;

  /**
   * This is the SOCKS5 proxy config object that routes traffic 
   * through TOR network.
   */
  private _proxySettings: ProxyOptions;

  /**
   * This is the root directory where all channels have their repos stored.
   * TODO: make this path configuratble through a separate config 
   * TODO: object that default to the current user home directory.
   */
  private _basedir: string = `${os.homedir()}/ZBayChannels/`;

  private constructor(proxySettings: ProxyOptions) {
    assert(proxySettings !== null);
    this._proxySettings = proxySettings;
    this._reposMap = new Map<string, Repository>();
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
  public static async open(proxySettings: ProxyOptions): Promise<GitHistoryStore> { 
    let store = new GitHistoryStore(proxySettings);
    await fse.ensureDir(store._basedir);
    for await (const repo of store.enumerateRepositories()) {
      store._reposMap.set(repo.name(), repo);
    }
    return store; 
  }

  /**
   * True if we the store is aware of a given channel, otherwise false.
   * 
   * @param channelName the channel uniqueId as known to the user
   */
  public channelExists(channelName: string) : boolean {
    return this._reposMap.has(channelName);
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
      path.join(this._basedir, channelName));
    this._reposMap.set(repo.name(), repo);
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
      this._reposMap.get(channelName).basedir);
    this._reposMap.delete(channelName);
  }

  private async* enumerateRepositories() {
    for (const direntry of await fs.readdir(this._basedir)) {
      const channelBasedir = path.join(this._basedir, direntry);
      if ((await fs.stat(channelBasedir)).isDirectory()) {
        yield ChannelRepository.open(channelBasedir);
      }
    }
  }
}
