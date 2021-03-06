

/**
 * [IDB is a simplified wrapper to ease use of IndexedDB]
 */
class IDB{ //eslint-disable-line
  constructor(dbname, version){
    this.dbname = dbname;
    this.version = version;
    this.upgraded = false;
    this.old_version = -1;
  }

  /**
   * [open_db attempts to open the database for use]
   * @param  {[Function]} [on_upgrade=null] [callback that is used when IndexedDB requires an upgrade]
   * @return {[Promise]}                    [a Promise resolving upon successful database opening or rejecting on error]
   */
  open_db(on_upgrade=null){
    let request = window.indexedDB.open(this.dbname, this.version);
    let idb = this;

    return new Promise(function(resolve, reject){
      //handle successful database opening
      request.onsuccess = function(event){
        // console.log('open_db onsuccess called...');
        idb.db = event.target.result;
        resolve(idb);
      };

      //handle errors on database opening
      request.onerror = function(event){
        // console.log('open_db onerror called...');
        let error = event.target.error;
        reject(error);
      };

      //if provided, allow for database upgrading
      if(on_upgrade){
        request.onupgradeneeded = function(event){
          // console.log('open_db onupgradeneeded called...');
          idb.upgraded = true;
          idb.db = event.target.result;
          idb.old_version = event.oldVersion;
          on_upgrade(idb);
        };
      }
    });
  }

  /**
   * [create_store description]
   * @param  {[string]} name     [name of store to create]
   * @param  {[object]} options  [options for store]
   * @param  {Function} callback [callback used to make modifications to store]
   * @return {[Promise]}         [Promise that resolves upon sucessful store creation and rejects on error]
   */
  create_store(name, options=null, callback=null){
    let idb = this;
    console.log('create_store called...');
    return new Promise(function(resolve, reject){
      let object_store;
      if(options){
        object_store = new ObjectStore(idb.db.createObjectStore(name, options), name);
      }else{
        object_store = new ObjectStore(idb.db.createObjectStore(name), name);
      }

      //if everything goes well, resolve the promise
      object_store.store.transaction.oncomplete = function(){
        console.log('create_store onsuccess called...');
        resolve(idb);
      };

      console.log('initial store created...');
      try{
        //store has been created, provide the store for manipulation
        if(callback){
          callback(object_store);
        }
      }catch(error){
        console.error('error during store creation...', error);
        reject(error);
      }
    });
  }

  /**
   * [transaction initiates an idb transaction]
   * @param  {[string|Array]} stores  [string of store or array of stores that the transaction will act upon]
   * @param  {[string]} [mode='readonly']     [transaction mode]
   * @param  {[type]} [callback=null] [callback called upon transaction completion]
   * @return {[Promise]}                 [Promse that resolves with a Transaction or rejects on error]
   */
  transaction(stores, mode='readonly', callback=undefined){
    let transaction = new Transaction(this, this.db.transaction(stores, mode), callback);
    return transaction.promisify();
  }


}

/**
 * [Transaction manages IndexeDB transactions]
 */
class Transaction{
  /**
   * [constructor Transaction manages IndexeDB transactions]
   * @param {[type]} idb                  [a reference to IDB]
   * @param {[IDBTransaction]} transaction          [the IDBTransaction this class wraps]
   * @param {[type]} [callback=undefined] [callback called when transaction's oncomplete event is fired]
   */
  constructor(idb, transaction, callback=undefined){
    this.idb = idb;
    this.transaction = transaction;
    this.callback = callback;
  }

  /**
   * [promisify turns the IDBTransaction into a promise]
   * @return {[Promise]} [Promise that resolves immediately with itself or rejects on error]
   */
  promisify(){
    return new Promise(function(resolve, reject){
      this.transaction.oncomplete = function(){
        //console.log('transaction complete...');
        if(this.callback) this.callback(this.idb);
      }.bind(this);

      this.transaction.onerror = function(event){
        // console.log('transaction onerror...');
        reject(event.target);
      };

      this.transaction.onabort = function(event){
        // console.log('transaction onabort...');
        reject(event.target);
      };

      try{
        resolve(this);
      }catch(error){
        reject(error);
      }
    }.bind(this));
  }

  /**
   * [open_store opens the given store for this transaction]
   * @param  {[string]} name [name of store to open]
   * @return {[Promise]}      [Promes that resolves to the store or rejects on error]
   */
  open_store(name){
    let store = new ObjectStore(this.transaction.objectStore(name));
    return store;
  }

  /**
   * [abort calls the underlying IDBTransaction's abort method]
   */
  abort(){
    this.transaction.abort();
  }
}

/**
 * [ObjectStore manages object store access]
 */
class ObjectStore{
  /**
   * [constructor ObjectStore manages object store access]
   * @param {[IDBObjectStore]} store [the IDBObjectStore object this wraps]
   * @param {[string]} name  [the name of the store]
   */
  constructor(store, name){
    this.store = store;
    this.name = name;
  }

  /**
   * [create_index creates an index within the store]
   * @param  {[string]} index_name        [the name of the index to be created]
   * @param  {[string]} key_path          [the key that is being indexed]
   * @param  {[object]} [parameters=null] [additional index parameters]
   */
  create_index(index_name, key_path, parameters=null){
    this.store.createIndex(index_name, key_path, parameters);
  }

  /**
   * [add adds a key-value item to the store]
   * @param {[object]} value  [a value object to be added to the store]
   * @param {[string]} [key=undefined]   [key the item should be stored at]
   * @return {[Promise]}    [Promes that resolves on success or rejects on error]
   */
  add(value, key=undefined){
    let request = new IdbRequest(this.store.add(value, key));
    return request.promisify();
  }

  /**
   * [put updates/adds a key-value item to the store]
   * @param {[object]} value  [a value object to be updated/added to the store]
   * @param {[string]} [key=undefined]   [key the item should be stored at]
   * @return {[Promise]}    [Promes that resolves on success or rejects on error]
   */
  put(value, key=undefined){
    let request = new IdbRequest(this.store.put(value, key));
    return request.promisify();
  }

  /**
   * [get a value with the given key]
   * @param  {[string]} key [key of the value you want to get]
   * @return {[Promise]}     [Promise that resolves to the record or rejects on error]
   */
  get(key){
    let request = new IdbRequest(this.store.get(key));
    return request.promisify();
  }

  /**
   * [get_all values in a given store]
   * @return {[Promise]} [Promise that resolves to the records or rejects on error]
   */
  get_all(){
    let request = new IdbRequest(this.store.getAll());
    return request.promisify();
  }

  /**
   * [index get index in the store with a given name]
   * @param  {[string]} name [name of index to retrieve]
   * @return {[Index]}      [the index desired]
   */
  index(name){
    let index = new Index(this.store.index(name));
    return index;
  }

  /**
   * [delete value with provided key]
   * @param  {[string]} key [key of record desired to be deleted]
   * @return {[Promise]}     [Promise that resolves on deletion or rejects on error]
   */
  delete(key){
    let request = new IdbRequest(this.store.delete(key));
    return request.promisify();
  }

  /**
   * [clear removes all records from the store]
   * @return {[Promise]} [Promise that resolves on clear or rejects on error]
   */
  clear(){
    let request = new IdbRequest(this.store.clear());
    return request.promisify();
  }

}

/**
 * [Index IDBIndex wrapper]
 */
class Index{
  /**
   * [constructor IDBIndex wrapper]
   * @param {[IDBIndex]} index [the IDBIndex being wrapped]
   */
  constructor(index){
    this.index = index;
  }

  /**
   * [cursor gets the cursor of the index and calls the callback on success]
   * @param  {Function} callback [callback called when cursor onsuccess event is fired]
   * @return {[Promise]}            [Promise that resolves when cursor has no more records or rejects on error]
   */
  open_cursor(callback, query=undefined){
    let cursor = new Cursor(this.index.openCursor(query), callback);
    return cursor.promisify();
  }

  open_key_cursor(callback, query=undefined){
    let cursor = new Cursor(this.index.openKeyCursor(query), callback);
    return cursor.promisify();
  }
}


/**
 * [Cursor is a wrapper around a IDBCursor]
 */
class Cursor{
  /**
   * [constructor a wrapper around a IDBCursor]
   * @param {[IDBCursor]}   cursor   [the IDBCursor being wrapped]
   * @param {Function} callback [callback called when cursor onsuccess event is fired]
   */
  constructor(cursor, callback){
    this.cursor = cursor;
    this.callback = callback;
  }

  /**
   * [promisify turns the IDBCursor into a promise]
   * @return {[Promise]} [Promise that resolves when cursor has no more records or rejects on error]
   */
  promisify(){
    return new Promise(function(resolve, reject){
      this.cursor.onsuccess = function(event){
        if(event.target.result){
          if(this.callback) this.callback(event.target.result);
        }else{
          resolve();
        }
      }.bind(this);

      this.cursor.onerror = function(event){
        reject(event.target);
      };

    }.bind(this));
  }

}

/**
 * [IdbRequest wrapper around an IDBRequest]
 */
class IdbRequest{
  /**
   * [constructor wrapper around an IDBRequest]
   * @param {[IDBRequest]} request [IDBRequest being wrapped]
   */
  constructor(request){
    this.request = request;

  }

  /**
   * [promisify turns the IDBCursor into a promise]
   * @return {[Promise]} [Promise that resolves on success or rejects on error]
   */
  promisify(){
    return new Promise(function(resolve, reject){
      this.request.onsuccess = function(event){
        resolve(event.target.result);
      };
      this.request.onerror = function(event){
        reject(event.target.error);
      };
    }.bind(this));
  }
}
