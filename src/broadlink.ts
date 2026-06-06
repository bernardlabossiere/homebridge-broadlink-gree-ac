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
    const t=setTimeout(()=>{try{s.close();}catch{}reject(new Error('discovery timeout'));},5000);
    s.once('message',(msg,rinfo)=>{
      clearTimeout(t);try{s.close();}catch{}
      if(rinfo.address!==host||msg.length<0x40){reject(new Error('bad response'));return;}
      resolve({devtype:msg.readUInt16LE(0x34),mac:Buffer.from(msg.slice(0x3a,0x40)).reverse()});
    });
    s.bind(port,()=>s.send(pkt,80,host,e=>{if(e){clearTimeout(t);try{s.close();}catch{}reject(e);}}));
  });
}

export class BroadlinkRM {
  private key=Buffer.from(DEFAULT_KEY);
  private iv=Buffer.from(DEFAULT_IV);
  private id=Buffer.alloc(4,0);
  private count=Math.random()*0xffff|0;
  private authenticated=false;
  private mac:Buffer|null;
  private devtype:number;

  // Persistent socket — same port for auth AND all commands (required for RM4 Pro)
  private sock:dgram.Socket|null=null;
  private resolver:((m:Buffer)=>void)|null=null;
  private rejecter:((e:Error)=>void)|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;

  constructor(private readonly host:string, mac:Buffer|null, devtype:number, private readonly log:Logger){
    this.mac=mac; this.devtype=devtype;
  }

  private pad(d:Buffer):Buffer{const l=Math.ceil(d.length/16)*16||16;const o=Buffer.alloc(l,0);d.copy(o);return o;}
  private encrypt(d:Buffer):Buffer{const c=crypto.createCipheriv('aes-128-cbc',this.key,this.iv);c.setAutoPadding(false);return Buffer.concat([c.update(this.pad(d)),c.final()]);}
  private decrypt(d:Buffer):Buffer{const c=crypto.createDecipheriv('aes-128-cbc',this.key,this.iv);c.setAutoPadding(false);return Buffer.concat([c.update(d),c.final()]);}
  private cs(b:Buffer):number{let c=0xbeaf;for(let i=0;i<b.length;i++)c=(c+b[i])&0xffff;return c;}
  private build(cmd:number,payload:Buffer):Buffer{
    this.count=(this.count+1)&0xffff;
    const h=Buffer.alloc(0x38,0);
    h.writeUInt16LE(0x5a69,0);h.writeUInt16LE(this.devtype,0x24);h.writeUInt16LE(this.count,0x28);
    (this.mac??Buffer.alloc(6,0)).copy(h,0x2a);this.id.copy(h,0x30);h.writeUInt16LE(this.cs(payload),0x34);h[0x26]=cmd;
    const f=Buffer.concat([h,this.encrypt(payload)]);f.writeUInt16LE(this.cs(f),0x20);return f;
  }

  private async getSocket():Promise<dgram.Socket>{
    if(this.sock) return this.sock;
    return new Promise((resolve,reject)=>{
      const s=dgram.createSocket({type:'udp4'});
      s.on('message',msg=>{
        if(this.resolver){
          const r=this.resolver; this.resolver=null; this.rejecter=null;
          if(this.timer){clearTimeout(this.timer);this.timer=null;}
          r(msg);
        }
      });
      s.on('error',err=>{
        this.log.error('[Broadlink] socket error: '+err);
        this.sock=null; this.authenticated=false;
        if(this.rejecter){const rj=this.rejecter;this.rejecter=null;this.resolver=null;rj(new Error(String(err)));}
      });
      s.bind(0,()=>{this.sock=s;this.log.debug('[Broadlink] persistent socket bound on port '+s.address().port);resolve(s);});
      s.once('error',reject);
    });
  }

  private async tx(pkt:Buffer):Promise<Buffer>{
    const sock=await this.getSocket();
    return new Promise((resolve,reject)=>{
      if(this.resolver){reject(new Error('concurrent tx'));return;}
      this.resolver=resolve; this.rejecter=reject;
      this.timer=setTimeout(()=>{
        this.resolver=null;this.rejecter=null;
        reject(new Error('timeout '+this.host));
      },10000);
      sock.send(pkt,80,this.host,e=>{if(e){if(this.timer)clearTimeout(this.timer);this.resolver=null;this.rejecter=null;reject(e);}});
    });
  }

  async auth():Promise<void>{
    if(!this.mac||this.mac.equals(Buffer.alloc(6,0))){
      try{
        const{mac,devtype}=await discoverBroadlink(this.host);
        this.mac=mac; this.devtype=devtype;
        this.log.info('[Broadlink] '+this.host+' discovered type=0x'+devtype.toString(16)+' mac='+mac.toString('hex'));
      }catch(e){this.log.warn('[Broadlink] discovery failed: '+e);}
    }
    this.key=Buffer.from(DEFAULT_KEY); this.iv=Buffer.from(DEFAULT_IV); this.id=Buffer.alloc(4,0);
    const p=Buffer.alloc(0x50,0);
    for(let i=0;i<15;i++)p[4+i]=0x31; p[0x1e]=1; p[0x2d]=1; Buffer.from('homebridge').copy(p,0x30);
    const r=await this.tx(this.build(0x65,p));
    if(r.length>=0x38+16){
      const d=this.decrypt(r.slice(0x38));
      this.id=d.slice(0,4); this.key=d.slice(4,20);
      this.log.info('[Broadlink] '+this.host+' auth OK (key exchanged)');
    }else{
      this.log.warn('[Broadlink] '+this.host+' auth short ('+r.length+'b), using default key');
    }
    this.authenticated=true;
  }

  async sendData(code:Buffer):Promise<void>{
    if(!this.authenticated) await this.auth();
    const p=Buffer.alloc(4+code.length,0); p[0]=0x02; code.copy(p,4);
    try{await this.tx(this.build(0x6a,p));}
    catch(e){this.log.warn('[Broadlink] retry: '+e);this.authenticated=false;await this.auth();await this.tx(this.build(0x6a,p));}
  }

  async getTemperature():Promise<number|null>{
    if(!this.authenticated) await this.auth();
    const isRM4=this.devtype>=0x5000;
    const p=Buffer.alloc(16,0); p[0]=isRM4?0x24:0x01;
    try{
      const r=await this.tx(this.build(0x6a,p));
      if(r.length<0x38+8) return null;
      const err=r.readUInt16LE(0x22);
      if(err!==0){this.log.warn('[Broadlink] temp err: 0x'+err.toString(16));return null;}
      const d=this.decrypt(r.slice(0x38));
      this.log.info('[Broadlink] temp bytes: '+Array.from(d.slice(0,8)).map(b=>'0x'+b.toString(16).padStart(2,'0')).join(' '));
      const t=d[0x04]+d[0x05]/(isRM4?100.0:10.0);
      return (t>-20&&t<70)?Math.round(t*10)/10:null;
    }catch(e){this.log.warn('[Broadlink] getTemperature: '+e);return null;}
  }
}
