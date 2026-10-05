// Runs before first paint (blocking, in <head>) so a stored theme never flashes.
try {
  var t = localStorage.getItem("kwerft-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
