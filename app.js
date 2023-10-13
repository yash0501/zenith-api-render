const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const cors = require("cors");
const sqlite3 = require("sqlite3");

app.use(express.static("public"));
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database("./zenith.sqlite3", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the zenith database.");
});

app.get("/", (req, res) => res.type("html").send(html));

app.get("/price", async (req, res) => {
  const frame = req.query.frame;
  const startTime = (
    Math.floor(req.query.startTime / frame) * frame
  ).toString();
  const endTime = (Math.ceil(req.query.endTime / frame) * frame).toString();

  let bucketListKeys = new Set();
  let bucketList = {};

  let candles = [];

  const sql = `SELECT * FROM marked_price WHERE strftime('%s', timestamp) BETWEEN ? AND ?`;
  db.all(sql, [startTime, endTime], (err, rows) => {
    if (err) {
      throw err;
    }
    console.log(rows.length);

    if (!rows.length) {
      res.json([]);
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let unixTimestamp = new Date(row.timestamp).getTime();
      let bucketIndex = Math.floor(unixTimestamp / (frame * 1000));
      bucketListKeys.add(bucketIndex);
      if (!bucketList[bucketIndex]) {
        bucketList[bucketIndex] = [];
      }
      bucketList[bucketIndex].push(row.price);
    }
    bucketListKeys = Array.from(bucketListKeys);

    let lastTransaction = {
      price: 0,
    };

    const lastTransactionSql = `SELECT * FROM marked_price WHERE strftime('%s', timestamp) < ? ORDER BY timestamp DESC LIMIT 1`;

    db.all(lastTransactionSql, [startTime], (err, queries) => {
      if (err) {
        throw err;
      }
      if (queries.length) {
        lastTransaction = queries[0];
      }

      let candle = {};

      for (let i = 0; i < bucketListKeys.length; i++) {
        let bucket = bucketList[bucketListKeys[i]];
        if (bucket.length) {
          if (i == 0) {
            if (!queries.length) {
              candle = {
                open: bucket[0],
                high: Math.max(...bucket),
                low: Math.min(...bucket),
                close: bucket[bucket.length - 1],
                timestamp: Math.floor(
                  parseInt(bucketListKeys[i] * frame * 1000)
                ),
              };
            } else {
              candle = {
                open: lastTransaction.price,
                high: Math.max(...bucket),
                low: Math.min(...bucket),
                close: bucket[bucket.length - 1],
                timestamp: Math.floor(
                  parseInt(bucketListKeys[i] * frame * 1000)
                ),
              };
            }
          } else {
            candle = {
              open: candles[i - 1].close,
              high: Math.max(...bucket),
              low: Math.min(...bucket),
              close: bucket[bucket.length - 1],
              timestamp: Math.floor(parseInt(bucketListKeys[i] * frame * 1000)),
            };
          }
        } else {
          if (i == 0) {
            if (queries.length) {
              candle = {
                open: lastTransaction.price,
                high: lastTransaction.price,
                low: lastTransaction.price,
                close: lastTransaction.price,
                timestamp: Math.floor(
                  parseInt(bucketListKeys[i] * frame * 1000)
                ),
              };
            } else {
              continue;
            }
          } else {
            candle = {
              open: candles[i - 1].close,
              high: candles[i - 1].close,
              low: candles[i - 1].close,
              close: candles[i - 1].close,
              timestamp: Math.floor(parseInt(bucketListKeys[i] * frame * 1000)),
            };
          }
        }
        candles.push(candle);
      }
      res.json(candles);
    });
  });
});

const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Render!</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");
      @font-face {
        font-family: "neo-sans";
        src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      html {
        font-family: neo-sans;
        font-weight: 700;
        font-size: calc(62rem / 16);
      }
      body {
        background: white;
      }
      section {
        border-radius: 1em;
        padding: 1em;
        position: absolute;
        top: 50%;
        left: 50%;
        margin-right: -50%;
        transform: translate(-50%, -50%);
      }
    </style>
  </head>
  <body>
    <section>
      Hello from Render!
    </section>
  </body>
</html>
`;
