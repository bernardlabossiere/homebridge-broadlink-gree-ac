import * as dgram from 'dgram';
import * as crypto from 'crypto';
import { Logger } from 'homebridge';

const DEFAULT_KEY = Buffer.from('097628343fe99e23765c1513accf8b02','hex');
const DEFAULT_IV  = Buffer.from('562e17996d093d28ddb3ba695a2e6f58','hex');
const SIGNATURE   = Buffer.from('5aa5aa555aa5aa55','hex');

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
    SIGNATURE.copy(h,0);
    h.writeUInt16LE(this.devtype,0x24);
    h[0x26]=cmd;
    h.writeUInt16LE(this.count,0x28);
    (this.mac??Buffer.alloc(6,0)).copy(h,0x2a);
    this.id.copy(h,0x30);
    h.writeUInt16LE(this.cs(payload),0x34);
    const f=Buffer.concat([h,this.encrypt(payload)]);
    f.writeUInt16LE(this.cs(f),0x20);
    return f;
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
      s.bind(0,()=>{this.sock=s;resolve(s);});
      s.once('error',reject);
    });
  }

  private async tx(pkt:Buffer):Promise<Buffer>{
    const sock=await this.getSocket();
    return new Promise((resolve,reject)=>{
      if(this.resolver){reject(new Error('concurrent tx'));return;}
      this.resolver=resolve; this.rejecter=reject;
      this.timer=setTimeout(()=>{this.resolver=null;this.rejecter=null;reject(new Error('timeout '+this.host));},10000);
      sock.send(pkt,80,this.host,e=>{if(e){if(this.timer)clearTimeout(this.timer);this.resolver=null;this.rejecter=null;reject(e);}});
    });
  }

  async auth():Promise<void>{
    if(!this.mac||this.mac.equals(Buffer.alloc(6,0))){
      try{
        const{mac,devtype}=await discoverBroadlink(this.host);
        this.mac=mac; this.devtype=devtype;
        this.log.debug('[Broadlink] '+this.host+' discovered type=0x'+devtype.toString(16)+' mac='+mac.toString('hex'));
      }catch(e){this.log.warn('[Broadlink] discovery failed: '+e);}
    }
    this.key=Buffer.from(DEFAULT_KEY); this.iv=Buffer.from(DEFAULT_IV); this.id=Buffer.alloc(4,0);
    const p=Buffer.alloc(0x50,0);
    for(let i=0x04;i<0x14;i++)p[i]=0x31;
    p[0x1e]=0x01; p[0x2d]=0x01;
    Buffer.from('Test 1').copy(p,0x30);
    const r=await this.tx(this.build(0x65,p));
    const err=r.readUInt16LE(0x22);
    if(err===0 && r.length>=0x38+16){
      const d=this.decrypt(r.slice(0x38));
      this.id=d.slice(0,4); this.key=d.slice(4,20);
      this.authenticated=true;
      this.log.debug('[Broadlink] '+this.host+' auth OK (session key acquired)');
    }else{
      this.authenticated=false;
      this.log.warn('[Broadlink] '+this.host+' auth failed (len='+r.length+' err=0x'+err.toString(16)+')');
      throw new Error('auth failed');
    }
  }

  private wrap(command:number,data:Buffer):Buffer{
    const p=Buffer.alloc(6+data.length,0);
    p.writeUInt16LE(data.length+4,0);
    p.writeUInt32LE(command,2);
    data.copy(p,6);
    return p;
  }

  async sendData(code:Buffer):Promise<void>{
    if(!this.authenticated){try{await this.auth();}catch(e){this.log.warn('[Broadlink] auth before sendData failed: '+e);}}
    const send=()=>this.tx(this.build(0x6a,this.wrap(0x02,code)));
    try{
      await send();
    }catch(e){
      this.log.warn('[Broadlink] sendData retry: '+e);
      this.authenticated=false;
      try{await this.auth();}catch(_e){/* ignore */}
      await send();
    }
  }

  async getTemperature():Promise<number|null>{
    if(!this.authenticated){
      try{await this.auth();}catch(e){this.log.warn('[Broadlink] auth before temp failed: '+e);return null;}
    }
    for(let attempt=0;attempt<4;attempt++){
      try{
        const r=await this.tx(this.build(0x6a,this.wrap(0x24,Buffer.alloc(0))));
        if(r.length<0x38+8) return null;
        const err=r.readUInt16LE(0x22);
        if(err!==0){
          this.log.debug('[Broadlink] temp busy 0x'+err.toString(16)+' (attempt '+(attempt+1)+')');
          await new Promise(res=>setTimeout(res,600));
          continue;
        }
        const d=this.decrypt(r.slice(0x38));
        const t=d[0x06]+d[0x07]/100.0;
        const h=d[0x08]+d[0x09]/100.0;
        this.log.debug('[Broadlink] '+this.host+' temp='+t.toFixed(2)+'C humidity='+h.toFixed(2)+'%');
        return (t>-20&&t<70)?Math.round(t*10)/10:null;
      }catch(e){
        this.log.warn('[Broadlink] getTemperature: '+e);
        return null;
      }
    }
    return null;
  }
}
