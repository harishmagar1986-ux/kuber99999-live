const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let candles = [];
let lastPrice = 100;

let state = {
  name: "KUBER99999",
  mode: "PAPER",
  killSwitch: false,
  capital: 100000,
  pnl: 0,
  dailyLoss: 0,
  maxDailyLoss: 1000,
  lastSignal: "WAIT",
  confidence: 0,
  price: 100,
  ema20: 0,
  vwap: 0,
  reason: "Starting system...",
  trades: []
};

function ema(values, period) {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function vwap(list) {
  let pv = 0, vol = 0;
  for (const c of list) {
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  return vol ? pv / vol : 0;
}

function addCandle() {
  const open = lastPrice;
  const move = (Math.random() - 0.48) * 1.4;
  const close = Math.max(1, open + move);
  const high = Math.max(open, close) + Math.random() * 0.5;
  const low = Math.min(open, close) - Math.random() * 0.5;
  const volume = Math.floor(1000 + Math.random() * 5000);

  lastPrice = close;
  candles.push({ open, high, low, close, volume, time: new Date() });
  candles = candles.slice(-100);
}

function decision() {
  if (state.killSwitch) return ["BLOCK", 0, "Kill switch active"];
  if (state.dailyLoss >= state.maxDailyLoss) return ["BLOCK", 0, "Daily loss limit hit"];
  if (candles.length < 25) return ["WAIT", 20, "Collecting candles"];

  const closes = candles.map(c => c.close);
  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const e20 = ema(closes, 20);
  const vw = vwap(candles);

  state.price = price;
  state.ema20 = e20;
  state.vwap = vw;

  const up = price > e20 && price > vw && price > prev;
  const down = price < e20 && price < vw && price < prev;

  if (up) return ["BUY", 74, "Price above VWAP + EMA20 with momentum"];
  if (down) return ["SELL", 74, "Price below VWAP + EMA20 with momentum"];
  return ["WAIT", 45, "No clean confirmation"];
}

function paperTrade(signal, confidence, reason) {
  if (signal !== "BUY" && signal !== "SELL") return;

  const profit = Math.round((Math.random() - 0.42) * 220);
  state.pnl += profit;
  if (profit < 0) state.dailyLoss += Math.abs(profit);

  state.trades.unshift({
    time: new Date().toLocaleTimeString(),
    signal,
    price: Number(state.price.toFixed(2)),
    confidence,
    profit,
    reason
  });

  state.trades = state.trades.slice(0, 10);
}

setInterval(() => {
  addCandle();

  const [signal, confidence, reason] = decision();
  state.lastSignal = signal;
  state.confidence = confidence;
  state.reason = reason;

  if (Math.random() > 0.65) paperTrade(signal, confidence, reason);

  io.emit("update", state);
}, 4000);

app.get("/", (req, res) => res.send("KUBER99999 Final Backend Running ✅"));
app.get("/state", (req, res) => res.json(state));

app.post("/kill", (req, res) => {
  state.killSwitch = true;
  io.emit("update", state);
  res.json({ ok: true });
});

app.post("/resume", (req, res) => {
  state.killSwitch = false;
  io.emit("update", state);
  res.json({ ok: true });
});

io.on("connection", socket => socket.emit("update", state));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("KUBER99999 running on port " + PORT));
