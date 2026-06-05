"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadlinkGreeACPlatform = void 0;
const settings_1 = require("./settings");
const accessory_1 = require("./accessory");
class BroadlinkGreeACPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.accessories = [];
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.api.on('didFinishLaunching', () => this.discover());
    }
    configureAccessory(a) { this.accessories.push(a); }
    discover() {
        for (const dev of (this.config.devices ?? [])) {
            const uuid = this.api.hap.uuid.generate(dev.host + dev.mac);
            let acc = this.accessories.find(a => a.UUID === uuid);
            if (!acc) {
                acc = new this.api.platformAccessory(dev.name, uuid);
                this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [acc]);
                this.log.info('New accessory: ' + dev.name);
            }
            acc.context.device = dev;
            new accessory_1.GreeACAccessory(this, acc, dev);
        }
    }
}
exports.BroadlinkGreeACPlatform = BroadlinkGreeACPlatform;
