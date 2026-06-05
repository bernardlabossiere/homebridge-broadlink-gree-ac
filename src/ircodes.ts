import * as fs from 'fs';
export type FanMode = 'low'|'mid'|'high'|'auto';
export type OperationMode = 'heat_cool'|'cool'|'heat'|'dry'|'fan_only';
export class IRCodeManager {
  private data: any;
  constructor(f:string){ this.data=JSON.parse(fs.readFileSync(f,'utf8')); }
  get minTemp():number{ return this.data.minTemperature; }
  get maxTemp():number{ return this.data.maxTemperature; }
  offCode():Buffer{ return Buffer.from(this.data.commands.off,'base64'); }
  code(mode:OperationMode,fan:FanMode,temp:number):Buffer|null{
    const m=this.data.commands[mode]; if(!m||typeof m==='string') return null;
    const f=m[fan]; if(!f) return null;
    const r=f[String(Math.round(temp))]; if(!r) return null;
    return Buffer.from(r,'base64');
  }
}
