export interface GreeACDeviceConfig {
  name: string;
  host: string;
  mac: string;
  devtype?: number;
  irCodesFile: string;
  minTemperature?: number;
  maxTemperature?: number;
  antiFrostSwitch?: boolean;
  antiFrostTemperature?: number;
  antiFrostNameSuffix?: string;
}
export interface BroadlinkGreeACConfig {
  name: string;
  devices: GreeACDeviceConfig[];
}
