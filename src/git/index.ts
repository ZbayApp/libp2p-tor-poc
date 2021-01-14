import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import * as git from 'nodegit'
import { assert } from 'console';

export enum Type { Bare, Standard }
export enum State { Locked, Unlocked }

export class Message {
  timestamp: number;
  message: string;
  signature: string;
}

export class Repository {
  basedir: string;
  repoObject: git.Repository;

  private constructor(repoObject: git.Repository, basepath: string) {
    assert(basepath != null);
    assert(repoObject !== null)
    this.basedir = basepath;
    this.repoObject = repoObject;
  }

  public name() : string { 
    return path.basename(this.basedir); 
  }

  public static async open(basepath: string) : Promise<Repository> {
    return new Repository(
      await git.Repository.open(
        path.resolve(basepath, '.git')), 
      basepath);
  }

  public static async create(basepath: string) : Promise<Repository> {
    return new Repository(
      await git.Repository.open(
        path.resolve(basepath, '.git')), 
      basepath);
  }
}

type ReposMap = Map<string, git.Repository>

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
  private _proxySettings: git.ProxyOptions;

  /**
   * This is the root directory where all channels have their repos stored.
   * TODO: make this path configuratble through a separate config 
   * TODO: object that default to the current user home directory.
   */
  private _basedir: string = `${os.homedir()}/ZBayChannels/`;

  private constructor(proxySettings: git.ProxyOptions) {
    assert(proxySettings !== null);
    this._proxySettings = proxySettings;
    this._reposMap = new Map<string, git.Repository>()
    this.ensurePathsExist([this._basedir]);
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
  public static async open(proxySettings: git.ProxyOptions): Promise<GitHistoryStore> { 
    let store = new GitHistoryStore(proxySettings);
    for await (const repo of store.enumerateRepositories()) {
      store._reposMap.set(repo.name(), repo)
    }
    return store; 
  }


  public async getCurrentHEAD(repoName: string) : Promise<string> { return null; }
  public async createRepository(name: string) : Promise<git.Repository> { return null; }
  public async getParentId(id: string): Promise<string> { return null; }
  public async loadAllMessages(channelId: string) : Promise<[Message]> { return null; }
  
  public async addCommit(
    repoName: string, 
    messageId: string, 
    messagePayload: Buffer, 
    date: number, 
    parentId: string | null) : Promise<void> { return null; }
  
  public async pullChanges(
    onionAddress: string, 
    repoName: string, 
    mergeTimeFromSource: number | null = null) : Promise<number> { return null; }

    
  private async ensurePathsExist(paths: string[]) {
    for (const path of paths) {
      if (!(await fs.stat(path)).isDirectory()) {
        await fs.mkdir(path, { recursive: true });       
      }
    }
  }

  private async* enumerateRepositories() {
    for (const direntry of await fs.readdir(this._basedir)) {
      if ((await fs.stat(direntry)).isDirectory()) {
        yield Repository.open(direntry)
      }
    }
  }
}
