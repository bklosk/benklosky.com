declare module "macy" {
  interface MacyOptions {
    container: string;
    trueOrder?: boolean;
    waitForImages?: boolean;
    margin?: number;
    columns?: number;
    breakAt?: {
      [key: number]: number;
    };
  }

  class Macy {
    constructor(options: MacyOptions);
    destroy(): void;
    recalculate(): void;
    runOnImageLoad(callback: () => void): void;
  }

  export default Macy;
}
