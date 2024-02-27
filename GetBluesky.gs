//////////////  add bluesky post to sheet  /////////////////

function ListUpBlueskyPosts() {
  let newTweetExsists = false;

  const sheetData = getMySheet();
  const columnNumber = sheetData[0].length;
  const postData = JSON.parse(JSON.stringify(sheetData));
  postData.splice(0, 1);
  const postIdValues = postData.map((elm) => elm[0]);

  const accessJwt = getAccessJwt(BLUESKY_IDENTIFIER, BLUESKY_PASSWORD);
  const responseJSON = getPosts(accessJwt, BLUESKY_IDENTIFIER);

  responseJSON.feed.forEach((feed) => {
    const postInfo = feed.post;
    const postId = postInfo.cid;

    if (postIdValues.includes(postId)) {
      // if post id is already written in the sheet
      return;
    }
    newTweetExsists = true;
    
    let text = postInfo.record.text;
    text = text.replace(/\b(?:https?:\/\/|www\.|ftp:\/\/)\S+?(\.{3}|\s|$)/g, ""); // remove truncated links like "https://example.com/hogeh..."
    let urls = new Set("");
    if (postInfo.record.hasOwnProperty("facets")) {
      urls = new Set(
        postInfo["record"]["facets"].flatMap(facet =>
        facet.features
          .filter(feature => feature.$type === "app.bsky.richtext.facet#link")
          .map(linkFeature => linkFeature.uri)  
        )
      );
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
    if (postInfo.hasOwnProperty("embed")) {
      const embedInfo = postInfo.embed;
      isIncludeEmbed = embedInfo.hasOwnProperty("images");
      if (embedInfo.$type === "app.bsky.embed.external#view") {
        urls.add(embedInfo.external.uri);
      } else if (embedInfo.$type === "app.bsky.embed.record#view") {
        isQuoteRepost = embedInfo.record.value.$type === "app.bsky.feed.post";
      } else if (embedInfo.$type === "app.bsky.embed.recordWithMedia#view") {
        // if post includes both image and repost
        isQuoteRepost = true;
        isIncludeEmbed = true;
      }
    }
    const isRepost =
      (postInfo.author.handle !== BLUESKY_IDENTIFIER) || isQuoteRepost;

    if (urls) text += "\n" + Array.from(urls).join("\n");
    

    const imageUrls = [];
    if (isIncludeEmbed) {
      const aturi = postInfo.uri;
      const posturi = `https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${aturi}`;
      const options = {
        method: "get",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${accessJwt}`,
        },
        muteHttpExceptions: true,
      };
      const responseForPhoto = fetchUrl(posturi, options);
      const responseForPhotoJSON = JSON.parse(
        responseForPhoto.getContentText()
      );
      for (image of responseForPhotoJSON.thread.post.embed.images) {
        imageUrls.push(image.fullsize);
      }
      // Logger.log('imageUrl: %s', imageUrls);
    }

    const headers = sheetData[0];
    const postIdColumnIndex = headers.indexOf("BlueSky ID");
    const parentAuthorHandleColumnIndex = headers.indexOf(
      "parent author handle"
    );
    const tweetIdColumnIndex = headers.indexOf("tweet id");
    const parentIdColumnIndex = headers.indexOf("reply parent id");

    const textColumnIndex = headers.indexOf("text");
    const isReplyIdColumnIndex = headers.indexOf("is reply");
    const isRepostColumnIndex = headers.indexOf("isRepost");
    const isIncludeEmbedColumnIndex = headers.indexOf("include embed");
    const isIgnoreColumnIndex = headers.indexOf("ignore this");
    const isTwitterPostedColumnIndex = headers.indexOf("already tweeted");
    const imageUrlColumnIndex = headers.indexOf("image url");

    let newRow = new Array(columnNumber);
    newRow[postIdColumnIndex] = postId;
    newRow[parentAuthorHandleColumnIndex] = replyParentAuthor;
    newRow[tweetIdColumnIndex] = "";
    newRow[parentIdColumnIndex] = replyParentId;
    newRow[textColumnIndex] = text;
    newRow[isRepostColumnIndex] = isRepost;
    newRow[isReplyIdColumnIndex] = isReply;
    newRow[isIncludeEmbedColumnIndex] = isIncludeEmbed;
    newRow[isIgnoreColumnIndex] = false;
    newRow[isTwitterPostedColumnIndex] = false;
    newRow[imageUrlColumnIndex] = imageUrls.join(",");

    Logger.log("row added to sheet: \n %s", newRow);
    addDataRow(newRow);
    updateCache();
  });

  return newTweetExsists;
}

function getPosts(accessJwt, identifier) {
  const url =
    "https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=" +
    identifier +
    "&limit=" +
    MAX_DATA_NUM;

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
