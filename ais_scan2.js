const fs = require("fs");

const TOKEN = `playbackUrlPrefix=https%3A%2F%2Ftr.play-rbcdn.ais.co.th%3A8438%2F&originBasicUrl=http%3A%2F%2Fpl-origin.ais-vidnt.com%2Fais%2Fplay%2Fanevia&tt=5b25305514a9b47818e186e52cc60e15&chunkHttps=true&tmid=B0003&tpbk=mCLVIA8zj33FqRdU&rrt=1776855597&tmod=rfk&rsid=13283f5f-b357-4d7a-97d2-d1a5dd30c2b6&tuid=21493167bf&cdn=redfox-https&tdid=fb7613941267b2a1b2e25bcec35cd769&origin=anevia&tfa=f0-fc&tttl=1776941997`;

const BASE =
  "https://49-231-37-37-rewriter.ais-vidnt.com/ais/play/anevia/live/eds";

// =======================
// CONFIG SCAN RANGE
// =======================
const PREFIXES = [
  ...Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(65 + i)
  ), // A-Z
  ""
];

const MAX_NUM = 300;

function makeId(prefix, n) {
  return prefix + String(n).padStart(4, "0");
}

function makeUrl(id) {
  return `${BASE}/${id}/HLS/${id}.m3u8?${TOKEN}`;
}

async function check(id) {
  const url = makeUrl(id);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        Referer: "https://ais-vidnt.com/"
      }
    });

    if (!res.ok) return null;

    const text = await res.text();

    // basic validation: must contain EXTINF or m3u8 structure
    if (!text.includes("#EXT")) return null;

    return true;
  } catch {
    return null;
  }
}

async function main() {
  const found = [];

  console.log("🚀 Starting A-Z");

  for (const prefix of PREFIXES) {
    console.log(`\n📂 Scanning prefix: ${prefix}`);

    for (let i = 1; i <= MAX_NUM; i++) {
      const id = makeId(prefix, i);

      const ok = await check(id);

      if (ok) {
        const url = makeUrl(id);

        found.push({
          id,
          name: id,
          url,
          group: prefix
        });

        console.log("✔", id);
      }
    }
  }

  // =======================
  // SAVE JSON
  // =======================
  fs.writeFileSync(
    "found_vseries.json",
    JSON.stringify(found, null, 2),
    "utf8"
  );

  // =======================
  // BUILD M3U
  // =======================
  let m3u = "#EXTM3U\n";

  for (const item of found) {
    m3u += `#EXTINF:-1 tvg-id="${item.id}" group-title="${item.group}",${item.name}\n`;
    m3u += `#EXTVLCOPT:http-referrer=https://ais-vidnt.com/\n`;
    m3u += `${item.url}\n`;
  }

  fs.writeFileSync("ais_scan.m3u", m3u, "utf8");

  console.log("\n====================");
  console.log("DONE");
  console.log("TOTAL FOUND:", found.length);
  console.log("====================");
}

main();