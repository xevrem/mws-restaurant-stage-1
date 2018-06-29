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
    return 'http://localhost:1337/restaurants/';
  }

  static get DATABASE_REVIEWS_URL(){
    return 'http://localhost:1337/reviews/';
  }

  // static open_db(callback){
  static open_db(){
    let database = new IDB('restaurants', 3);

    return database.open_db(idb => {
      //called on updatedb event to create store and its indicies
      switch(idb.old_version){
        case 0://create restaurants store
          console.log('creating restaurants');
          idb.create_store('restaurants', {keyPath:'id'}, store => {
            store.create_index('id', 'id', {unique: true});
            store.create_index('cuisine', 'cuisine_type', {unique: false});
            store.create_index('neighborhood', 'neighborhood', {unique: false});
          });
          //falls through
        case 1://create reviews store
          console.log('creating reviews');
          idb.create_store('reviews', {keyPath:'id'}, store => {
            store.create_index('id', 'id', {unique: true});
            store.create_index('restaurant_id', 'restaurant_id', {unique: false});
          });
          //falls through
        case 2://create offline staging store
          console.log('creating offline staging');
          idb.create_store('offline', {keyPath:'name'});
      }
    }).then(idb => {
      //we have a ready database, check to see if we just did an upgrade or not
      if(idb.upgraded){
        //we had an update, so load in data
        //setup the base restaurants data fetch promise
        let restaurants_fetch = DBHelper.refresh_restaurants(idb);
        //setup the base reviews data fetch promise
        let reviews_fetch = DBHelper.refresh_reviews(idb);

        //let both data fetches settle before returning
        return Promise.all([restaurants_fetch, reviews_fetch]).then(() => {
          return idb;
        }).catch(error => {
          console.error('dbhelper.opend_db upgrade error:', error);
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


  /**
   * [do_base_fetch performs the basic restaurants data fetch]
   * @return {[Object]} [object representing the json restaurants data]
   */
  static do_base_fetch(){
    return fetch(DBHelper.DATABASE_URL, {cache: 'no-cache'}).then(response => {
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
        console.error('DBHelper.do_base_fetch error:',error);
        throw error;
      });
    }else{
      return DBHelper.open_db().then(idb => {
        return idb.transaction('restaurants').then(transaction => {
          let store = transaction.open_store('restaurants');
          return store.get_all().then(results => {
            console.log('got all restaurants...');
            return results;
          }).catch(error => {
            console.error('fetch_restaurants get_all error:', error);
            throw error;
          });
        }).catch(error =>{
          console.error('fetch_restaurants db transaction error:', error);
          throw error;
        });
      }).catch(error => {
        console.error('fetch_restaurants open_db error:', error);
        throw error;
      });
    }
  }

  /**
   * [do_base_reviews_fetch perofms the base reviews data fetch]
   * @return {[Object]} [object representing the json reviews data]
   */
  static do_base_reviews_fetch(){
    return fetch(DBHelper.DATABASE_REVIEWS_URL, {cache: 'no-cache'}).then(response => {
      return response.json();
    });
  }

  static fetch_reviews(id){
    if(!window.indexedDB){
      DBHelper.do_base_restaurant_reviews_fetch(id).then(data => {
        return data;
      }).catch(error => {
        console.error('DBHelper.do_base_restaurant_reviews_fetch error:', error);
      });
    }else{
      return DBHelper.open_db().then(idb => {
        return idb.transaction('reviews').then(transaction => {
          let store = transaction.open_store('reviews');
          // return store.get_all().then(results => {
          //   console.log('got all reviews...');
          //   return results;
          // }).catch(error => {
          //   console.error('fetch_reviews get_all error:', error);
          //   throw error;
          // });
          let index = store.index('restaurant_id');
          let data = [];
          return index.open_cursor(cursor => {
            // console.log('cursor value:', cursor.value);
            data.push(cursor.value);
            cursor.continue();
          }, IDBKeyRange.only(id)).then(() => {
            // console.log('final cursor data:', data);
            return data;
          }).catch(error => {
            console.error('fetch_reviews cursor error:', error);
          });
        }).catch(error =>{
          console.error('fetch_reviews db transaction error:', error);
          throw error;
        });
      }).catch(error => {
        console.error('fetch_reviews open_db error', error);
      });
    }
  }

  static refresh_restaurants(idb){
    return DBHelper.do_base_fetch().then(data =>{
      //issue transaction to populate the data and then call the callback
      //after the initial data load transaction has completed
      // return idb.transaction('restaurants', 'readwrite', callback).then(transaction => {
      return idb.transaction('restaurants', 'readwrite').then(transaction => {
        let store = transaction.open_store('restaurants');
        let promises = data.map(restaurant => {
          return store.put(restaurant).then(result => {
            return result;
          });
        });
        //await all the puts to settle before returning database.
        return Promise.all(promises).then(() => {
          return idb;
        }).catch(error => {
          console.error('initial restaurants data load failed...', error);
        });
      }).catch(error => {
        console.error('error during restaurants initialization transaction', error);
      });
    }).catch(error => {
      console.error('error during do_base_fetch on upgrade', error);
    });


  }

  static refresh_reviews(idb){
    return DBHelper.do_base_reviews_fetch().then(data => {
      return idb.transaction('reviews', 'readwrite').then(transaction => {
        let store = transaction.open_store('reviews');
        let promises = data.map(review => {
          return store.put(review).then(result => {
            return result;
          });
        });
        //await all the puts to settle before returning database.
        return Promise.all(promises).then(() => {
          return idb;
        }).catch(error => {
          console.error('initial reviews data load failed...', error);
        });
      }).catch(error => {
        console.error('error during reviews initialization transaction', error);
      });
    }).catch(error => {
      console.error('error during do_base_reviews_fetch on upgrade', error);
    });
  }

  static do_base_restaurant_reviews_fetch(id){
    let endpoint = `http://localhost:1337/reviews/?restaurant_id=${id}`;
    return fetch(endpoint, {cache:'no-cache'}).then(response =>{
      return response.json();
    });
  }

  static refresh_restaraunt_reviews(idb, id){
    return DBHelper.do_base_restaurant_reviews_fetch(id).then(data => {
      // console.log('reviews:',data);
      return idb.transaction('reviews', 'readwrite').then(transaction => {
        let store = transaction.open_store('reviews');
        let promises = data.map(review => {
          return store.put(review).then(result => {
            return result;
          });
        });
        //await all the puts to settle before returning database.
        return Promise.all(promises).then(() => {
          console.log('reviews refreshed');
          return idb;
        }).catch(error => {
          console.error('restaurant reviews refresh failed:', error);
        });
      }).catch(error => {
        console.error('refresh_restaraunt_reviews transaction error:', error);
      });
    });
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

  static fetch_reviews_by_id(id){
    return DBHelper.fetch_reviews(id).then(reviews => {
      // const reviews = data.filter(r => r.restaurant_id == id);
      if (reviews) return reviews;
      return undefined;
    }).catch(error => {
      console.error('DBHelper.fetch_restaurant_by_id error:', error);
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
    return (`/img/${restaurant.id}`);
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

  static do_toggle_favorite_fetch(restaurant, value){
    let endpoint = DBHelper.DATABASE_URL+`${restaurant.id}/?is_favorite=${value}`;
    // console.log('endoint:',endpoint);
    return fetch(endpoint, {
      method:'PUT',
    }).then(response => {
      if(response.ok) console.log('server record updated...');
      return response.json().then(data => {
        return DBHelper.update_restaurant_record(data).then(is_successful => {
          if(is_successful) console.log('local record updated...');
          return data;
        });
      });
    }).catch(error => {
      console.error('DBHelper.do_toggle_favorite_fetch failed... error:', error);
    });
  }

  static update_restaurant_record(restaurant){
    return DBHelper.open_db().then(idb => {
      return idb.transaction('restaurants', 'readwrite').then(transaction => {
        let store = transaction.open_store('restaurants');
        return store.put(restaurant).then(result => {
          return result;
        }).catch(error => {
          console.error('dbhelper.update_restaurant_record.put error:',error);
        });
      }).catch(error => {
        console.error('dbhelper.update_restaurant_record transaction error:', error);
      });
    });
  }

  static update_review_record(review){
    return DBHelper.open_db().then(idb => {
      return idb.transaction('reviews', 'readwrite').then(transaction => {
        let store = transaction.open_store('reviews');
        return store.put(review).then(result => {
          return result;
        }).catch(error => {
          console.error('dbhelper.update_restaurant_record.put error:',error);
        });
      }).catch(error => {
        console.error('dbhelper.update_restaurant_record transaction error:', error);
      });
    });
  }

  static do_submit_review_fetch(id, data){
    return fetch(DBHelper.DATABASE_REVIEWS_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(response => {
      console.log('response:',response);
      return response.json().then(data=>{
        console.log('data:',data);
        return DBHelper.update_review_record(data).then(on_success => {
          console.log('success?', on_success);
        });
      });
    }).catch(error => {
      console.error('dbhelper.do_submit_review_fetch error...', error);
    });
  }

  static do_submit_offline_reviews(){
    DBHelper.open_db().then(idb => {
      idb.transaction('offline').then(transaction => {
        let store = transaction.open_store('offline');
        store.get_all().then(records => {
          //if no records, nothing to do
          if(records.length <= 0) return;

          //create promise array to process
          let promises = records.map(record => {
            return DBHelper.do_submit_review_fetch(record.restaurant_id, record);
          });

          Promise.all(promises).then(values => {
            console.log('dbhelper.do_submit_offline_reviews completed', values);
            idb.transaction('offline', 'readwrite').then(transaction => {
              let clear_store = transaction.open_store('offline');
              clear_store.clear().then(()=>{
                console.log('offline successfully cleared...');
              }).catch(error => {
                console.error('dbhelper.do_submit_offline_reviews clear error:', error);
              });
            }).catch(error => {
              console.error('dbhelper.do_submit_offline_reviews transaction error:', error);
            });
          });
        }).catch(error => {
          console.error('dbhelper.do_submit_offline_reviews get_all error:', error);
        });
      }).catch(error => {
        console.error('dbhelper.do_submit_offline_reviews transaction error:', error);
      });
    });
  }

  static store_review_offline(id, form_data){
    return DBHelper.open_db().then(idb => {
      return idb.transaction('offline', 'readwrite').then(transaction => {
        let store = transaction.open_store('offline');
        return store.put(form_data).then(() => {
          return;
        });
      }).catch(error => {
        console.error('dbhelper.store_review_offline transaction error:', error);
      });
    });
  }

  static fetch_offline_reviews(id){
    return DBHelper.open_db().then(idb => {
      return idb.transaction('offline').then(transaction => {
        let store = transaction.open_store('offline');
        return store.get_all().then(reviews => {
          return reviews.filter(r => r.restaurant_id == id);
        }).catch(error => {
          console.error('dbhelper.fetch_offline_reviews get_all error:', error);
        });
      }).catch(error => {
        console.error('dbhelper.fetch_offline_reviews transaction error:', error);
      });
    }).catch(error => {
      console.error('dbhelper.fetch_offline_reviews open_db error:', error);
    });
  }
}
