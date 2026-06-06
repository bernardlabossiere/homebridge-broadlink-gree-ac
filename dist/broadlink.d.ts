import { Logger } from 'homebridge';
export declare function discoverBroadlink(host: string): Promise<{
    mac: Buffer;
    devtype: number;
}>;
export declare class BroadlinkRM {
    private readonly host;
    private readonly log;
    private key;
    private iv;
    private id;
    private count;
    private authenticated;
    private mac;
    private devtype;
    private sock;
    private resolver;
    private rejecter;
    private timer;
    constructor(host: string, mac: Buffer | null, devtype: number, log: Logger);
    private pad;
    private encrypt;
    private decrypt;
    private cs;
    private build;
    private getSocket;
    private tx;
    auth(): Promise<void>;
    private wrap;
    sendData(code: Buffer): Promise<void>;
    getTemperature(): Promise<number | null>;
}
