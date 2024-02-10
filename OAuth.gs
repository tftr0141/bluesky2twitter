//////////////////  OAuth2  ///////////////

function doAuthorization() {
  const service = getService();
  if (service.hasAccess()) {
    Logger.log("Already authorized");
  } else {
    const authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL and re-run the script: %s', authorizationUrl);
  }
}

function getService() {
  pkceChallengeVerifier();
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();
  return OAuth2.createService('twitter')
    .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + userProps.getProperty("code_verifier"))
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction('authCallback')
    .setPropertyStore(userProps)
    .setScope('users.read tweet.read tweet.write offline.access')
    .setParam('response_type', 'code')
    .setParam('code_challenge_method', 'S256')
    .setParam('code_challenge', userProps.getProperty("code_challenge"))
    .setTokenHeaders({
      'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded'
    })
}

function authCallback(request) {
  const service = getService();
  const authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

function pkceChallengeVerifier() {
  const userProps = PropertiesService.getUserProperties();
  if (!userProps.getProperty("code_verifier")) {
    let verifier = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    for (let i = 0; i < 128; i++) {
      verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    const sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier)

    const challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    userProps.setProperty("code_verifier", verifier)
    userProps.setProperty("code_challenge", challenge)
  }
}

function logRedirectUri() {
  const service = getService();
  Logger.log(service.getRedirectUri());
}

//////////////////  OAuth1 ///////////////

function doAuthorization1() {
  const service = getService1();
  if (service.hasAccess()) {
    Logger.log("Already authorized");
  } else {
    const authorizationUrl = service.authorize();
    Logger.log('Open the following URL and re-run the script: %s',
        authorizationUrl);
  }
} 

const getService1 = function() {
  return OAuth1.createService( "Twitter" )
  .setAccessTokenUrl( "https://api.twitter.com/oauth/access_token" )
  .setRequestTokenUrl( "https://api.twitter.com/oauth/request_token" )
  .setAuthorizationUrl( "https://api.twitter.com/oauth/authorize" )
  .setConsumerKey( CONSUMER_API_KEY )
  .setConsumerSecret( CONSUMER_API_SECRET )
  .setAccessToken( ACCESS_TOKEN, ACCESS_TOKEN_SECRET )
  .setCallbackFunction('authCallback1') // コールバック関数名 
  .setCache(CacheService.getUserCache())  // may increase performance.
  .setPropertyStore(PropertiesService.getUserProperties()); // Set the property store where authorized tokens should be persisted.
}

// OAuthコールバック
function authCallback1(request) {
  const service = getService1();
  const authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

function reset1() {
  const service = getService1();
  service.reset();
}
