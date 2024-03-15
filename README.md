# bluesky2twitter

Tweet bluesky post to twitter

## Usage

### Google sheets
- First, create new google spreadsheet and asign `BlueskyID`, `parentAuthorHandle`, `tweetId`, `replyParentId`, `text`, `isReply`, `isRepost`, `includeEmbed`, `ignoreThis`, `alreadyTweeted`, `imageUrl` for the first row
- Library TokenManager cannot be used so replace each tokens and id/sheetname of google sheet in `Keys.gs` to your own ones.

### Twitter authentication
- Create twitter(𝕏) API account 
- Run `doAuthorization()` and `doAuthorization1()`
