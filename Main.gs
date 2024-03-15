function main() {
  if (ListUpBlueskyPosts()) {
    SendPostsToTwitter();
  }
}
