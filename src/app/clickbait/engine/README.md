# engine

Vendored from [bklosk/clickbait-rlhf](https://github.com/bklosk/clickbait-rlhf) `web/src/`
(branch `webgpu-gpt`). That repo has the pretraining code, the PyTorch parity test, the
benchmarks and the DPO simulator — change the engine there and copy it back here.

`public/clickbait/headline-gpt-v1.bin` is that repo's `web/public/headline-gpt.bin`. It is served
with an immutable cache header (see `next.config.ts`), so ship a new model under a new name.
