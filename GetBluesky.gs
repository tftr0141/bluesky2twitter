//////////////  add bluesky post to sheet  /////////////////

function ListUpBlueskyPosts() {
  let newTweetExsists = false;

  const sheetData = getMySheet();
  const columnNumber = sheetData[0].length;
  const postData = JSON.parse(JSON.stringify(sheetData));
  postData.splice(0, 1);
  const postIdValues = new Set(postData.map((elm) => elm[0]));

  const accessJwt = getAccessJwt(BLUESKY_IDENTIFIER, BLUESKY_PASSWORD);
  const responseJSON = getPosts(accessJwt, BLUESKY_IDENTIFIER);

  responseJSON.feed.forEach((feed) => {
    const postInfo = feed.post;
    const postId = postInfo.cid;

    if (postIdValues.has(postId)) {
      // if post id is already written in the sheet
      return;
    }
    newTweetExsists = true;

    let text = postInfo.record.text;
    text = text.replace(
      /\b(?:https?:\/\/|www\.|ftp:\/\/)\S+?(\.{3}\b|\s|$)/g,
      ""
    ); // remove truncated links like "https://example.com/hogeh..."
    const urls = new Set();
    if (postInfo.record.hasOwnProperty("facets")) {
      const urls_in_text = postInfo["record"]["facets"].flatMap((facet) =>
        facet.features
          .filter((feature) => feature.$type === "app.bsky.richtext.facet#link")
          .map((linkFeature) => linkFeature.uri)
      );
      urls_in_text.forEach((url) => urls.add(url));
    }

    let isQuoteRepost = false;
    const isReply = postInfo.record.reply !== undefined;
    let replyParentAuthor = "";
    let replyParentId = "";
    if (isReply) {
      replyParentAuthor = feed.reply.parent.author.handle;
      replyParentId = feed.reply.parent.cid;
    }
    let isIncludeEmbed = false;
    const imageUrls = [];
    if (postInfo.hasOwnProperty("embed")) {
      const embedInfo = postInfo.embed;
      if (embedInfo.$type === "app.bsky.embed.images#view") {
        isIncludeEmbed = true;
        postInfo.embed.images.map((imageInfo) =>
          imageUrls.push(imageInfo.fullsize)
        );
      } else if (embedInfo.$type === "app.bsky.embed.external#view") {
        urls.add(embedInfo.external.uri);
      } else if (embedInfo.$type === "app.bsky.embed.record#view") {
        isQuoteRepost = embedInfo.record.value.$type === "app.bsky.feed.post";
      } else if (embedInfo.$type === "app.bsky.embed.recordWithMedia#view") {
        // if post includes both image and repost
        isQuoteRepost = true;
        isIncludeEmbed = true;
        postInfo.embed.media.images.map((imageInfo) =>
          imageUrls.push(imageInfo.fullsize)
        );
      }
    }
    const isRepost =
      postInfo.author.handle !== BLUESKY_IDENTIFIER || isQuoteRepost;

    if (urls) text += "\n" + Array.from(urls).join("\n");

    const sheetRowsIndex = new mySheetRowsIndex(sheetData);
    let newRow = new Array(columnNumber);
    newRow[sheetRowsIndex.postId] = postId;
    newRow[sheetRowsIndex.parentAuthorHandle] = replyParentAuthor;
    newRow[sheetRowsIndex.tweetId] = "";
    newRow[sheetRowsIndex.parentId] = replyParentId;
    newRow[sheetRowsIndex.text] = text;
    newRow[sheetRowsIndex.isRepost] = isRepost;
    newRow[sheetRowsIndex.isReplyId] = isReply;
    newRow[sheetRowsIndex.isIncludeEmbed] = isIncludeEmbed;
    newRow[sheetRowsIndex.isIgnore] = false;
    newRow[sheetRowsIndex.isTwitterPosted] = false;
    newRow[sheetRowsIndex.imageUrl] = imageUrls.join(",");

    Logger.log("row added to sheet: \n %s", newRow);
    addDataRow(newRow);
    updateCache();
  });

  if (newTweetExsists) {
    Logger.log("New tweet exists.");
  } else {
    Logger.log("No new post.");
  }
  return newTweetExsists;
}

function getPosts(accessJwt, identifier, number = MAX_DATA_NUM) {
  const url =
    "https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=" +
    identifier +
    "&limit=" +
    number;

  const options = {
    method: "get",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${accessJwt}`,
    },
    muteHttpExceptions: true,
  };

  const response = fetchUrl(url, options);
  const responseJSON = JSON.parse(response.getContentText());
  if (!responseJSON.hasOwnProperty("feed")) {
    throw new Error(
      "Something wrong with fetched posts. responseJSON: \n" +
        response.getContentText()
    );
  }
  return responseJSON;
}

function getAccessJwt(identifier, password) {
  const url = "https://bsky.social/xrpc/com.atproto.server.createSession";

  let data = {
    identifier: identifier,
    password: password,
  };

  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };

  let response = fetchUrl(url, options);
  let accessJwt = JSON.parse(response.getContentText()).accessJwt;

  return accessJwt;
}
