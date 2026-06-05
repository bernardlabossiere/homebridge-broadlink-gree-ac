"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreeACAccessory = void 0;
const broadlink_1 = require("./broadlink");
const ircodes_1 = require("./ircodes");
class GreeACAccessory {
    constructor(platform, acc, cfg) {
        this.platform = platform;
        this.acc = acc;
        this.cfg = cfg;
        this.af = null;
        this.state = { powered: false, mode: 'cool', temperature: 21, fan: 'auto' };
        this.preAF = null;
        this.afActive = false;
        const C = platform.Characteristic, S = platform.Service;
        this.afTemp = cfg.antiFrostTemperature ?? 8;
        this.ir = new ircodes_1.IRCodeManager(cfg.irCodesFile);
        this.minT = cfg.minTemperature ?? this.ir.minTemp;
        this.maxT = cfg.maxTemperature ?? this.ir.maxTemp;
        this.state.temperature = Math.round((this.minT + this.maxT) / 2);
        this.rm = new broadlink_1.BroadlinkRM(cfg.host, cfg.mac ? Buffer.from(cfg.mac.replace(/[:-]/g, ''), 'hex') : null, cfg.devtype ?? 0x6026, platform.log);
        this.hc = acc.getService(S.HeaterCooler) || acc.addService(S.HeaterCooler, cfg.name);
        this.hc.getCharacteristic(C.Active).onGet(() => this.state.powered ? C.Active.ACTIVE : C.Active.INACTIVE).onSet(v => this.setActive(v));
        this.hc.getCharacteristic(C.CurrentHeaterCoolerState).onGet(() => {
            if (!this.state.powered)
                return C.CurrentHeaterCoolerState.INACTIVE;
            if (this.state.mode === 'heat')
                return C.CurrentHeaterCoolerState.HEATING;
            if (this.state.mode === 'cool')
                return C.CurrentHeaterCoolerState.COOLING;
            return C.CurrentHeaterCoolerState.IDLE;
        });
        this.hc.getCharacteristic(C.TargetHeaterCoolerState).setProps({ validValues: [1, 2] })
            .onGet(() => { if (this.state.mode === 'heat')
            return C.TargetHeaterCoolerState.HEAT; if (this.state.mode === 'cool')
            return C.TargetHeaterCoolerState.COOL; return C.TargetHeaterCoolerState.AUTO; })
            .onSet(v => this.setMode(v));
        this.hc.getCharacteristic(C.CurrentTemperature).onGet(() => this.afActive ? this.afTemp : this.state.temperature);
        this.hc.getCharacteristic(C.HeatingThresholdTemperature).setProps({ minValue: this.minT, maxValue: this.maxT, minStep: 1 }).onGet(() => this.afActive ? this.afTemp : this.state.temperature).onSet(v => this.setTemp(v));
        this.hc.getCharacteristic(C.CoolingThresholdTemperature).setProps({ minValue: this.minT, maxValue: this.maxT, minStep: 1 }).onGet(() => this.afActive ? this.afTemp : this.state.temperature).onSet(v => this.setTemp(v));
        this.hc.getCharacteristic(C.RotationSpeed).setProps({ minValue: 0, maxValue: 100, minStep: 25 }).onGet(() => this.f2p(this.state.fan)).onSet(v => this.setFan(v));
        if (cfg.antiFrostSwitch !== false) {
            const suf = cfg.antiFrostNameSuffix ?? 'anti-frost';
            const nm = `${cfg.name} ${suf}`;
            this.af = acc.services.find(s => s.subtype === 'antifrost') ?? acc.addService(S.Switch, nm, 'antifrost');
            this.af.getCharacteristic(C.On).onGet(() => this.afActive).onSet(v => this.setAF(v));
            platform.log.info(`[${cfg.name}] Anti-frost service added`);
        }
    }
    async setActive(v) {
        const C = this.platform.Characteristic;
        if (v === C.Active.INACTIVE) {
            this.state.powered = false;
            await this.sendOff();
        }
        else {
            this.state.powered = true;
            await this.sendNow();
        }
        this.hc.updateCharacteristic(C.CurrentHeaterCoolerState, !this.state.powered ? C.CurrentHeaterCoolerState.INACTIVE : this.state.mode === 'heat' ? C.CurrentHeaterCoolerState.HEATING : C.CurrentHeaterCoolerState.COOLING);
    }
    async setMode(v) {
        const C = this.platform.Characteristic;
        this.state.mode = v === C.TargetHeaterCoolerState.HEAT ? 'heat' : v === C.TargetHeaterCoolerState.COOL ? 'cool' : 'heat_cool';
        if (this.state.powered)
            await this.sendNow();
        this.hc.updateCharacteristic(C.CurrentHeaterCoolerState, this.state.mode === 'heat' ? C.CurrentHeaterCoolerState.HEATING : C.CurrentHeaterCoolerState.COOLING);
    }
    async setTemp(v) {
        this.state.temperature = Math.round(v);
        if (this.state.powered && !this.afActive)
            await this.sendNow();
        this.hc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.state.temperature);
    }
    async setFan(p) { this.state.fan = this.p2f(p); if (this.state.powered && !this.afActive)
        await this.sendNow(); }
    async setAF(on) {
        const C = this.platform.Characteristic;
        if (on) {
            this.preAF = { ...this.state };
            this.afActive = true;
            if (!this.state.powered)
                this.platform.log.info(`[${this.cfg.name}] Anti-frost: device OFF, powering on HEAT 21°C first`);
            this.state = { powered: true, mode: 'heat', temperature: this.afTemp, fan: 'auto' };
            await this.sendNow();
            this.platform.log.info(`[${this.cfg.name}] Anti-frost ON -> ${this.afTemp}°C`);
            this.hc.updateCharacteristic(C.Active, C.Active.ACTIVE);
            this.hc.updateCharacteristic(C.CurrentHeaterCoolerState, C.CurrentHeaterCoolerState.HEATING);
            this.hc.updateCharacteristic(C.HeatingThresholdTemperature, this.afTemp);
            this.hc.updateCharacteristic(C.CurrentTemperature, this.afTemp);
        }
        else {
            this.afActive = false;
            if (this.preAF) {
                const wasOff = !this.preAF.powered;
                this.state = { ...this.preAF };
                this.preAF = null;
                if (wasOff) {
                    await this.sendOff();
                    this.platform.log.info(`[${this.cfg.name}] Anti-frost OFF -> device was OFF, turning off`);
                    this.hc.updateCharacteristic(C.Active, C.Active.INACTIVE);
                    this.hc.updateCharacteristic(C.CurrentHeaterCoolerState, C.CurrentHeaterCoolerState.INACTIVE);
                }
                else {
                    await this.sendNow();
                    this.platform.log.info(`[${this.cfg.name}] Anti-frost OFF -> restore ${this.state.temperature}°C`);
                    this.hc.updateCharacteristic(C.HeatingThresholdTemperature, this.state.temperature);
                    this.hc.updateCharacteristic(C.CurrentTemperature, this.state.temperature);
                }
            }
        }
    }
    async sendOff() { try {
        await this.rm.sendData(this.ir.offCode());
        this.platform.log.debug(`[${this.cfg.name}] Sent OFF`);
    }
    catch (e) {
        this.platform.log.error(`[${this.cfg.name}] OFF failed: ${e}`);
    } }
    async sendNow() { const c = this.ir.code(this.state.mode, this.state.fan, this.state.temperature); if (!c) {
        this.platform.log.warn(`[${this.cfg.name}] No code for ${this.state.mode}/${this.state.fan}/${this.state.temperature}°C`);
        return;
    } try {
        await this.rm.sendData(c);
        this.platform.log.debug(`[${this.cfg.name}] Sent ${this.state.mode}/${this.state.fan}/${this.state.temperature}°C`);
    }
    catch (e) {
        this.platform.log.error(`[${this.cfg.name}] Send failed: ${e}`);
    } }
    f2p(f) { return { low: 25, mid: 50, high: 75, auto: 100 }[f] ?? 100; }
    p2f(p) { if (p <= 25)
        return 'low'; if (p <= 50)
        return 'mid'; if (p <= 75)
        return 'high'; return 'auto'; }
}
exports.GreeACAccessory = GreeACAccessory;
