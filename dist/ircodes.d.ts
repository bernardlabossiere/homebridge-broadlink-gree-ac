export type FanMode = 'low' | 'mid' | 'high' | 'auto';
export type OperationMode = 'heat_cool' | 'cool' | 'heat' | 'dry' | 'fan_only';
export declare class IRCodeManager {
    private data;
    constructor(f: string);
    get minTemp(): number;
    get maxTemp(): number;
    offCode(): Buffer;
    code(mode: OperationMode, fan: FanMode, temp: number): Buffer | null;
}
