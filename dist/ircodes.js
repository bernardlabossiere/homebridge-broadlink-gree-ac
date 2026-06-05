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
exports.IRCodeManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const BUNDLED_CODES = path.join(__dirname, '..', 'codes', '1180.json');
class IRCodeManager {
    constructor(filePath) {
        this.data = JSON.parse(fs.readFileSync(filePath || BUNDLED_CODES, 'utf8'));
    }
    get minTemp() { return this.data.minTemperature; }
    get maxTemp() { return this.data.maxTemperature; }
    offCode() { return Buffer.from(this.data.commands.off, 'base64'); }
    code(mode, fan, temp) {
        const m = this.data.commands[mode];
        if (!m || typeof m === 'string')
            return null;
        // Try requested fan mode first, then any available fan mode
        const allFans = Object.keys(m);
        const fansToTry = [fan, ...allFans.filter(f => f !== fan)];
        for (const tryFan of fansToTry) {
            const f = m[tryFan];
            if (!f)
                continue;
            const exact = f[String(Math.round(temp))];
            if (exact)
                return Buffer.from(exact, 'base64');
            // Nearest available temperature
            const avail = Object.keys(f).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
            if (!avail.length)
                continue;
            const nearest = temp <= avail[0] ? avail[0] : temp >= avail[avail.length - 1] ? avail[avail.length - 1] :
                avail.reduce((p, c) => Math.abs(c - temp) < Math.abs(p - temp) ? c : p);
            const fb = f[String(nearest)];
            if (fb)
                return Buffer.from(fb, 'base64');
        }
        return null;
    }
}
exports.IRCodeManager = IRCodeManager;
