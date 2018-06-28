/* global DBHelper Utils google */

/*eslint-disable*/
var restaurant;
var map;
var favorite_restaurant;
/*eslint-enable*/

document.addEventListener('DOMContentLoaded', () => {
  if(document.cookie){
    favorite_restaurant = Utils.parse_cookie().favorite;
  }
});

let reloading = false;

window.addEventListener('load', () => {
  if(!navigator.serviceWorker) return;

  navigator.serviceWorker.getRegistration().then(registration =>  {
    if(!registration){
      navigator.serviceWorker.register('/service_worker.js', {scope:'./'}).then(registration=>{
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

      //if the current service worker has changed, reload this page
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        //console.log('reloading...');
        window.location.reload();
        reloading = true;
      });
    }else{
      console.log('sw registered!');
    }
  });

  //
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
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetch_restaurant_from_url().then(restaurant => {
    self.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 16,
      center: restaurant.latlng,
      scrollwheel: false
    });
    fillBreadcrumb();
    DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    google.maps.event.addListenerOnce(self.map, 'idle', Utils.fixIframe);
  }).catch(error => {
    console.error('restaurant_info.window.init error:',error);
  });
};

/**
 * Get current restaurant from page URL.
 */
const fetch_restaurant_from_url = () => {
  return new Promise(function(resolve,reject){
    if(self.restaurant) resolve(self.restaurant);

    const id = getParameterByName('id');

    if(!id) {
      reject('no restaurant id in URL');
    }
    else{
      return DBHelper.fetch_restaurant_by_id(id).then(restaurant => {
        self.restaurant = restaurant;
        fillRestaurantHTML();
        resolve(restaurant);
      }).catch(error => {
        console.error('restaurant_info.fetch_restaurant_from_url error:', error);
      });
    }
  });
};

const fetch_reviews_by_id = (id) => {
  return new Promise(function(resolve, reject){
    return DBHelper.fetch_reviews_by_id(id).then(reviews => {
      resolve(reviews);
    }).catch(error => {
      console.error('restaurant_info.fetch_reviews_by_id error:', error);
      reject(error);
    });
  });
};

/**
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  if(favorite_restaurant == restaurant.id) {
    name.className = 'favorite-restaurant';
  }

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  //build reactive picture element
  let picture = document.getElementById('restaurant-img');
  picture.className = 'restaurant-img';
  picture.setAttribute('alt', restaurant.alt);
  Utils.assemblePictureHtml(picture, restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }

  //create favorite button
  const favorite = document.getElementById('favorite-btn');
  if(favorite_restaurant == restaurant.id){
    favorite.className = 'favorite-btn favorite';
    favorite.title = 'Unfavorite '+restaurant.name;
    favorite.setAttribute('aria-label','unfavorite '+restaurant.name);
  }else{
    favorite.className = 'favorite-btn';
    favorite.title = 'Favorite '+restaurant.name;
    favorite.setAttribute('aria-label','favorite '+restaurant.name);
  }
  favorite.innerHTML = '★';
  favorite.onclick = toggle_favorite;

  //do restaurant reviews pull
  fetch_reviews_by_id(restaurant.id).then(reviews => {
    fillReviewsHTML(reviews);
  }).catch(error => {
    console.error('failed fetching reviews, error:', error);
    // fill reviews
    fillReviewsHTML();
  });
};

const toggle_favorite = () => {
  const name = document.getElementById('restaurant-name');
  const favorite = document.getElementById('favorite-btn');
  if(favorite_restaurant != restaurant.id){
    console.log('favorite...');
    name.className = 'favorite-restaurant';
    favorite_restaurant = restaurant.id;
    favorite.className = 'favorite-btn favorite';
    favorite.title = 'Unfavorite '+ restaurant.name;
    favorite.setAttribute('aria-label','unfavorite '+restaurant.name);
    Utils.set_cookie('favorite', restaurant.id);
  }else{
    console.log('unfavorite...');
    name.className = '';
    favorite_restaurant = -1;
    favorite.className = 'favorite-btn';
    favorite.title = 'Favorite '+restaurant.name;
    favorite.setAttribute('aria-label','favorite '+restaurant.name);
    Utils.set_cookie('favorite', -1);
  }
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
const fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
const fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
const createReviewHTML = (review) => {
  const li = document.createElement('li');
  li.tabIndex = '0';

  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toUTCString();
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
const fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.tabIndex = '0';
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
const getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');//eslint-disable-line
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};
