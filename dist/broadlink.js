"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadlinkRM = void 0;
const dgram = __importStar(require("dgram"));
const crypto = __importStar(require("crypto"));
const DEFAULT_KEY = Buffer.from([0x09, 0x76, 0x28, 0x34, 0x3f, 0xe9, 0x9e, 0x23, 0x88, 0x4f, 0xa5, 0x8b, 0xef, 0x80, 0x0e, 0x95]);
const DEFAULT_IV = Buffer.from([0x56, 0x2e, 0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58]);
class BroadlinkRM {
    constructor(host, mac, devtype = 0x6026, log) {
        this.host = host;
        this.mac = mac;
        this.devtype = devtype;
        this.log = log;
        this.key = Buffer.from(DEFAULT_KEY);
        this.iv = Buffer.from(DEFAULT_IV);
        this.id = Buffer.alloc(4, 0);
        this.count = Math.random() * 0xffff | 0;
        this.authenticated = false;
    }
    pad(d) { const l = Math.ceil(d.length / 16) * 16 || 16; const o = Buffer.alloc(l, 0); d.copy(o); return o; }
    encrypt(d) { const c = crypto.createCipheriv('aes-128-cbc', this.key, this.iv); c.setAutoPadding(false); return Buffer.concat([c.update(this.pad(d)), c.final()]); }
    decrypt(d) { const c = crypto.createDecipheriv('aes-128-cbc', this.key, this.iv); c.setAutoPadding(false); return Buffer.concat([c.update(d), c.final()]); }
    cs(b) { let c = 0xbeaf; for (let i = 0; i < b.length; i++)
        c = (c + b[i]) & 0xffff; return c; }
    build(cmd, payload) {
        this.count = (this.count + 1) & 0xffff;
        const h = Buffer.alloc(0x38, 0);
        h.writeUInt16LE(0x5a69, 0);
        h.writeUInt16LE(this.devtype, 0x24);
        h.writeUInt16LE(this.count, 0x28);
        this.mac.copy(h, 0x2a);
        this.id.copy(h, 0x30);
        h.writeUInt16LE(this.cs(payload), 0x34);
        h[0x26] = cmd;
        const f = Buffer.concat([h, this.encrypt(payload)]);
        f.writeUInt16LE(this.cs(f), 0x20);
        return f;
    }
    tx(pkt) {
        return new Promise((res, rej) => {
            const s = dgram.createSocket({ type: 'udp4' });
            const t = setTimeout(() => { try {
                s.close();
            }
            catch { } rej(new Error('timeout ' + this.host)); }, 10000);
            s.once('message', m => { clearTimeout(t); try {
                s.close();
            }
            catch { } res(m); });
            s.bind(0, () => s.send(pkt, 80, this.host, e => { if (e) {
                clearTimeout(t);
                try {
                    s.close();
                }
                catch { }
                rej(e);
            } }));
        });
    }
    async auth() {
        const p = Buffer.alloc(0x50, 0);
        for (let i = 0; i < 15; i++)
            p[4 + i] = 0x31;
        p[0x1e] = 1;
        p[0x2d] = 1;
        Buffer.from('homebridge').copy(p, 0x30);
        const r = await this.tx(this.build(0x65, p));
        if (r.length < 0x38 + 16)
            throw new Error('auth too short');
        const d = this.decrypt(r.slice(0x38));
        this.id = d.slice(0, 4);
        this.key = d.slice(4, 20);
        this.authenticated = true;
        this.log.debug('[Broadlink] ' + this.host + ' authenticated');
    }
    async sendData(code) {
        if (!this.authenticated)
            await this.auth();
        const p = Buffer.alloc(4 + code.length, 0);
        p[0] = 0x02;
        code.copy(p, 4);
        try {
            await this.tx(this.build(0x6a, p));
        }
        catch (e) {
            this.log.warn('[Broadlink] retry: ' + e);
            this.authenticated = false;
            await this.auth();
            await this.tx(this.build(0x6a, p));
        }
    }
}
exports.BroadlinkRM = BroadlinkRM;
