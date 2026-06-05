import * as dgram from 'dgram';
import * as crypto from 'crypto';
import { Logger } from 'homebridge';

const DEFAULT_KEY = Buffer.from([0x09,0x76,0x28,0x34,0x3f,0xe9,0x9e,0x23,0x88,0x4f,0xa5,0x8b,0xef,0x80,0x0e,0x95]);
const DEFAULT_IV  = Buffer.from([0x56,0x2e,0x17,0x99,0x6d,0x09,0x3d,0x28,0xdd,0xb3,0xba,0x69,0x5a,0x2e,0x6f,0x58]);

export class BroadlinkRM {
  private key = Buffer.from(DEFAULT_KEY);
  private iv  = Buffer.from(DEFAULT_IV);
  private id  = Buffer.alloc(4,0);
  private count = Math.random()*0xffff|0;
  private authenticated = false;

  constructor(private readonly host:string, private readonly mac:Buffer|null, private readonly devtype:number=0x6026, private readonly log:Logger){}

  private pad(d:Buffer):Buffer{ const l=Math.ceil(d.length/16)*16||16; const o=Buffer.alloc(l,0); d.copy(o); return o; }
  private encrypt(d:Buffer):Buffer{ const c=crypto.createCipheriv('aes-128-cbc',this.key,this.iv); c.setAutoPadding(false); return Buffer.concat([c.update(this.pad(d)),c.final()]); }
  private decrypt(d:Buffer):Buffer{ const c=crypto.createDecipheriv('aes-128-cbc',this.key,this.iv); c.setAutoPadding(false); return Buffer.concat([c.update(d),c.final()]); }
  private cs(b:Buffer):number{ let c=0xbeaf; for(let i=0;i<b.length;i++) c=(c+b[i])&0xffff; return c; }

  private build(cmd:number,payload:Buffer):Buffer{
    this.count=(this.count+1)&0xffff;
    const h=Buffer.alloc(0x38,0);
    h.writeUInt16LE(0x5a69,0); h.writeUInt16LE(this.devtype,0x24); h.writeUInt16LE(this.count,0x28);
    (this.mac??Buffer.alloc(6,0)).copy(h,0x2a); this.id.copy(h,0x30); h.writeUInt16LE(this.cs(payload),0x34); h[0x26]=cmd;
    const f=Buffer.concat([h,this.encrypt(payload)]); f.writeUInt16LE(this.cs(f),0x20); return f;
  }

  private tx(pkt:Buffer):Promise<Buffer>{
    return new Promise((res,rej)=>{
      const s=dgram.createSocket({type:'udp4'});
      const t=setTimeout(()=>{try{s.close();}catch{}rej(new Error('timeout '+this.host));},10000);
      s.once('message',m=>{clearTimeout(t);try{s.close();}catch{}res(m);});
      s.bind(0,()=>s.send(pkt,80,this.host,e=>{if(e){clearTimeout(t);try{s.close();}catch{}rej(e);}}));
    });
  }

  async auth():Promise<void>{
    const p=Buffer.alloc(0x50,0);
    for(let i=0;i<15;i++) p[4+i]=0x31;
    p[0x1e]=1; p[0x2d]=1; Buffer.from('homebridge').copy(p,0x30);
    const r=await this.tx(this.build(0x65,p));
    if(r.length>=0x38+16){const d=this.decrypt(r.slice(0x38));this.id=d.slice(0,4);this.key=d.slice(4,20);this.log.info('[Broadlink] '+this.host+' auth OK (key exchanged)');}
    else{this.log.warn('[Broadlink] '+this.host+' auth short ('+r.length+'b), using default key');}
    this.authenticated=true;
  }

  async sendData(code:Buffer):Promise<void>{
    if(!this.authenticated) await this.auth();
    const p=Buffer.alloc(4+code.length,0); p[0]=0x02; code.copy(p,4);
    try{ await this.tx(this.build(0x6a,p)); }
    catch(e){ this.log.warn('[Broadlink] retry: '+e); this.authenticated=false; await this.auth(); await this.tx(this.build(0x6a,p)); }
  }
}
