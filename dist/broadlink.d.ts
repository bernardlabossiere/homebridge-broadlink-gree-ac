import { Logger } from 'homebridge';
export declare class BroadlinkRM {
    private readonly host;
    private mac;
    private devtype;
    private readonly log;
    private key;
    private iv;
    private id;
    private count;
    private authenticated;
    constructor(host: string, mac: Buffer | null, devtype: number | undefined, log: Logger);
    private pad;
    private encrypt;
    private decrypt;
    private cs;
    private build;
    private tx;
    auth(): Promise<void>;
    getTemperature(): Promise<number | null>;
    sendData(code: Buffer): Promise<void>;
}
