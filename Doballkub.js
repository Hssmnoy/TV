const axios = require("axios");
const fs = require("fs");

const WEB = "https://www.doballkub.com/live";

// ---------------- helper ----------------
function pad(n) {
  return String(n).padStart(2, "0");
}

function thaiTime(utc) {
  return new Date(utc).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok"
  });
}

function today() {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function shortDate() {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(
    d.getFullYear()
  ).slice(-2)}`;
}

// ---------------- หา endpoint ----------------
async function getEndpoint() {
  const html = (await axios.get(WEB)).data;

  const m =
    html.match(/graphqlEndpoint["': ]+"([^"]+)"/i) ||
    html.match(/graphqlEndpoint.*?(https?:\/\/[^"' <]+)/i);

  if (!m) throw new Error("ไม่พบ graphqlEndpoint");

  return m[1];
}

// ---------------- สร้าง query 2 วัน ----------------
function buildApi(endpoint, dayOffset = 0) {
  const now = new Date();

  // dayOffset = 0 วันนี้
  // dayOffset = 1 พรุ่งนี้

  const begin = new Date(now);
  begin.setUTCDate(begin.getUTCDate() + dayOffset - 1);
  begin.setUTCHours(17, 0, 0, 0);

  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + dayOffset);
  end.setUTCHours(16, 59, 59, 0);

  const variables = {
    begin: begin.toISOString(),
    end: end.toISOString(),
    sportTypeId: 1,
    t: Date.now().toString()
  };

  const query = `
query getSportLeagueEvents($begin: String!, $end: String!, $sportTypeId: Float!) {
  activeSportLeagues(
    startDateTime: $begin
    endDateTime: $end
    sportTypeId: $sportTypeId
  ) {
    id
    name
    logoUrl
    sportEvents {
      id
      homeTeamName
      awayTeamName
      eventDateTime
      state
    }
  }
}
`;

  return (
    endpoint +
    "?query=" +
    encodeURIComponent(query) +
    "&operationName=getSportLeagueEvents&variables=" +
    encodeURIComponent(JSON.stringify(variables))
  );
}

// ---------------- ดึงข้อมูล ----------------
async function getJson(url) {
  const res = await axios.get(url, {
    headers: {
      referer: "https://www.doballkub.com/",
      "user-agent": "Mozilla/5.0"
    }
  });

  return res.data;
}

// ---------------- playlist ----------------
function makePlaylist(json) {
  const leagues = json?.data?.activeSportLeagues || [];
  const stations = [];

  for (const league of leagues) {
    for (const m of league.sportEvents || []) {
      stations.push({
        name: `${thaiTime(m.eventDateTime)} ${m.homeTeamName} vs ${m.awayTeamName}`,
        info: league.name,
        image: league.logoUrl,
        url: `https://www.doballkub.com/live/watch/${m.id}`,
        referer: "https://www.doballkub.com/",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0"
      });
    }
  }

stations.sort((a,b)=>a.name.localeCompare(b.name));


  return {
    name: "Doballkub.com",
    author: `Update@${today()}`,
    info: `Doballkub Update@${today()}`,
    url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/Doballkub.json",
    image: "https://s3.ดูบอลดูหนัง.com/global/favicon.ico",
    groups: [
      {
        name: `วันที่ ${shortDate()}`,
        image: "https://s3.ดูบอลดูหนัง.com/global/favicon.ico",
        stations
      }
    ]
  };
}

// ---------------- run ----------------
// แก้ใหม่ ใช้ดึง 2 วันจริง (วันนี้ + พรุ่งนี้)

async function main() {
  try {
    console.log("หา endpoint...");
    const endpoint = await getEndpoint();

    const groups = [];

    // 0 = วันนี้ / 1 = พรุ่งนี้
    for (let day = 0; day <= 2; day++) {
      console.log("โหลดวันที่", day);

      const api = buildApi(endpoint, day);
      const json = await getJson(api);

      const leagues = json?.data?.activeSportLeagues || [];
      const stations = [];

      for (const league of leagues) {
        for (const m of league.sportEvents || []) {
          stations.push({
            name: `${thaiTime(m.eventDateTime)} ${m.homeTeamName} vs ${m.awayTeamName}`,
            info: league.name,
            image: league.logoUrl,
            url: `https://www.doballkub.com/live/watch/${m.id}`,
            referer: "https://www.doballkub.com/",
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0"
          });
        }
      }

     stations.sort((a,b)=>a.name.localeCompare(b.name));
  
      // ถ้ามีข้อมูลค่อยเพิ่ม group
      if (stations.length) {
        const d = new Date();
        d.setDate(d.getDate() + day);

        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);

        groups.push({
          name: `วันที่ ${dd}/${mm}/${yy}`,
          image: "https://s3.ดูบอลดูหนัง.com/global/favicon.ico",
          stations
        });
      }
    }

    const output = {
      name: "Doballkub.com",
      author: `Update@${today()}`,
      info: `Doballkub Update@${today()}`,
      url: "https://raw.githubusercontent.com/Hssmnoy/TV/main/Doballkub.json",
      image: "https://s3.ดูบอลดูหนัง.com/global/favicon.ico",
      groups
    };

    fs.writeFileSync(
      "Doballkub.json",
      JSON.stringify(output, null, 2),
      "utf8"
    );

    console.log("สร้าง Doballkub.json สำเร็จ");
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}

main();
