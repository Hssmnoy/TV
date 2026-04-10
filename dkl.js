const axios = require("axios");
const fs = require("fs");

async function generatePlaylist() {
  const res = await axios.get("https://liveplayback.net/api/fixtures/date");
  const data = res.data;

  const groups = [];

  for (const dateKey of Object.keys(data)) {
    const matches = data[dateKey];

    const [y, m, d] = dateKey.split("-");
    const groupName = `วันที่ ${d}/${m}/${y.slice(2,4)}`;

    const stations = matches.map(match => {
      const time = match.event_time.split(" ")[1].slice(0,5);

      return {
        name: `${time} ${match.teamhome.name} vs ${match.teamaway.name}`,
        info: match.league_info.name,
        image: match.league_info.logo,
        url: `https://dookeela4.live/football/match/${match.id}`,
        referer: "https://dookeela4.live/",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0"
      };
    });

    groups.push({
      name: groupName,
      image: "https://dookeela4.live/images/logo-bar.png",
      stations
    });
  }

  const playlist = {
    name: `Dookeela4.live update @${Object.keys(data)[0].split("-").reverse().join("/")}`,
    author: `Update@${Object.keys(data)[0].split("-").reverse().join("/")}`,
    info: `dookeela4.live Update@${Object.keys(data)[0].split("-").reverse().join("/")}`,
    url: "https://raw.githubusercontent.com/nongakka/TV/main/dookeela4.json",
    image: "https://dookeela4.live/images/logo-bar.png",
    groups
  };

  fs.writeFileSync("dookeela4.json", JSON.stringify(playlist, null, 2), "utf8");

  console.log("✅ dookeela4.json created successfully!");
}

generatePlaylist();
