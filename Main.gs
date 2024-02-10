function main() {
  if (ListUpBlueskyPosts()){
    SendPostsToTwitter();
  } else {
    Logger.log("No new post")
  }
}

