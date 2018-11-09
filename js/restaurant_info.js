/* global DBHelper Utils google */

/*eslint-disable*/
var restaurant;
var map;
/*eslint-enable*/

document.addEventListener('DOMContentLoaded', () => {
  DBHelper.open_db().then(idb=>{
    let id = getParameterByName('id');
    DBHelper.refresh_restaraunt_reviews(idb, id).then(()=>{
      console.log('database reviews refreshed...');
    }).catch(error => {
      console.error('DOMContentLoaded reviews refresh error:', error);
    });
  });

  //setup form submission handling
  let form = document.getElementById('review-form');
  form.addEventListener('submit', handle_form_submit);
});

window.addEventListener('online', event => {
  console.log('online', navigator.onLine);
  DBHelper.do_submit_offline_reviews();
});

window.addEventListener('offline', event => {
  console.log('offline', navigator.onLine);
});


/**
 * [handle_form_submit handles the onsubmit event from the review form]
 * @param  {[event]} event [form onsubmit event]
  */
const handle_form_submit = event => {
  //stop page reloading
  event.preventDefault();
  //assemble the form data
  let form_data = {
    restaurant_id: restaurant.id,
    name: document.forms['review-form'].name.value,
    rating: parseInt(document.forms['review-form'].rating.value, 10),
    comments: document.forms['review-form'].comments.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  // console.log('form submitted...', form_data);
  if(navigator.onLine){
    //navigator is online, do normal processing
    do_online_form_processing(form_data);
  }else{
    //navigator is offline, do offline processing
    do_offline_form_processing(form_data);
  }
};

const do_online_form_processing = (form_data) => {
  // attempt submit the data to the server and local db.
  DBHelper.do_submit_review_fetch(restaurant.id, form_data).then(() => {
    //immediately add the review to the list and clear the form data
    add_review_html(form_data);
    document.forms['review-form'].name.value = '';
    document.forms['review-form'].rating.value = '';
    document.forms['review-form'].comments.value = '';
  }).catch(error => {
    console.error('do_online_form_processing.do_submit_review_fetch error', error);
  });
};

const do_offline_form_processing = (form_data) => {
  DBHelper.store_review_offline(restaurant.id, form_data).then(() => {
    //immediately add the review to the list and clear the form data
    add_review_html(form_data);
    document.forms['review-form'].name.value = '';
    document.forms['review-form'].rating.value = '';
    document.forms['review-form'].comments.value = '';
  }).catch(error => {
    console.error('do_offline_form_processing.do_submit_review_fetch error', error);
  });
};

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
  if(restaurant.is_favorite === 'true') {
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
  favorite.onclick = toggle_favorite.bind(this, restaurant.id);

  //do restaurant reviews pull
  fetch_reviews_by_id(restaurant.id).then(reviews => {
    fillReviewsHTML(reviews);
    //if offline, fetch and build any stored offline reviews
    if(!navigator.onLine){
      DBHelper.fetch_offline_reviews(restaurant.id).then(offline_reviews => {
        offline_reviews.forEach(offline_review => {
          add_review_html(offline_review);
        });
      }).catch(error => {
        console.error('fillRestaurantHTML fetch_offline_reviews error:',error);
      });
    }
  }).catch(error => {
    console.error('failed fetching reviews, error:', error);
    // fill reviews
    fillReviewsHTML();
  });
};

const toggle_favorite = (id) => {
  const name = document.getElementById('restaurant-name');
  const favorite = document.getElementById('favorite-btn');
  DBHelper.fetch_restaurant_by_id(id).then(restaurant => {
    if(restaurant.is_favorite === 'false'){ //not currently favorite
      console.log('favorite...');
      DBHelper.do_toggle_favorite_fetch(restaurant, "true").then(data => {
        if(data){
          name.className = 'favorite-restaurant';
          // favorite_restaurant = restaurant.id;
          favorite.className = 'favorite-btn favorite';
          favorite.title = 'Unfavorite '+ restaurant.name;
          favorite.setAttribute('aria-label','unfavorite '+restaurant.name);
        }else{
          console.error('restaraunt_info.toggle_favorite.do_toggle_favorite_fetch received no data...');
        }
      });
    }else{//currently favorite
      console.log('unfavorite...');
      DBHelper.do_toggle_favorite_fetch(restaurant, "false").then(data => {
        if(data){
          name.className = '';
          // favorite_restaurant = -1;
          favorite.className = 'favorite-btn';
          favorite.title = 'Favorite '+restaurant.name;
          favorite.setAttribute('aria-label','favorite '+restaurant.name);
        }else{
          console.error('restaraunt_info.toggle_favorite.do_toggle_favorite_fetch received no data...');
        }
      });
    }
  }).catch(error => {
    console.error('toggle_favorite error:', error);
  });


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
  // const title = document.createElement('h2');
  // title.innerHTML = 'Reviews';
  // container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  try{
    reviews.forEach(review => {
      ul.appendChild(createReviewHTML(review));
    });
  }catch(error){
    console.log('createReviewHTML error:', error);
  }

  container.appendChild(ul);
};

const add_review_html = (review) => {
  //dont attempt to add nothing
  if(!review) return;

  const ul = document.getElementById('reviews-list');
  ul.append(createReviewHTML(review));
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
