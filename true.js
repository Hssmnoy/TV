const axios = require("axios");
const fs = require("fs");

async function getTrueIDChannels() {
  console.log("📡 โหลด TRUEID...");

  const url = "https://raw.githubusercontent.com/nongakka/TV/main/true_chanel.json";

  const res = await axios.get(url);

  const data = typeof res.data === "string"
    ? JSON.parse(res.data)
    : res.data;

  const groups = data.data.channelsList;

  let channels = [];

  for (const group of groups || []) {
    for (const ch of group.channels || []) {
      channels.push({
        id: ch.id,
        slug: ch.slug,
        name: ch.title,
        logo: ch.thumb,
        category: ch.category // ✔ ใช้ตรงนี้เท่านั้น
      });
    }
  }

  console.log("✅ เจอทั้งหมด", channels.length, "ช่อง");

  return channels;
}

function removeDuplicateChannels(channels) {
  const seen = new Set();

  return channels.filter(ch => {
    const key = ch.slug || ch.id;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function filterCategories(channels) {
  const allow = new Set(["digitaltv-ca", "freetv-ca"]);

  return channels.filter(ch => {
    if (!ch.category) return false;

    return ch.category
      .split("|")
      .map(c => c.trim().toLowerCase())
      .some(c => allow.has(c));
  });
}

function saveTrueIDPlaylist(channels) {
  const today = new Date().toLocaleDateString("th-TH");

  const output = {
    name: "TRUE ID",
    author: "update " + today,
    image: "https://cms.dmpcdn.com/misc/2022/02/09/af7de880-89ab-11ec-8c0c-590a22d85d91_webp_original.webp",
    url: "",
    stations: channels.map(ch => ({
      name: ch.slug, 
      image: ch.logo,

      url: `https://tv.trueid.net/th-th/live/${ch.slug}`,

      referer: "https://tv.trueid.net/",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",

      playInNatPlayer: "true"
    }))
  };

  const path = require("path");

const filePath = path.join(__dirname, "trueid_playlist.json");

fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

console.log("💾 saved:", filePath);

  console.log("💾 saved: trueid_playlist.json");
}

(async () => {
  console.log("🚀 START\n");

  const channels = await getTrueIDChannels();

if (!channels.length) {
  console.log("❌ ไม่มีข้อมูล");
  return;
}

// 🔥 กรอง category ก่อน
const filtered = filterCategories(channels);

// 🔥 คัดซ้ำ
const uniqueChannels = removeDuplicateChannels(filtered);

console.log("✅ หลังกรอง category:", filtered.length);
console.log("✅ หลังคัดซ้ำ:", uniqueChannels.length);

saveTrueIDPlaylist(uniqueChannels);

  console.log("\n✅ DONE");
})();
