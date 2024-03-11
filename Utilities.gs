function test() {
  const accessJwt = getAccessJwt(BLUESKY_IDENTIFIER, BLUESKY_PASSWORD);
  const response = getPosts(accessJwt, BLUESKY_IDENTIFIER);
  Logger.log(response.feed.length);

  const postInfo = response.feed[2].post;
  const result = postInfo.embed.media.images[0].fullsize;
  const postIds = response.feed.map((elm) => elm.post.record.text); // postInfo.embed.images[0].fullsize;

  Logger.log(Object.keys(result));
  Logger.log(result);
}

function test2() {
  const service = getService1();
  const movieUrl = "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:nsaqh4fei7dagrxc4l2tyeum/bafkreieboxl3wpwt2qxr43g32wripzcwjvqleyrfkb6cbhsafsebmpj3ra@jpeg";
  let imgUrl = movieUrl;

  var imgBlob = UrlFetchApp.fetch(imgUrl).getBlob().getBytes();
  var img_64  = Utilities.base64Encode(imgBlob);

  var img_option = { 
    'method' : "POST", 
    payload: {
      media_data: img_64,
      // media: imgBlob,
    },
    muteHttpExceptions: true,
  };
  var endPointMedia  = "https://upload.twitter.com/1.1/media/upload.json";

  const func = (a,b) => service.fetch(a,b);
  // var image_upload = JSON.parse(func(endPointMedia, img_option));
  // let result = image_upload['media_id_string'];
  result = uploadImage(imgUrl);
  Logger.log(result);
}

function toBoolean(booleanStr) {
  // "true"文字列と比較した結果を返す
  // 念のため小文字化しておく
  return booleanStr.toLowerCase() === "true";
}

function paddingArray(array, pad = "") {
  array.forEach((elm) => {
    while (elm.length < array[0].length) elm.push(pad);
  });
  return array;
}

const alphabets = Array.apply(null, new Array(26)).map((v, i) => {
  return String.fromCharCode("A".charCodeAt(0) + i);
});

function fetchUrl(_url, _options, func = UrlFetchApp.fetch) {
  return fetchUrlNTimes(_url, _options, 1, func);
}

function fetchUrlNTimes(url, options, n, func = UrlFetchApp.fetch) {
  const tweetAttemptNum = n;
  let response = {};
  for (let i = 0; i < tweetAttemptNum; i++) {
    try {
      response = func(url, options);
      // Utilities.sleep(100);
      return response;
    } catch (e) {
      if (i == tweetAttemptNum - 1) {
        throw new Error(
          "Failed accessing to " +
            url +
            " with option \n" +
            options +
            " \n" +
            i +
            " times. \n response: " +
            response.getContentText() +
            "\n error: " +
            e.message
        );
      }
      console.error(e.message);
      Utilities.sleep(1000);
      continue;
    }
  }
}

function makeCache() {
  // use cacheservice
  const cache = CacheService.getUserCache();
  return {
    get: function (key) {
      return JSON.parse(cache.get(key));
    },
    put: function (key, value, sec) {
      //リファレンスよりcache.putの3つ目の引数は省略可。
      //デフォルトでは10分間（600秒）保存される。最大値は6時間（21600秒）
      cache.put(key, JSON.stringify(value), sec === undefined ? 21500 : sec);
      return value;
    },
  };

  /*
  // use userProperty
  const userProperties = PropertiesService.getUserProperties();
  return {
    get: function (key) {
      return JSON.parse(userProperties.getProperty(key));
    },
    put: function (key, value) {
      userProperties.setProperty(key, JSON.stringify(value)); // stored permanently
    },
  };
  */
}

function updateCache(key = "mySheet", value = null) {
  value = value == null ? getMySheet("", false) : value;
  const cache = makeCache();
  cache.put(key, value);
}
