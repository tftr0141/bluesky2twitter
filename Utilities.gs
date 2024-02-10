function test() {
  const accessJwt = getAccessJwt(BLUESKY_IDENTIFIER, BLUESKY_PASSWORD);
  const response = getPosts(accessJwt, BLUESKY_IDENTIFIER);

  const postInfo = response.feed[0].post;

  /*
  const aturi = postInfo.uri;
  const posturi = `https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${aturi}`;
  const options = {
    "method": "get",
    "contentType": "application/json",
    "headers": {
      "Authorization": `Bearer ${accessJwt}`
    },
  };
  const responseForPhoto = fetchUrl(posturi, options);
  const responseForPhotoJSON = JSON.parse(responseForPhoto.getContentText());
  */
  // responseForPhotoJSON.thread.post.author.handle
  const objective = postInfo.embed.record.record;
  Logger.log(Object.keys(objective));
  Logger.log(objective);
}

function test2() {
  url = "";
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

function createTimeoutPromise(timeoutMilliseconds) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Operation timed out"));
    }, timeoutMilliseconds);
  });
}
