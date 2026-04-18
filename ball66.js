const axios = require("axios");
const fs = require("fs");

// 🔥 server ทั้งหมด
const BASES = [
  
  "https://love.verowo7190.workers.dev",
  "https://love.bebin98399.workers.dev"

//https://love.sayob28681.workers.dev
//https://love.tivov68423.workers.dev
//https://love.pifipa2974.workers.dev
//https://love-test.fkuqelttkgpfkvycvm.workers.dev
//https://love.watipej760.workers.dev
//https://love.cedesi6978.workers.dev
//https://love.vohelem576.workers.dev
//https://love.sikoyo3159.workers.dev
//https://love.kopen87949.workers.dev
//https://love.tecobo5568.workers.dev
//https://love.uh6wzyncw9.workers.dev
//https://love.wolayi7869.workers.dev
  
];

// 🔥 แยก 2 URL
const urls = [
  "https://embed.bananacake.org/dooball66v2/ajax_channels.php?api_key=hmcb4rf66f&sportsonly=1", // กีฬา
  "https://embed.bananacake.org/dooball66v2/ajax_channels.php?api_key=hmcb4rf66f" // ทั้งหมด
];

const regex = /src\s*=\s*'([^']+)'.*?loadPlayer\('([^']+)'\)/gs;

async function checkStream(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        Referer: "https://embed-xs.bananacake.org/"
      },
      validateStatus: () => true
    });

    return res.status === 200 && res.data.includes("#EXTM3U");
  } catch {
    return false;
  }
}

async function getWorkingStreams(id) {
  const origins = ["lx-origin", "vx-origin"];

  // 🔥 ลอง 720 ก่อน
  let servers720 = [];

  for (const origin of origins) {
    for (let i = 0; i < BASES.length; i++) {
      const base = BASES[i];
      const url = `${base}/${origin}/${id}_720/chunks.m3u8`;

      if (await checkStream(url)) {
        servers720.push({
          name: origin === "lx-origin" ? "🟢 LX (720)" : "🔵 VX (720)",
          url
        });
      }
    }
  }

  // 🔥 ถ้ามี 720 → ใช้เลย
  if (servers720.length > 0) {
    return servers720;
  }

  // ❗ ไม่มี 720 → fallback 480
  let servers480 = [];

  for (const origin of origins) {
    for (let i = 0; i < BASES.length; i++) {
      const base = BASES[i];
      const url = `${base}/${origin}/${id}_480/chunks.m3u8`;

      if (await checkStream(url)) {
        servers480.push({
          name: origin === "lx-origin" ? "🟢 LX (480)" : "🔵 VX (480)",
          url
        });
      }
    }
  }

  return servers480;
}

async function main() {
  const map = {};

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // 🏷️ แยกกลุ่ม
    const groupName = i === 0 ? "🏟️ กีฬา" : "📺 ทั่วไป";

    const res = await axios.get(url);

    let match;
    while ((match = regex.exec(res.data)) !== null) {
      const logo = match[1];
      const id = match[2];

      // 🔥 กันซ้ำ (เอาจาก sport ก่อน)
      if (!map[id]) {
        console.log("⏳", id);

        const servers = await getWorkingStreams(id);

          if (servers.length === 0) {
          console.log("❌", id);
          continue;
          }
        map[id] = {
          title: id,
          group: groupName,
          logo: logo,
          servers: servers
        };

        console.log("✅", id);
      }
    }
  }

  const playlist = Object.values(map);

  // ---------------- JSON ----------------
  fs.writeFileSync(
    "playlist.json",
    JSON.stringify(playlist, null, 2),
    "utf-8"
  );

 // ---------------- Wiseplay Nested Groups ----------------
const wiseplay = {
  name: "Dooball66",
  author:
  "Dooball66 " +
  new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }),
  image: "https://dooball66ad.com/wp-content/uploads/2020/07/cropped-logo.png",
  url: "https://raw.githubusercontent.com/Hssmnoy/shortmovie/main/playlist_wiseplay.json",
  groups: []
};

const groupMap = {};

playlist.forEach(ch => {
  if (!groupMap[ch.group]) {
    groupMap[ch.group] = {
      name: ch.group,
      image: "https://dooball66ad.com/wp-content/uploads/2020/07/cropped-logo.png",
      groups: []
    };
  }

  const matchGroup = {
    name: ch.title,
    image: ch.logo,
    stations: []
  };

  ch.servers.forEach((server, i) => {
    matchGroup.stations.push({
      name: i === 0 ? "🟢 MAIN" : `🟡 BACKUP ${i}`,
      info: ch.title,
      image: ch.logo,
      url: server.url,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      referer: "https://embed-xs.bananacake.org/",
      isHost: false
    });
  });

  groupMap[ch.group].groups.push(matchGroup);
});

wiseplay.groups = Object.values(groupMap);

fs.writeFileSync(
  "playlist_wiseplay.json",
  JSON.stringify(wiseplay, null, 2),
  "utf-8"
);

  // ---------------- M3U ----------------
  let m3u = "#EXTM3U\n";

  playlist.forEach(ch => {
    ch.servers.forEach(server => {
      m3u += `#EXTINF:-1 tvg-logo="${ch.logo}" group-title="${ch.group}",${ch.title} (${server.name})\n`;
      m3u += `${server.url}\n`;
    });
  });

  fs.writeFileSync("playlist.m3u", m3u, "utf-8");

  console.log("\n🎉 DONE:", playlist.length);
}

main();
