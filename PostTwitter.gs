////////////////////    twitter authentication    ///////////////////////

function SendPostsToTwitter() {
  let isTweeted = false;

  const sheetData = getMySheet();

  const headers = sheetData[0];
  const postIdColumnIndex = headers.indexOf('BlueSky ID');
  const parentAuthorHandleColumnIndex = headers.indexOf('parent author handle');
  const tweetIdColumnIndex = headers.indexOf('tweet id');
  const parentIdColumnIndex = headers.indexOf('reply parent id');

  const textColumnIndex = headers.indexOf('text');
  const isReplyIdColumnIndex = headers.indexOf('is reply');
  const isRepostColumnIndex = headers.indexOf('isRepost');
  const isIncludeEmbedColumnIndex = headers.indexOf('include embed');
  const isIgnoreColumnIndex = headers.indexOf('ignore this');
  const isTwitterPostedColumnIndex = headers.indexOf('already tweeted');
  const imageUrlColumnIndex = headers.indexOf('image url');
  
  const tweetIds = [];

  const postIdValues = sheetData.map(elm => elm[0]);

  const postValues = JSON.parse(JSON.stringify(sheetData)); // deepcopy array
  postValues.splice(0,1);

  const twitterPostedIds = [];

  postValues.forEach((post) => {
    const postId = post[postIdColumnIndex];
    const author = post[parentAuthorHandleColumnIndex];
    const text = post[textColumnIndex];
    const isRepost = toBoolean(post[isRepostColumnIndex]);
    const isReply = toBoolean(post[isReplyIdColumnIndex]);
    const isIncludeEmbed = toBoolean(post[isIncludeEmbedColumnIndex]);
    let isIgnore = toBoolean(post[isIgnoreColumnIndex]);
    const isTwitterPosted = toBoolean(post[isTwitterPostedColumnIndex]);
    const imageUrl = post[imageUrlColumnIndex];
    const parentId = post[parentIdColumnIndex];

    let replyParentTweetId = '';
    if (isReply) {
      const parentPostIndex = postIdValues.indexOf(parentId);

      if (parentPostIndex == -1 || author !== BLUESKY_IDENTIFIER) {
        isIgnore = true;
      } else {
        replyParentTweetId = sheetData[parentPostIndex][tweetIdColumnIndex];
      }
    } 

    // 全てfalseだったら投稿対象
    if ([isRepost, isIgnore, isTwitterPosted].includes(true)) return;

    // Logger.log('text: %s  \n  image: %s', text, isIncludeEmbed ? imageUrl : "no_image");

    let tweetId = '';
    let tweetResult = {};
    [tweetResult, tweetId] = isIncludeEmbed ? sendTweetWithImage(text, imageUrl.split(','), replyParentTweetId) 
    : sendTweet(text, replyParentTweetId);
    Logger.log('Result of tweet: \n %s', JSON.stringify(tweetResult, null, 2));

    tweetIds.push(tweetId);
    twitterPostedIds.push(postId);

    isTweeted = true;
  });

  for (let i = 0; i < twitterPostedIds.length; i++) {
    const postId = twitterPostedIds[i];
    const index = postIdValues.indexOf(postId);
    updateMySheet([[true]], `${alphabets[isTwitterPostedColumnIndex]}${index + 1}`);   // 投稿した行のisTwitterPostedをtrueにする
    updateMySheet([[tweetIds[i]]], `${alphabets[tweetIdColumnIndex]}${index + 1}`);
  }
  updateCache();
  
  if (!isTweeted) Logger.log('SendPostsToTwitter was ran but nothing tweeted.');
}

function sendTweet(_text, replyId = '') {
  const payload = {
    text: _text,
  };
  if (replyId !== '') {
    payload['reply'] = {
      in_reply_to_tweet_id: replyId
    };
  }
  return postTweet(payload);
}

function sendTweetWithImage(text, imageUrls, replyId = '') {
  const mediaIds = []
  for (imageUrl of imageUrls) mediaIds.push(uploadImage(imageUrl));

  if (mediaIds) {
    let payload = {
      text: text,
      media: {media_ids: mediaIds}, 
    };
    if (replyId !== '') {
      payload.reply = {
        in_reply_to_tweet_id: replyId
      };
    }
    return postTweet(payload);
  }
}

function postTweet(_payload) {
  const service = getService();
  if (!service.hasAccess()) {
    const authorizationUrl = service.getAuthorizationUrl();
    throw new Error('Open the following URL and re-run the script: %s',authorizationUrl);
  }
  const url = `https://api.twitter.com/2/tweets`;
  const options = {
    method: 'POST',
    'contentType': 'application/json',
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(_payload)
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
    throw new Error("Open the following URL and re-run the script: %s", authorizationUrl);
  }

  const imageBlob = fetchUrl(imageUrl, { method: "GET" }).getBlob();
  const media = Utilities.base64Encode(imageBlob.getBytes());

  const uploadPayload = {
      media_data: media
    };

  const uploadResponse = uploadTwitterMedia(uploadPayload);

  const mediaId = JSON.parse(uploadResponse.getContentText()).media_id_string;
  // Logger.log('mediaId: %s', mediaId);
  return mediaId;
}

function uploadMovie(movieUrl) {
  const movieData = fetchUrlNTimes(movieUrl, { method: "GET" }, 3);
  let mediaId = '';
  for (let i = 0; i < 3; i++){
    mediaId = mediaUploadInit(movieData);
    mediaUploadAppend(movieData, mediaId);
    
    let status = mediaUploadStatus(mediaId);
    while (status.processing_info.state === 'in_progress') {
      Utilities.sleep(1000 * status.processing_info.check_after_secs);
      status = mediaUploadStatus(mediaId);
    }
    if (status.processing_info.state === 'succeeded') break;
    if (i === 3) throw new Error('uploadMovie failed with status: ' + status);
  }

  return mediaUploadFinalize(mediaId);
}

function mediaUploadInit(file) {
  const payload = {
    command: 'INIT',
    total_bytes: file.getSize(),
    media_type: file.getMimeType()
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
      command: 'APPEND',
      media_id: mediaId,
      media: dataParts[i],
      segment_index: i
    }
    const responce = uploadTwitterMedia(payload);
  }
}

function mediaUploadStatus(mediaId) {
  const payload = {
    command: 'STATUS',
    media_id: mediaId
  }
  const options = {
    method: "GET",
    payload: payload,
    muteHttpExceptions: true
  };
  return uploadTwitterMedia(payload, options);
}

function mediaUploadFinalize(mediaId) {
  const payload = {
    command: 'FINALIZE',
    media_id: mediaId
  };
  let response = uploadTwitterMedia(payload);
  while (response.hasOwnProperty('processing_info')) {
    Utilities.sleep(1000 * response.processing_info.check_after_secs);
    response = uploadTwitterMedia(payload);
  }  
  return response;
}

function uploadTwitterMedia(_payload, _options = undefined) {
  const service = getService1();
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const options = _options ? _options : {
    method: "POST",
    payload: _payload,
    muteHttpExceptions: true
  };
  
  const uploadAttemptNum = 3;
  const uploadResponse = fetchUrlNTimes(url, options, uploadAttemptNum, service.fetch);
  return uploadResponse;
}
