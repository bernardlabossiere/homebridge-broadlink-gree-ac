export interface GreeACDeviceConfig {
    name: string;
    host: string;
    mac: string;
    devtype?: number;
    irCodesFile: string;
    temperatureSensor?: boolean;
    minTemperature?: number;
    maxTemperature?: number;
    antiFrostSwitch?: boolean;
    antiFrostTemperature?: number;
    antiFrostNameSuffix?: string;
    antiFrostCode?: string;
}
export interface BroadlinkGreeACConfig {
    name: string;
    devices: GreeACDeviceConfig[];
}
