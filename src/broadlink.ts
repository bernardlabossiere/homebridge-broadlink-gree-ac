import * as dgram from 'dgram';
import * as crypto from 'crypto';
import { Logger } from 'homebridge';

const DEFAULT_KEY = Buffer.from([0x09,0x76,0x28,0x34,0x3f,0xe9,0x9e,0x23,0x88,0x4f,0xa5,0x8b,0xef,0x80,0x0e,0x95]);
const DEFAULT_IV  = Buffer.from([0x56,0x2e,0x17,0x99,0x6d,0x09,0x3d,0x28,0xdd,0xb3,0xba,0x69,0x5a,0x2e,0x6f,0x58]);

export async function discoverBroadlink(host:string):Promise<{mac:Buffer,devtype:number}>{
  return new Promise((resolve,reject)=>{
    const port=40000+Math.floor(Math.random()*10000);
    const now=new Date();
    const pkt=Buffer.alloc(0x30,0);
    pkt.writeUInt8(now.getSeconds(),0x0d);pkt.writeUInt16LE(now.getFullYear(),0x0e);
    pkt.writeUInt8(now.getMinutes(),0x10);pkt.writeUInt8(now.getHours(),0x11);
    pkt.writeUInt8((now.getDay()||7),0x12);pkt.writeUInt8(now.getDate(),0x13);pkt.writeUInt8(now.getMonth()+1,0x14);
    pkt.writeUInt16LE(port,0x18);pkt[0x26]=0x06;
    let cs=0xbeaf;for(let i=0;i<pkt.length;i++)cs=(cs+pkt[i])&0xffff;pkt.writeUInt16LE(cs,0x20);
    const s=dgram.createSocket({type:'udp4'});
    const t=setTimeout(()=>{try{s.close();}catch{}reject(new Error('discovery timeout '+host));},5000);
    s.once('message',(msg,rinfo)=>{
      clearTimeout(t);try{s.close();}catch{}
      if(rinfo.address!==host||msg.length<0x40){reject(new Error('bad discovery response'));return;}
      const devtype=msg.readUInt16LE(0x34);
      const mac=Buffer.from(msg.slice(0x3a,0x40)).reverse();
      resolve({mac,devtype});
    });
    s.bind(port,()=>s.send(pkt,80,host,e=>{if(e){clearTimeout(t);try{s.close();}catch{}reject(e);}}));
  });
}

export class BroadlinkRM {
  private key = Buffer.from(DEFAULT_KEY);
  private iv  = Buffer.from(DEFAULT_IV);
  private id  = Buffer.alloc(4,0);
  private count = Math.random()*0xffff|0;
  private authenticated = false;

  constructor(private readonly host:string, private mac:Buffer|null, private devtype:number=0x6026, private readonly log:Logger){}

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

  async getTemperature():Promise<number|null>{
    // Ensure device is discovered
    if(!this.mac||this.mac.equals(Buffer.alloc(6,0))){
      try{const{mac,devtype}=await discoverBroadlink(this.host);this.mac=mac;this.devtype=devtype;}
      catch(e){this.log.warn('[Broadlink] discovery failed: '+e);return null;}
    }
    const isRM4=(this.devtype>=0x5000);
    const payload=Buffer.alloc(16,0);
    payload[0]=isRM4?0x24:0x01;
    // Auth + temp through SAME socket (RM4 Pro associates auth to source port)
    return new Promise(resolve=>{
      const sock=dgram.createSocket({type:'udp4'});
      const timer=setTimeout(()=>{try{sock.close();}catch{}resolve(null);},15000);
      let step='auth';
      sock.on('message',msg=>{
        if(step==='auth'){
          if(msg.length>=0x38+16){
            const d=this.decrypt(msg.slice(0x38));
            this.id=d.slice(0,4);this.key=d.slice(4,20);
            this.log.info('[Broadlink] '+this.host+' auth OK via persistent socket');
          }
          step='temp';
          sock.send(this.build(0x6a,payload),80,this.host);
        }else{
          clearTimeout(timer);try{sock.close();}catch{}
          if(msg.length<0x38+8){resolve(null);return;}
          const err=msg.readUInt16LE(0x22);
          if(err!==0){this.log.warn('[Broadlink] temp err: 0x'+err.toString(16));resolve(null);return;}
          const dec=this.decrypt(msg.slice(0x38));
          this.log.info('[Broadlink] temp bytes: '+Array.from(dec.slice(0,8)).map(b=>'0x'+b.toString(16).padStart(2,'0')).join(' '));
          const temp=dec[0x04]+dec[0x05]/(isRM4?100.0:10.0);
          resolve((temp>-20&&temp<70)?Math.round(temp*10)/10:null);
        }
      });
      sock.bind(0,()=>{
        const p=Buffer.alloc(0x50,0);
        for(let i=0;i<15;i++)p[4+i]=0x31;p[0x1e]=1;p[0x2d]=1;
        Buffer.from('homebridge').copy(p,0x30);
        sock.send(this.build(0x65,p),80,this.host);
      });
    });
  }

  async sendData(code:Buffer):Promise<void>{
    if(!this.authenticated) await this.auth();
    const p=Buffer.alloc(4+code.length,0); p[0]=0x02; code.copy(p,4);
    try{ await this.tx(this.build(0x6a,p)); }
    catch(e){ this.log.warn('[Broadlink] retry: '+e); this.authenticated=false; await this.auth(); await this.tx(this.build(0x6a,p)); }
  }
}
