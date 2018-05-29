const CACHE_NAME = 'mws-restaurant-v1'

const RESOURCES_TO_PRECACHE = [
  'index.html',
  'restaurant.html',
  'css/styles.css',
  'data/restaurants.json',
  'js/dbhelper.js',
  'js/main.js',
  'js/restaurant_info.js',
  'js/utils.js',
];

const IMAGES_TO_PRECACHE = [
  'img/1.jpg',
  'img/2.jpg',
  'img/3.jpg',
  'img/4.jpg',
  'img/5.jpg',
  'img/6.jpg',
  'img/7.jpg',
  'img/8.jpg',
  'img/9.jpg',
  'img/10.jpg',
  'img/1_sm.jpg',
  'img/2_sm.jpg',
  'img/3_sm.jpg',
  'img/4_sm.jpg',
  'img/5_sm.jpg',
  'img/6_sm.jpg',
  'img/7_sm.jpg',
  'img/8_sm.jpg',
  'img/9_sm.jpg',
  'img/10_sm.jpg',
  'img/1_md.jpg',
  'img/2_md.jpg',
  'img/3_md.jpg',
  'img/4_md.jpg',
  'img/5_md.jpg',
  'img/6_md.jpg',
  'img/7_md.jpg',
  'img/8_md.jpg',
  'img/9_md.jpg',
  'img/10_md.jpg',
]

//preload the cache with all relevant stuffs
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all([
        cache.addAll(RESOURCES_TO_PRECACHE),
        cache.addAll(IMAGES_TO_PRECACHE)]);
    })
  );
});

//perform any initial work when service worker becomes active
self.addEventListener('activate', event => {
  console.log('service_worker is now active...');
  clients.claim();
  
  //TODO: perform any one-time cleanup here...
});

//attempts a network fetch and caches the response
const revalidate_fetch = (url) => {
  fetch(url).then(response => {
    caches.open(CACHE_NAME).then(cache => {
      cache.put(url, response.clone());
    });
  });
} 

//intercede any fetches and serve from cache in a stale-while-revalidate manner
self.addEventListener('fetch', event => {
  //skip extension requests
  if(!(event.request.url.indexOf('http') === 0)) return;

  //normalize the url for local fetches
  let request_url = new URL(event.request.url);
  request_url.search = '';
    
  //if requesting from the origin, use request_url
  if(request_url.origin === location.origin){
    //if request is for 'root' page, serve the index
    if (request_url.pathname === '/') {
      event.respondWith(caches.match('index.html'));
      
      //ensure sw left alive long enough to re-cache
      event.waitUntil(revalidate_fetch('index.html', event));
      return;
    }

    //serve local resources with normalized URL
    event.respondWith(caches.match(request_url).then(response => {
      //ensure sw left alive long enough to re-cache
      event.waitUntil(revalidate_fetch(request_url, event));
      return response || fetch(request_url);
    }));
    return;
  }

  //for network fetches
  event.respondWith(caches.match(event.request).then(response => {
    //ensure sw left alive long enough to re-cache
    event.waitUntil(revalidate_fetch(event.request, event));
    return response || fetch(event.request);
  }));
});


//handle takeover and cleanup (future)
self.addEventListener('message', event => {
  //if the app says you should take over, take over now.
  if (event.data.action === 'SKIP_WAITING') {
    console.log('service_worker SKIP_WAITING...');
    self.skipWaiting();
  } else if (event.data.action === 'CLEANUP') {
    console.log('service_worker CLEANUP...');

    //clear cache
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(key=>{
          cache.delete(key);
        });
      })
    })
  }
});