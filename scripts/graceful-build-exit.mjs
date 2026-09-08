// The Windows Node 24 / vinext build can abort in libuv while forcing a
// successful exit immediately after prerender. Let completed I/O drain.
// Nonzero exits retain the CLI's original failure behavior.
if (process.platform === 'win32') {
  const forceExit = process.exit.bind(process);
  process.exit = (code = process.exitCode ?? 0) => {
    if (Number(code) !== 0) return forceExit(code);
    process.exitCode = 0;
  };
}
