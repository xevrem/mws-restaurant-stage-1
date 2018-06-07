/*global google IDB*/

/**
 * Common database helper functions.
 */
class DBHelper { //eslint-disable-line

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    //address & port information is not required for same-site locally hosted json data
    //this fixes mobile testing and non-8000 port hosting issues
    //const port = 8000 // Change this to your server port
    //return `http://localhost:${port}/data/restaurants.json`;
    //return '/data/restaurants.json';
    return 'http://localhost:1337/restaurants';
  }

  static open_db(callback){
    let database = new IDB('restaurants', 1);

    return database.open_db(idb => {
      //called on updatedb event to create store and its indicies
      idb.create_store('restaurants', {keyPath:'id'}, store => {
        store.create_index('id', 'id', {unique: true});
        store.create_index('cuisine', 'cuisine_type', {unique: false});
        store.create_index('neighborhood', 'neighborhood', {unique: false});
      });
    }).then(idb => {
      //we have a ready database, check to see if we just did an upgrade or not
      if(idb.upgraded){
        //we had an update, so load in data
        return DBHelper.do_base_fetch().then(data =>{
          return idb.transaction('restaurants', 'readwrite', callback).then(transaction => {
            let store = transaction.open_store('restaurants');
            let promises = data.map(restaurant => {
              return store.put(restaurant).then(result => {
                return result;
              });
            });
            //await all the puts to settle before returning database.
            return Promise.all(promises).then(values => {
              return idb;
            }).catch(error => {
              console.error('initial data load failed...', error);
            });
          }).catch(error => {
            console.error('error during initialization transaction', error);
          });
        }).catch(error => {
          console.error('error during do_base_fetch on upgrade', error);
        });
      } else{
        //no upgrade, so return database immediately
        return idb;
      }
    }).catch(error => {
      console.error('Database open error:', error);
      throw error;
    });
  }


  static do_base_fetch(){
    return fetch(DBHelper.DATABASE_URL).then(response => {
      return response.json();
    });
  }

  /**
   * [fetchRestaurants fetches the latest list of restaurants in json form]
   * @return {[Array]}       [Array of restaurants]
   */
  static fetch_restaurants(){
    //check IDB first
    if(!window.indexedDB){
      return DBHelper.do_base_fetch().then(data => {
        return data;
      }).catch(error =>{
        console.log('DBHelper.do_base_fetch error:',error);
        throw error;
      });
    }else{
      return DBHelper.open_db(idb => {
        console.log('blah');
        return idb.transaction('restaurants').then(transaction => {
          let store = transaction.open_store('restaurants');
          return store.get_all().then(results => {
            console.log('initial get_all...');
            return results;
          }).catch(error => {
            console.error('get_all error:', error);
            throw error;
          });
        }).catch(error =>{
          console.error('db transaction error:', error);
          throw error;
        });
      }).then(idb => {
        return idb.transaction('restaurants').then(transaction => {
          let store = transaction.open_store('restaurants');
          return store.get_all().then(results => {
            console.log('got all...');
            // callback(null, results);
            return results;
          }).catch(error => {
            console.error('get_all error:', error);
            throw error;
          });
        }).catch(error =>{
          console.error('db transaction error:', error);
          throw error;
        });
      }).catch(error => {
        console.error('DBHelper.open_db error:', error);
        throw error;
      });
    }
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetch_restaurant_by_id(id){
    return DBHelper.fetch_restaurants().then(restaurants => {
      const restaurant = restaurants.find(r => r.id == id);
      if (restaurant) return restaurant;
      throw 'restaurant does not exist';
    }).catch(error => {
      console.error('DBHelper.fetch_restaurant_by_id error:', error);
      throw error;
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetch_restaurants_by_cuisine(cuisine){
    return DBHelper.fetch_restaurants().then(restaurants => {
      const results = restaurants.filter(r => r.cuisine_type == cuisine);
      return results;
    }).catch(error => {
      console.error('DBHelper.fetch_restaurants_by_cuisine:', error);
      throw error;
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetch_restaurants_by_neighborhood(neighborhood){
    return DBHelper.fetch_restaurants().then(restaurants => {
      const results = restaurants.filter(r => r.neighborhood == neighborhood);
      return results;
    }).catch(error => {
      console.error('DBHelper.fetch_restaurants_by_neighborhood error:', error);
      throw error;
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetch_restaurants_by_cuisine_and_neighborhood(cuisine, neighborhood){
    return DBHelper.fetch_restaurants().then(restaurants => {
      let results = restaurants;
      if(cuisine != 'all') results = results.filter(r => r.cuisine_type == cuisine);
      if(neighborhood != 'all') results = results.filter(r => r.neighborhood == neighborhood);
      return results;
    }).catch(error => {
      console.error('DBHelper.fetch_restaurant_by_cuisine_and_neighborhood error:', error);
      throw error;
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetch_neighborhoods(){
    return DBHelper.fetch_restaurants().then(restaurants => {
      // Get all neighborhoods from all restaurants
      const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
      // Remove duplicates from neighborhoods
      const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
      return uniqueNeighborhoods;
    }).catch(error => {
      console.error('DBHelper.fetch_neighborhoods error', error);
      throw error;
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetch_cuisines(){
    return DBHelper.fetch_restaurants().then(restaurants => {
      // Get all cuisines from all restaurants
      const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
      // Remove duplicates from cuisines
      const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
      return uniqueCuisines;
    }).catch(error => {
      console.error('DBHelper.fetch_cuisines error:', error);
      throw error;
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

}
