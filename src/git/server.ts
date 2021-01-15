import * as fse from 'fs-extra'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { parentPort, workerData } from 'worker_threads'

const GitServer = require('node-git-server');

export class GitHistoryServer {
  private port: number = 5002;
  private basedir: string = `${os.homedir()}/ZBayChannels/`;
  private repos = new GitServer(this.basedir);

  constructor() {
    this.repos.on('fetch', fetch => {
      console.log(`fetch ${fetch.commit}`);
      fetch.accept();
    });

    this.repos.on('push', (push) => {
      console.log(`push ${push.repo}/${push.commit} (${push.branch})`);
      push.accept();
    });
  }

  start() {
    this.repos.listen(this.port, () => {
      console.log(`node-git-server running at http://localhost:${this.port}`)
    });
  }
}

//const server = new GitHistoryServer();
//server.start();