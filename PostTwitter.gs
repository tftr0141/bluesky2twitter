////////////////////    twitter authentication    ///////////////////////

function SendPostsToTwitter() {
  let isTweeted = false;

  const sheetData = getMySheet();
  const sheetRowsIndex = new mySheetRowsIndex(sheetData);
  
  const tweetIds = [];
  const postIdValues = sheetData.map((elm) => elm[0]);

  const postValues = JSON.parse(JSON.stringify(sheetData)); // deepcopy array
  postValues.splice(0, 1);

  const twitterPostedIds = [];

  postValues.forEach((post) => {
    const postId = post[sheetRowsIndex.postId];
    const parentAuthor = post[sheetRowsIndex.parentAuthorHandle];
    const text = post[sheetRowsIndex.text];
    const isRepost = toBoolean(post[sheetRowsIndex.isRepost]);
    const isReply = toBoolean(post[sheetRowsIndex.isReplyId]);
    const isIncludeEmbed = toBoolean(post[sheetRowsIndex.isIncludeEmbed]);
    let isIgnore = toBoolean(post[sheetRowsIndex.isIgnore]) || postId === "";
    const isTwitterPosted = toBoolean(post[sheetRowsIndex.isTwitterPosted]);
    const imageUrl = post[sheetRowsIndex.imageUrl];
    const parentId = post[sheetRowsIndex.parentId];

    let replyParentTweetId = "";
    if (isReply) {
      const parentPostIndex = postIdValues.indexOf(parentId);

      if (parentPostIndex == -1 || parentAuthor !== BLUESKY_IDENTIFIER) {
        isIgnore = true;
      } else {
        replyParentTweetId = sheetData[parentPostIndex][sheetRowsIndex.tweetId];
      }
    }

    // 全てfalseだったら投稿対象
    if (isTwitterPosted || isRepost || isIgnore) {
      return;
    }
    isTweeted = true;

    // Logger.log('text: %s  \n  image: %s', text, isIncludeEmbed ? imageUrl : "no_image");

    let tweetId = "";
    let tweetResult = {};
    try {
      [tweetResult, tweetId] = isIncludeEmbed
        ? sendTweetWithImage(text, imageUrl.split(","), replyParentTweetId)
        : sendTweet(text, replyParentTweetId);
    } catch (e) {
      console.error(
        "tweet failed. error: \n" +
          e.message +
          "\n result: \n" +
          JSON.stringify(tweetResult)
      );
    }
    Logger.log("Result of tweet: \n %s", JSON.stringify(tweetResult, null, 2));

    tweetIds.push(tweetId);
    twitterPostedIds.push(postId);

  });

  for (let i = 0; i < twitterPostedIds.length; i++) {
    const postId = twitterPostedIds[i];
    const index = postIdValues.indexOf(postId);
    updateMySheet(
      [[true]],
      `${alphabets[sheetRowsIndex.isTwitterPosted]}${index + 1}`
    ); // 投稿した行のisTwitterPostedをtrueにする
    updateMySheet(
      [[tweetIds[i]]],
      `${alphabets[sheetRowsIndex.tweetId]}${index + 1}`
    );
  }
  updateCache();

  if (!isTweeted) Logger.log("SendPostsToTwitter was ran but nothing tweeted.");
}

function sendTweet(_text, replyId) {
  const payload = {
    text: _text,
  };
  if (replyId !== "") {
    payload["reply"] = {
      in_reply_to_tweet_id: replyId,
    };
  }
  return postTweet(payload);
}

function sendTweetWithImage(text, imageUrls, replyId) {
  const mediaIds = [];
  for (imageUrl of imageUrls) mediaIds.push(uploadImage(imageUrl));

  if (mediaIds) {
    let payload = {
      text: text,
      media: { media_ids: mediaIds },
    };
    if (replyId !== "") {
      payload.reply = {
        in_reply_to_tweet_id: replyId,
      };
    }
    return postTweet(payload);
  }
}

function postTweet(_payload) {
  const service = getService();
  if (!service.hasAccess()) {
    const authorizationUrl = service.getAuthorizationUrl();
    throw new Error(
      "OAuth2 failed. Open the following URL and re-run the script: \n" 
      + authorizationUrl
    );
  }
  const url = `https://api.twitter.com/2/tweets`;
  const options = {
    method: "POST",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + service.getAccessToken(),
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(_payload),
  };

  const tweetAttemptNum = 3;
  const response = fetchUrlNTimes(url, options, tweetAttemptNum);

  const result = JSON.parse(response.getContentText());
  return [result, JSON.parse(response).data.id];
}

// upload image via twitter api v1.1
function uploadImage(imageUrl) {
  const service = getService1();

  if (!service.hasAccess()) {
    const authorizationUrl = service.getAuthorizationUrl();
    throw new Error(
      "OAuth1 failed. Open the following URL and re-run the script: \n"
      + authorizationUrl
    );
  }

  const imageBinary = fetchUrl(imageUrl, { method: "GET" })
    .getBlob()
    .getBytes();
  const media = Utilities.base64Encode(imageBinary);

  const uploadPayload = {
    media_data: media,
  };

  const uploadResponse = uploadTwitterMedia(uploadPayload);

  const mediaId = JSON.parse(uploadResponse.getContentText()).media_id_string;
  // Logger.log('mediaId: %s', mediaId);
  return mediaId;
}

function uploadTwitterMedia(_payload, _options = undefined) {
  const service = getService1();
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const options =
    _options === undefined
      ? {
          method: "POST",
          payload: _payload,
          muteHttpExceptions: true,
        }
      : _options;

  const uploadAttemptNum = 3;
  const uploadResponse = fetchUrlNTimes(
    url,
    options,
    uploadAttemptNum,
    (url, options) => service.fetch(url, options)
  );
  return uploadResponse;
}

function uploadMovie(movieUrl) {
  const dataBinary = fetchUrlNTimes(movieUrl, { method: "GET" }, 3)
    .getBlob()
    .getBytes();
  const movieData = Utilities.base64Encode(dataBinary);

  let mediaId = "";
  for (let i = 0; i < 3; i++) {
    mediaId = mediaUploadInit(movieData);
    mediaUploadAppend(movieData, mediaId);

    let status = mediaUploadStatus(mediaId);
    while (status.processing_info.state === "in_progress") {
      Utilities.sleep(1000 * status.processing_info.check_after_secs);
      status = mediaUploadStatus(mediaId);
    }
    if (status.processing_info.state === "succeeded") break;
    if (i === 3) throw new Error("uploadMovie failed with status: " + status);
  }

  return mediaUploadFinalize(mediaId);
}

function mediaUploadInit(file) {
  const payload = {
    command: "INIT",
    total_bytes: file.getSize(),
    media_type: file.getMimeType(),
  };

  const uploadResponse = uploadTwitterMedia(payload);

  const mediaId = JSON.parse(uploadResponse.getContentText()).media_id_string;
  return mediaId;
}

function mediaUploadAppend(file, mediaId) {
  const fileSize = file.getSize();
  const fileData = file.getBlob().getBytes();
  // 分割ファイルを作成
  const splitSize = 4e6;
  let startByte = 0;
  const dataParts = [];
  while (startByte < fileSize) {
    let endByte = Math.min(startByte + splitSize, fileSize);
    const dataPart = fileData.slice(startByte, endByte); // ファイルデータを分割
    dataParts.push(dataPart);

    // 次の分割を準備
    startByte = endByte;
  }

  for (let i = 0; i < dataParts.length; i++) {
    const payload = {
      command: "APPEND",
      media_id: mediaId,
      media: dataParts[i],
      segment_index: i,
    };
    const responce = uploadTwitterMedia(payload);
  }
}

function mediaUploadStatus(mediaId) {
  const payload = {
    command: "STATUS",
    media_id: mediaId,
  };
  const options = {
    method: "GET",
    payload: payload,
    muteHttpExceptions: true,
  };
  return uploadTwitterMedia(payload, options);
}

function mediaUploadFinalize(mediaId) {
  const payload = {
    command: "FINALIZE",
    media_id: mediaId,
  };
  let response = uploadTwitterMedia(payload);
  while (response.hasOwnProperty("processing_info")) {
    Utilities.sleep(1000 * response.processing_info.check_after_secs);
    response = uploadTwitterMedia(payload);
  }
  return response;
}
