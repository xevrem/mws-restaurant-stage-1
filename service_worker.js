const CACHE_NAME = 'mws-restaurant-v1';

const RESOURCES_TO_PRECACHE = [
  'index.html',
  'favicon.ico',
  'manifest.json',
  'restaurant.html',
  'css/styles.css',
  'js/dbhelper.js',
  'js/main.js',
  'js/restaurant_info.js',
  'js/utils.js',
  'js/idb.js'
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
];

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

//attempts a network fetch (without browser cache) and then caches the response
self.revalidate_fetch = (url) => {
  return fetch(url, {cache: 'no-cache'}).then(response => {
    return caches.open(CACHE_NAME).then(cache => {
      return cache.put(url, response.clone()).then(() => {
        return response;
      });
    });
  });
};

//intercede any fetches and serve from cache in a stale-while-revalidate manner
self.addEventListener('fetch', event => {
  //skip extension requests
  if(!(event.request.url.indexOf('http') === 0)) return;
  //dont cache non-GETs
  if(event.request.method != 'GET') {
    return event.respondWith(fetch(event.request).then(response=>{
      return response;
    }));
    // return;
  }

  //normalize the url for local fetches
  let request_url = new URL(event.request.url);
  request_url.search = '';

  //if trying to access the database api, always retrieve the latest
  if(request_url.port === '1337'){
    return event.respondWith(fetch(event.request).then(response=>{
      return response;
    }));
    // return;
  }

  //if requesting from the origin, use request_url
  if(request_url.origin === location.origin){
    //if request is for 'root' page, serve the index
    if (request_url.pathname === '/') {
      return event.respondWith(caches.open(CACHE_NAME).then(cache => {
        return cache.match('index.html').then(response => {
          //if valid response, use it, but revalidate too
          if(response){
            //ensure sw left alive long enough to re-cache
            event.waitUntil(revalidate_fetch('index.html'));
            return response;
          }
          //do a fetch & cache
          return revalidate_fetch('index.html');
        });
      }));
      // return;
    }

    //serve local resources with normalized URL
    return event.respondWith(caches.match(request_url).then(response => {
      //if valid response, use it, but revalidate too
      if(response){
        //ensure sw left alive long enough to re-cache
        event.waitUntil(revalidate_fetch(request_url));
        return response;
      }
      //do a fetch & cache
      return revalidate_fetch(request_url);
    }));
    // return;
  }

  //for network fetches
  return event.respondWith(caches.match(event.request).then(response => {
    //if valid response, use it, but revalidate too
    if(response){
      //ensure sw left alive long enough to re-cache
      event.waitUntil(revalidate_fetch(event.request));
      return response;
    }
    //do a fetch & cache
    return revalidate_fetch(event.request);
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
