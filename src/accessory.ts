import { PlatformAccessory, CharacteristicValue, Service } from 'homebridge';
import type { BroadlinkGreeACPlatform } from './platform';
import { BroadlinkRM } from './broadlink';
import { IRCodeManager, FanMode, OperationMode } from './ircodes';
import { GreeACDeviceConfig } from './config';

interface State { powered:boolean; mode:OperationMode; temperature:number; fan:FanMode; }

export class GreeACAccessory {
  private hc!: Service;
  private af: Service|null = null;
  private readonly rm: BroadlinkRM;
  private readonly ir: IRCodeManager;
  private state: State = {powered:false,mode:'cool',temperature:21,fan:'auto'};
  private preAF: State|null = null;
  private afActive = false;
  private roomTemperature: number|null = null;
  private readonly afTemp: number;
  private readonly minT: number;
  private readonly maxT: number;

  constructor(private readonly platform:BroadlinkGreeACPlatform, private readonly acc:PlatformAccessory, private readonly cfg:GreeACDeviceConfig){
    const C=platform.Characteristic, S=platform.Service;
    this.afTemp=cfg.antiFrostTemperature??8;
    this.ir=new IRCodeManager(cfg.irCodesFile);
    this.minT=cfg.minTemperature??this.ir.minTemp;
    this.maxT=cfg.maxTemperature??this.ir.maxTemp;
    this.state.temperature=Math.round((this.minT+this.maxT)/2);
    this.rm=new BroadlinkRM(cfg.host,cfg.mac?Buffer.from(cfg.mac.replace(/[:-]/g,''),'hex'):null,cfg.devtype??0x6026,platform.log);

    this.hc=acc.getService(S.HeaterCooler)||acc.addService(S.HeaterCooler,cfg.name);
    this.hc.getCharacteristic(C.Active).onGet(()=>this.state.powered?C.Active.ACTIVE:C.Active.INACTIVE).onSet(v=>this.setActive(v as number));
    this.hc.getCharacteristic(C.CurrentHeaterCoolerState).onGet(()=>{
      if(!this.state.powered) return C.CurrentHeaterCoolerState.INACTIVE;
      if(this.state.mode==='heat') return C.CurrentHeaterCoolerState.HEATING;
      if(this.state.mode==='cool') return C.CurrentHeaterCoolerState.COOLING;
      return C.CurrentHeaterCoolerState.IDLE;
    });
    this.hc.getCharacteristic(C.TargetHeaterCoolerState).setProps({validValues:[1,2]})
      .onGet(()=>{if(this.state.mode==='heat') return C.TargetHeaterCoolerState.HEAT; if(this.state.mode==='cool') return C.TargetHeaterCoolerState.COOL; return C.TargetHeaterCoolerState.AUTO;})
      .onSet(v=>this.setMode(v as number));
    this.hc.getCharacteristic(C.CurrentTemperature).onGet(()=>this.roomTemperature??this.state.temperature);
    this.hc.getCharacteristic(C.HeatingThresholdTemperature).setProps({minValue:this.minT,maxValue:this.maxT,minStep:1}).onGet(()=>this.afActive?this.afTemp:this.state.temperature).onSet(v=>this.setTemp(v as number));
    this.hc.getCharacteristic(C.CoolingThresholdTemperature).setProps({minValue:this.minT,maxValue:this.maxT,minStep:1}).onGet(()=>this.afActive?this.afTemp:this.state.temperature).onSet(v=>this.setTemp(v as number));
    this.hc.getCharacteristic(C.RotationSpeed).setProps({minValue:0,maxValue:100,minStep:25}).onGet(()=>this.f2p(this.state.fan)).onSet(v=>this.setFan(v as number));

    if(cfg.temperatureSensor!==false) this.startTemperaturePolling();
    else platform.log.info('['+cfg.name+'] Temperature sensor disabled');
    if(cfg.antiFrostSwitch!==false){
      const suf=cfg.antiFrostNameSuffix??'anti-frost';
      const nm=`${cfg.name} ${suf}`;
      this.af=acc.services.find(s=>s.subtype==='antifrost')??acc.addService(S.Switch,nm,'antifrost');
      this.af!.getCharacteristic(C.On).onGet(()=>this.afActive).onSet(v=>this.setAF(v as boolean));
      platform.log.info(`[${cfg.name}] Anti-frost service added`);
    }
  }

  private async setActive(v:number){
    const C=this.platform.Characteristic;
    if(v===C.Active.INACTIVE){this.state.powered=false;await this.sendOff();}
    else{this.state.powered=true;await this.sendNow();}
    this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,!this.state.powered?C.CurrentHeaterCoolerState.INACTIVE:this.state.mode==='heat'?C.CurrentHeaterCoolerState.HEATING:C.CurrentHeaterCoolerState.COOLING);
  }
  private async setMode(v:number){
    const C=this.platform.Characteristic;
    this.state.mode=v===C.TargetHeaterCoolerState.HEAT?'heat':v===C.TargetHeaterCoolerState.COOL?'cool':'heat_cool';
    if(this.state.powered) await this.sendNow();
    this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,this.state.mode==='heat'?C.CurrentHeaterCoolerState.HEATING:C.CurrentHeaterCoolerState.COOLING);
  }
  private async setTemp(v:number){
    this.state.temperature=Math.round(v);
    if(this.state.powered&&!this.afActive) await this.sendNow();
    this.hc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature,this.roomTemperature??this.state.temperature);
  }
  private async setFan(p:number){ this.state.fan=this.p2f(p); if(this.state.powered&&!this.afActive) await this.sendNow(); }

  private async setAF(on:boolean){
    const C=this.platform.Characteristic;
    if(on){
      this.preAF={...this.state};
      this.afActive=true;
      if(!this.state.powered) this.platform.log.info(`[${this.cfg.name}] Anti-frost: device OFF, powering on HEAT 21°C first`);
      this.state={powered:true,mode:'heat',temperature:this.afTemp,fan:'auto'};
      await this.sendAntiFrost();
      this.platform.log.info(`[${this.cfg.name}] Anti-frost ON -> ${this.afTemp}°C`);
      this.hc.updateCharacteristic(C.Active,C.Active.ACTIVE);
      this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,C.CurrentHeaterCoolerState.HEATING);
      this.hc.updateCharacteristic(C.HeatingThresholdTemperature,this.afTemp);
      this.hc.updateCharacteristic(C.CurrentTemperature,this.roomTemperature??this.state.temperature);
      this.hc.updateCharacteristic(C.TargetHeaterCoolerState,C.TargetHeaterCoolerState.HEAT);
    } else {
      this.afActive=false;
      if(this.preAF){
        const wasOff=!this.preAF.powered;
        this.state={...this.preAF};
        this.preAF=null;
        if(wasOff){ await this.sendOff(); this.platform.log.info(`[${this.cfg.name}] Anti-frost OFF -> device was OFF, turning off`); this.hc.updateCharacteristic(C.Active,C.Active.INACTIVE); this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,C.CurrentHeaterCoolerState.INACTIVE); }
        else{ await this.sendNow(); this.platform.log.info(`[${this.cfg.name}] Anti-frost OFF -> restore ${this.state.temperature}°C`); this.hc.updateCharacteristic(C.Active,C.Active.ACTIVE); this.hc.updateCharacteristic(C.TargetHeaterCoolerState,this.state.mode==='heat'?C.TargetHeaterCoolerState.HEAT:C.TargetHeaterCoolerState.COOL); this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,this.state.mode==='heat'?C.CurrentHeaterCoolerState.HEATING:C.CurrentHeaterCoolerState.COOLING); this.hc.updateCharacteristic(C.HeatingThresholdTemperature,this.state.temperature); this.hc.updateCharacteristic(C.CurrentTemperature,this.roomTemperature??this.state.temperature); }
      }
    }
  }

  private async sendOff(){ try{await this.rm.sendData(this.ir.offCode());this.platform.log.debug(`[${this.cfg.name}] Sent OFF`);}catch(e){this.platform.log.error(`[${this.cfg.name}] OFF failed: ${e}`);} }
  private startTemperaturePolling() {
    let lastLog = 0;
    const LOG_INTERVAL = 30 * 60 * 1000; // 30 minutes
    const poll = async () => {
      const t = await this.rm.getTemperature();
      if(t !== null){
        this.roomTemperature = t;
        const now = Date.now();
        if(now - lastLog >= LOG_INTERVAL){
          this.platform.log.info('['+this.cfg.name+'] Room temp: '+t+'C');
          lastLog = now;
        }
        if(this.afActive === false){
          this.hc.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, t);
        }
      }
    };
    setTimeout(poll, 5000);
    setInterval(poll, 30000);
  }

  private async sendAntiFrost(){
    if(this.cfg.antiFrostCode){
      try{
        await this.rm.sendData(Buffer.from(this.cfg.antiFrostCode,'base64'));
        this.platform.log.info('['+this.cfg.name+'] Anti-frost: sent custom IR code');
        const C=this.platform.Characteristic;
        this.hc.updateCharacteristic(C.Active,C.Active.ACTIVE);
        this.hc.updateCharacteristic(C.CurrentHeaterCoolerState,C.CurrentHeaterCoolerState.HEATING);
        this.hc.updateCharacteristic(C.CurrentTemperature,this.roomTemperature??this.state.temperature);
        this.hc.updateCharacteristic(C.HeatingThresholdTemperature,this.afTemp);
      }catch(e){this.platform.log.error('['+this.cfg.name+'] Anti-frost custom code failed: '+e);}
    } else {
      await this.sendNow();
    }
  }
  private async sendNow(){ const c=this.ir.code(this.state.mode,this.state.fan,this.state.temperature); if(!c){this.platform.log.warn(`[${this.cfg.name}] No code for ${this.state.mode}/${this.state.fan}/${this.state.temperature}°C`);return;} try{await this.rm.sendData(c);this.platform.log.debug(`[${this.cfg.name}] Sent ${this.state.mode}/${this.state.fan}/${this.state.temperature}°C`);}catch(e){this.platform.log.error(`[${this.cfg.name}] Send failed: ${e}`);} }
  private f2p(f:FanMode):number{ return {low:25,mid:50,high:75,auto:100}[f]??100; }
  private p2f(p:number):FanMode{ if(p<=25) return 'low'; if(p<=50) return 'mid'; if(p<=75) return 'high'; return 'auto'; }
}
