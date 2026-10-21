/** Isolation is settled before file picking; updates never reload a live model. */
const attemptKey = 'gridfinity-isolation-protocol-1';
async function prepareIsolation() {
  if (!isSecureContext || !('serviceWorker' in navigator)) return 'unsupported';
  const serviceWorker = navigator.serviceWorker;
  const registration = serviceWorker.register(
    new URL('./isolation-service-worker.js', import.meta.url),
    {
      scope: './',
      updateViaCache: 'none',
    },
  );
  // Registration/update may continue after fallback, but nothing in those
  // callbacks can navigate or interfere with the app once it has started.
  registration.catch(() => {});
  if (crossOriginIsolated) {
    try {
      sessionStorage.removeItem(attemptKey);
    } catch {
      /* Storage can be blocked. */
    }
    return 'isolated';
  }
  try {
    if (sessionStorage.getItem(attemptKey)) return 'single-after-attempt';
  } catch {
    return 'single-storage-unavailable';
  }
  let timer, stopListening;
  const controlled = new Promise((resolve) => {
    const check = () => {
      if (!serviceWorker.controller) return;
      resolve(true);
    };
    serviceWorker.addEventListener('controllerchange', check);
    stopListening = () =>
      serviceWorker.removeEventListener('controllerchange', check);
    registration.then(check, () => resolve(false));
    check();
  });
  let ready;
  try {
    ready = await Promise.race([
      controlled,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    stopListening();
  }
  if (!ready) return 'single-registration-unavailable';
  try {
    sessionStorage.setItem(attemptKey, 'attempted');
  } catch {
    return 'single-storage-unavailable';
  }
  location.reload();
  return 'reloading';
}
const gates = ['files', 'choose-file', 'demo'].map((id) =>
  document.getElementById(id),
);
for (const gate of gates) if (gate) gate.disabled = true;
const status = document.getElementById('status');
if (status) status.textContent = 'Starting CAD support…';
const preventDrop = (event) => event.preventDefault();
document.addEventListener('dragover', preventDrop);
document.addEventListener('drop', preventDrop);
let isolation;
try {
  isolation = await prepareIsolation();
} catch {
  isolation = 'single-registration-unavailable';
}
document.documentElement.dataset.cadIsolation = isolation;
if (isolation !== 'reloading') {
  try {
    await import('./app.js?v=magnet-fit-2');
    for (const gate of gates) if (gate) gate.disabled = false;
  } catch (error) {
    if (status)
      status.textContent = `The converter could not start: ${error.message}`;
    throw error;
  } finally {
    document.removeEventListener('dragover', preventDrop);
    document.removeEventListener('drop', preventDrop);
  }
}
