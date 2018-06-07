/* global DBHelper Utils google */

/*eslint-disable*/
let restaurant;
var map;
/*eslint-enable*/

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

/**
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  //build reactive picture element
  let picture = document.getElementById('restaurant-img');
  picture.className = 'restaurant-img';
  picture.setAttribute('alt', restaurant.name);
  Utils.assemblePictureHtml(picture, restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
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
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = review.date;
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
