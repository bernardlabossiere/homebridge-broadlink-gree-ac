import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { BroadlinkGreeACConfig } from './config';
export declare class BroadlinkGreeACPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig & BroadlinkGreeACConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    private readonly accessories;
    constructor(log: Logger, config: PlatformConfig & BroadlinkGreeACConfig, api: API);
    configureAccessory(a: PlatformAccessory): void;
    private discover;
}
