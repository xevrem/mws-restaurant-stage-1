/* global DBHelper */

/**
 * [Utils offers several utility classes used in several areas of the application]
 */
class Utils{ //eslint-disable-line
  /*
  *  Constructs a picture element with the following structure
  *  <picture alt=''>
  *    <source srcset="/img/1.jpg" media="(min-width: 601px)">
  *    <source srcset="/img/1_md.jpg" media="(min-width: 401px)">
  *    <img src="/img/1_sm.jpg" alt="restaurant">
  *  </picture>
  */
  static assemblePictureHtml(picture, restaurant){
    let imageName = DBHelper.imageUrlForRestaurant(restaurant)+'.jpg';

    let lg = document.createElement('source');
    lg.setAttribute('srcset', imageName);
    lg.setAttribute('media', '(min-width: 601px)');
    picture.append(lg);

    let mdName = imageName.split('.jpg')[0] + '_md.jpg';
    let md = document.createElement('source');
    md.setAttribute('srcset', mdName);
    md.setAttribute('media', '(min-width: 401px)');
    picture.append(md);

    let smName = imageName.split('.jpg')[0] + '_sm.jpg';
    let img = document.createElement('img');
    img.className = 'restaurant-img';
    img.src = smName;
    img.setAttribute('alt', restaurant.alt);
    picture.append(img);

    return picture;
  }

  /*
  * Fixes broken google maps iframe titles
  */
  static fixIframe(){
    const iframe = document.getElementsByTagName('iframe')[0];
    //console.log(iframe);
    iframe.setAttribute('title', 'Map of New York Restaurants');
  }
}
