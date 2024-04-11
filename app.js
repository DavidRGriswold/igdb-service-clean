import express from 'express';
import axios from 'axios';
import hltb from 'howlongtobeat';
import dotenv from 'dotenv';

const hltbService = new hltb.HowLongToBeatService();

dotenv.config();
const app = express();

const secret = process.env.SECRET;
const id = process.env.ID;
const port = process.env.PORT;

let access_token, exp_time;
let defaultResult = {year: "NF", imageURL: "NF",id:"NF",name:"NF",url:"NF",hltb:"NF"}

await updateAccessToken();

app.use(express.json());

app.get('/', async (req, res) => {
  try{
    let title = req.query.name;
    let gameid = req.query.id;
    let gameurl = req.query.url;
    let result = defaultResult;
    if (gameid) result = await getGameInfoFromID(gameid);
    else if (gameurl) result = await getGameInfoFromURL(gameurl);
    else if (title) result = await getGameInfo(title);
    res.send(result);
  }catch(e) {
    res.send(defaultResult);
  }
});

app.listen(port, () => console.log(`Hello world app listening on port ${port}!`))

async function updateAccessToken() {
  let current_time = new Date().getTime();
  if (access_token && exp_time && current_time < exp_time) return;

  let url = "https://id.twitch.tv/oauth2/token";
  let params = {
    client_id: id,
    client_secret: secret,
    grant_type: "client_credentials",
  }
  let response = await axios.post(url, params);
  access_token = response.data.access_token;
  exp_time = current_time + 1000 * response.data.expires_in - 600;
  console.log(access_token + "\n" + current_time + "\n" + exp_time);

}

async function getGameInfo(title) {
  let current_time = new Date().getTime();
  if (!access_token || current_time > exp_time) await updateAccessToken();
  const options = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/games',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'search "' + title + '";fields *;'
  };

  let response = await axios.request(options);
  if (response.data.length == 0) {
    //no response
    return defaultResult;
  }
  console.log(response.data);
  let gameData = response.data[0]; // default to first response
  // find the best id if for some reason igdb does something dumb
  for (let game of response.data) {
    if (game.name.toLowerCase() == title.toLowerCase()) {
      //if its a perfect match ignoring case, override regardless of "priority"
      gameData = game;
      break;
    }
  }
  let gameId = gameData.id;
  let officialName = gameData.name;
  let releaseDate = gameData.first_release_date;
  let releaseYear = new Date(releaseDate * 1000).getFullYear();
  let imageURL;
  if (gameData.cover) imageURL = await getCoverURL(gameId);
  else if (gameData.artworks && gameData.artworks.length > 0) imageURL = await getImageURL(gameId,"artworks")
  else if (gameData.screenshots && gameData.screenshots.length > 0) imageURL = await getImageURL(gameId,"screenshots");
  else imageURL="NF";
  let hltb = await getHLTB(officialName);

  let siteURL = gameData.url;
  return { year: releaseYear, imageURL: imageURL, id: gameId, name: officialName, url: siteURL,hltb:hltb };
}

async function getHLTB(title) {
  let response = await hltbService.search(title);
  // just assume the first one is right i guess
  if (response.length == 0) return "NF";
  return response[0].gameplayMain;
}

async function getImageURL(gameId,endpoint) {
  const options2 = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/' + endpoint,
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *; where game=' + gameId + ";"
  };

  let response2 = await axios.request(options2);
  let image_id;
  if (response2.data.length > 0) image_id = response2.data[0].image_id;
  let imageURL = image_id ? "https://images.igdb.com/igdb/image/upload/t_original/" + image_id + ".jpg" : "NF";
  return imageURL;
}

async function getCoverURL(gameId) {
  const options2 = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/covers',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *; where game=' + gameId + ";"
  };

  let response2 = await axios.request(options2);
  let image_id;
  if (response2.data.length > 0) image_id = response2.data[0].image_id;
  let imageURL = image_id ? "https://images.igdb.com/igdb/image/upload/t_cover_big/" + image_id + ".png" : "NF";
  return imageURL;
}

async function getGameInfoFromID(gameId) {
  let current_time = new Date().getTime();
  console.log("here");
  if (!access_token || current_time > exp_time) await updateAccessToken();
  const options = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/games',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *;where id=' + gameId + ';'
  };
  console.log(options.data);

  let response = await axios.request(options);
  if (response.data.length == 0) {
    //no response
    return defaultResult;
  }
  let releaseDate = response.data[0].first_release_date;
  let releaseYear = new Date(releaseDate * 1000).getFullYear();
  let officialName = response.data[0].name;
  const options2 = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/covers',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *; where game=' + gameId + ";"
  };

  let response2 = await axios.request(options2);
  let image_id;
  if (response2.data.length > 0) image_id = response2.data[0].image_id;
  let imageURL = image_id ? "https://images.igdb.com/igdb/image/upload/t_cover_big/" + image_id + ".png" : "NF";
  let siteURL = response.data[0].url;
  let hltb = await getHLTB(officialName);
  return { year: releaseYear, imageURL: imageURL, id: gameId, name: officialName, url: siteURL,hltb:hltb };
}

async function getGameInfoFromURL(gameurl) {
  let current_time = new Date().getTime();
  if (!access_token || current_time > exp_time) await updateAccessToken();
  const options = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/games',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *;where url="' + gameurl + '";'
  };
  console.log(options.data);
  let response = await axios.request(options);
  console.log(response.data[0]);
  if (response.data.length == 0) {
    //no response
    return defaultResult;
  }
  let gameId = response.data[0].id;
  let releaseDate = response.data[0].first_release_date;
  let releaseYear = new Date(releaseDate * 1000).getFullYear();
  let officialName = response.data[0].name;
  const options2 = {
    method: 'POST',
    url: 'https://api.igdb.com/v4/covers',
    headers: {
      'Client-ID': id,
      Authorization: 'Bearer ' + access_token
    },
    data: 'fields *; where game=' + gameId + ";"
  };

  let response2 = await axios.request(options2);
  let image_id;
  if (response2.data.length > 0) image_id = response2.data[0].image_id;
  let imageURL = image_id ? "https://images.igdb.com/igdb/image/upload/t_cover_big/" + image_id + ".png" : "NF";
  let siteURL = response.data[0].url;
  let hltb = await getHLTB(officialName);
  return { year: releaseYear, imageURL: imageURL, id: gameId, name: officialName, url: siteURL,hltb:hltb };
}
