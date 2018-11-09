/* global DBHelper Utils google*/

/* eslint-disable */
let restaurants,
  neighborhoods,
  cuisines;
var map;
var markers = [];
/* eslint-enable  */

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {

  fetch_neighborhoods().then(()=>{
    fetch_cuisines().then(()=>{
      update_restaurants().then(() => {
        console.log('initialization done...');
        DBHelper.open_db().then(idb=>{
          DBHelper.refresh_restaurants(idb).then(()=>{
            console.log('database refreshed...');
          });
        });
      }).catch(error => {
        console.error('main.update_restaurants error:', error);
      });
    }).catch(error => {
      console.error('main.fetch_cuisines error:', error);
    });
  }).catch(error => {
    console.error('main.fetch_neighborhoods error:', error);
  });

});

let reloading = false;

window.addEventListener('load', () => {
  if(!navigator.serviceWorker) return;

  if(navigator.serviceWorker.controller){
    let url = navigator.serviceWorker.controller.scriptURL;
    console.log('serviceWorker.controller', url);
  }else{
    navigator.serviceWorker.register('/service_worker.js').then(registration=>{
      // is this a service worker that is waiting to take over?
      if(registration.waiting){
        updateReady(registration.waiting);
        return;
      }

      //is this a service worker that is installing?
      if(registration.installing){
        trackInstalling(registration.installing);
        return;
      }

      //has a new service worker appeared?
      registration.addEventListener('updatefound', () => {
        trackInstalling(registration.installing);
      });
    });
  }

  //if the current service worker has changed, reload this page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    //console.log('reloading...');
    window.location.reload();
    reloading = true;
  });
});

//let user know service worker can update
const updateReady = (worker) => {
  // console.log('updateReady called...');
  worker.postMessage({action: 'SKIP_WAITING'});
};

//create an state change tracker for this service worker
const trackInstalling = (worker) => {
  // console.log('trackInstalling called...');
  //if this service worker finished installing, tell it to take over.
  worker.addEventListener('statechange', ()=>{
    if (worker.state === 'installed') {
      updateReady(worker);
    }
  });
};


/**
 * [fetch_neighborhoods fetch all neighborhoods and set their HTML]
 * @return {[Promise]} [resolves on successful neighborhood retrieval and rejects on error]
 */
const fetch_neighborhoods = () => {
  return DBHelper.fetch_neighborhoods().then(neighborhoods => {
    self.neighborhoods = neighborhoods;
    fillNeighborhoodsHTML();
  }).catch(error => {
    console.error('main.newfetchNeighborhoods error:', error);
    throw error;
  });
};

/**
 * Set neighborhoods HTML.
 */
const fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
const fetch_cuisines = () =>{
  return DBHelper.fetch_cuisines().then(cuisines => {
    self.cuisines = cuisines;
    fillCuisinesHTML();
  }).catch(error => {
    console.error('main.fetch_cuisines error:', error);
    throw error;
  });
};

/**
 * Set cuisines HTML.
 */
const fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  console.log('window.initMap called...');
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  google.maps.event.addListenerOnce(self.map, 'idle', Utils.fixIframe);
};

/**
 * Update page and map for current restaurants.
 */
const update_restaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  return DBHelper.fetch_restaurants_by_cuisine_and_neighborhood(cuisine, neighborhood).then(restaurants => {
    resetRestaurants(restaurants);
    fillRestaurantsHTML();
  }).catch(error => {
    console.error('main.update_restaurants error:', error);
    throw error;
  });
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
const resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
const fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
};

/**
 * Create restaurant HTML.
 */
const createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  li.className = 'list-item';
  li.tabIndex = '0';
  li.id = 'restaurant-'+restaurant.id;

  //construct picture element using restaurant info
  let picture = document.createElement('picture');
  picture.className = 'restaurant-img';
  picture.setAttribute('alt', restaurant.alt);
  Utils.assemblePictureHtml(picture, restaurant);
  li.append(picture);

  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  if(restaurant.is_favorite === 'true') {
    name.className = 'favorite-restaurant';
  }
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  // li.append(more);
  more.style = 'display: inline';

  const favorite = document.createElement('button');
  favorite.style = 'display: inline';
  if(restaurant.is_favorite === 'true'){
    favorite.className = 'favorite-btn favorite';
    favorite.title = 'Unfavorite '+restaurant.name;
    favorite.setAttribute('aria-label','unfavorite '+restaurant.name);
  }else{
    favorite.className = 'favorite-btn';
    favorite.title = 'Favorite '+restaurant.name;
    favorite.setAttribute('aria-label','favorite '+restaurant.name);
  }
  favorite.innerHTML = '★';
  favorite.onclick = toggle_favorite.bind(this, name, favorite, restaurant.id);
  // li.append(favorite);

  const span = document.createElement('span');
  span.className = 'restaurant-actions';
  span.append(more);
  span.append(favorite);
  li.append(span);

  return li;
};

const toggle_favorite = (name, favorite, id) => {
  DBHelper.fetch_restaurant_by_id(id).then(restaurant => {
    if(restaurant.is_favorite === "false"){//if not currently favorite, make favorite
      DBHelper.do_toggle_favorite_fetch(restaurant, "true").then(data => {
        if(data){
          favorite.className = 'favorite-btn favorite';
          favorite.title = 'Unfavorite '+name.innerHTML;
          favorite.setAttribute('aria-label','unfavorite '+name.innerHTML);
          name.className = 'favorite-restaurant';
        }else{
          console.error('main.toggle_favorite.do_toggle_favorite_fetch received no data...');
        }
      });

    }else{//if currently favorite, make not favorite
      DBHelper.do_toggle_favorite_fetch(restaurant, "false").then(data => {
        if(data){
          favorite.className = 'favorite-btn';
          favorite.title = 'Favorite '+name.innerHTML;
          favorite.setAttribute('aria-label','favorite '+name.innerHTML);
          name.className = '';
        }else{
          console.error('main.toggle_favorite.do_toggle_favorite_fetch received no data...');
        }
      });
    }
  }).catch(error => {
    console.error('toggle_favorite error:', error);
  });
};


/**
 * Add markers for current restaurants to the map.
 */
const addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url;
    });
    self.markers.push(marker);
  });
};
