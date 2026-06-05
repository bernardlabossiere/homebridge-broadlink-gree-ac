import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { GreeACAccessory } from './accessory';
import { BroadlinkGreeACConfig, GreeACDeviceConfig } from './config';

export class BroadlinkGreeACPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  private readonly accessories: PlatformAccessory[] = [];

  constructor(public readonly log:Logger, public readonly config:PlatformConfig&BroadlinkGreeACConfig, public readonly api:API){
    this.Service=api.hap.Service; this.Characteristic=api.hap.Characteristic;
    this.api.on('didFinishLaunching',()=>this.discover());
  }
  configureAccessory(a:PlatformAccessory){ this.accessories.push(a); }
  private discover(){
    for(const dev of (this.config.devices??[])){
      const uuid=this.api.hap.uuid.generate(dev.host+dev.mac);
      let acc=this.accessories.find(a=>a.UUID===uuid);
      if(!acc){ acc=new this.api.platformAccessory(dev.name,uuid); this.api.registerPlatformAccessories(PLUGIN_NAME,PLATFORM_NAME,[acc]); this.log.info('New accessory: '+dev.name); }
      acc.context.device=dev;
      new GreeACAccessory(this,acc,dev);
    }
  }
}
