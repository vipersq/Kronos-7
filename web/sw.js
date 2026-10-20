/* KRONOS-7 – minimalny service worker: pozwala zainstalować terminal jako aplikację na telefonie.
   Dane zawsze z serwera (bez pamięci podręcznej), żeby nie pokazywać nieaktualnych informacji. */
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => self.clients.claim());
self.addEventListener("fetch", () => {});
