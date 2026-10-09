/** Types for the parts of the vendored WebGPU engine the page uses. */

export type Tokens = number[];

export interface PreferStats {
  loss: number;
  margin: number;
  accuracy: number;
  ms: number;
  pairs: number;
}

export interface DPOSession {
  beta: number;
  meta: { val_loss_int8?: number; step?: number };
  policy: { nParams: number };
  device: { lost: Promise<{ message: string; reason: string }> };
  text(ids: Tokens): string;
  sample(n: number): Promise<Tokens[]>;
  samplePair(): Promise<[Tokens, Tokens]>;
  rewards(seqs: Tokens[]): Promise<number[]>;
  prefer(chosen: Tokens, rejected: Tokens): Promise<PreferStats>;
  reset(): void;
}

export class WebGPUUnavailableError extends Error {}

export function loadDPOSession(
  url: string,
  opts?: { onProgress?: (loaded: number, total: number) => void } & Partial<
    Pick<DPOSession, "beta"> & { lr: number; sft: number; stepsPerClick: number; replay: number; temperature: number; topK: number }
  >,
): Promise<DPOSession>;
