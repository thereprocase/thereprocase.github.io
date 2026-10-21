# Native preparation failure regression

`check-browser.mjs` runs one selected preparation-failure control against an isolated test site. Run it separately with `PREP_FAILURE=fatal`, `PREP_FAILURE=queued`, and `PREP_FAILURE=ordinary`; set `AUDIT_WAIT_PREPARED=1` and `AUDIT_TRANSLATE_STEP=1` for each case. It requires Node with native WebSocket, Python 3, Chromium, and `AUDIT_MANIFEST` pointing to the native fixture manifest used by the converter browser checks. Pass the copied public directory and output JSON path as positional arguments.

Apply `test-only-injection.patch` only to the converter directory in a disposable copy of the site. The hooks simulate a `WebAssembly.RuntimeError` from the SameParameter binding during actual preparation; they do not deliberately corrupt memory. Never apply or publish them in the public/docs runtime. The queued case uses a test-only delay. The harness checks original input/settings retention, worker replacement for fatal traps, rejection of stale messages, and strict STEP success after retry.

The release uses the unchanged native kernels from native-step-20261021-3. Runtime qualification is recorded in `public/gridfinity-converter/checks/recovery-native-step-4.json`; the under-20-second Windows speed goal remains open.
