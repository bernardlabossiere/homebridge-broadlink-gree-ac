import { Logger } from 'homebridge';
export declare class BroadlinkRM {
    private readonly host;
    private readonly mac;
    private readonly devtype;
    private readonly log;
    private key;
    private iv;
    private id;
    private count;
    private authenticated;
    constructor(host: string, mac: Buffer, devtype: number | undefined, log: Logger);
    private pad;
    private encrypt;
    private decrypt;
    private cs;
    private build;
    private tx;
    auth(): Promise<void>;
    sendData(code: Buffer): Promise<void>;
}
