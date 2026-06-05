import * as fs from 'fs';
import * as path from 'path';
export type FanMode = 'low'|'mid'|'high'|'auto';
export type OperationMode = 'heat_cool'|'cool'|'heat'|'dry'|'fan_only';
const BUNDLED_CODES = path.join(__dirname,'..','codes','1180.json');
export class IRCodeManager {
  private data: any;
  constructor(filePath?: string) {
    this.data = JSON.parse(fs.readFileSync(filePath || BUNDLED_CODES,'utf8'));
  }
  get minTemp(): number { return this.data.minTemperature; }
  get maxTemp(): number { return this.data.maxTemperature; }
  offCode(): Buffer { return Buffer.from(this.data.commands.off,'base64'); }
  code(mode: OperationMode, fan: FanMode, temp: number): Buffer|null {
    const m = this.data.commands[mode];
    if (!m || typeof m==='string') return null;
    // Try requested fan mode first, then any available fan mode
    const allFans = Object.keys(m as any);
    const fansToTry = [fan, ...allFans.filter(f=>f!==fan)];
    for (const tryFan of fansToTry) {
      const f = (m as any)[tryFan];
      if (!f) continue;
      const exact = f[String(Math.round(temp))];
      if (exact) return Buffer.from(exact,'base64');
      // Nearest available temperature
      const avail = Object.keys(f).map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
      if (!avail.length) continue;
      const nearest = temp<=avail[0] ? avail[0] : temp>=avail[avail.length-1] ? avail[avail.length-1] :
        avail.reduce((p,c)=>Math.abs(c-temp)<Math.abs(p-temp)?c:p);
      const fb = f[String(nearest)];
      if (fb) return Buffer.from(fb,'base64');
    }
    return null;
  }
}
