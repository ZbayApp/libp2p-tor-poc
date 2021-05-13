import path from "path";
import os from 'os'

export enum Config {
    ZBAY_DIR = '.zbay'
}

export const ZBAY_DIR_PATH = path.join(os.homedir(), Config.ZBAY_DIR)
export const ZBAY_DIR_PATH_TEST = path.join(os.homedir(), '.zbay_test')
