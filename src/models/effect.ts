export enum EffectType {
  Reverb = 'reverb',
  Delay = 'delay',
  Compressor = 'compressor',
  EQ = 'eq'
}

export interface EffectParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface Effect {
  id: string;
  type: EffectType;
  parameters: EffectParameter[];
  bypass: boolean;
  node?: AudioNode;
}
