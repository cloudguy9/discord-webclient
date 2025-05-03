const registerServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/worker.js", {
        scope: "/",
      });
      if (registration.installing) {
        console.log("Service worker installing");
      } else if (registration.waiting) {
        console.log("Service worker installed");
      } else if (registration.active) {
        console.log("Service worker active");
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`);
    }
  }
};


self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (!event.request.url.includes("cdn.discord")) {return}

	const url = new URL(event.request.url);

	const newUrl = `${window.location.origin}/cdn${url.pathname}${url.search}`;

	event.respondWith(fetch(newUrl));
});

registerServiceWorker();
