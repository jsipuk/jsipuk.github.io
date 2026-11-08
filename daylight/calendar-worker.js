// Daylight: works out the sky calendar off the main thread, so scrolling stays smooth.
importScripts("astronomy.min.js", "sky.js");
self.onmessage = e => {
  const { id, from, place, days } = e.data;
  try {
    const events = self.Sky.skyEvents(new Date(from), place, days).map(ev => Object.assign({}, ev, { date: +ev.date }));
    self.postMessage({ id, events });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
