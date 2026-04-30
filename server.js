const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let state = {
  name: "KUBER99999",
  mode: "PAPER",
  capital: 100000,
  killSwitch: false,
  dailyLoss: 0,
  maxDailyLoss: 1000,
  pnl: 0,
  lastSignal: "WAIT",
  trades: []
};

app.get("/", (req, res) => res.send("KUBER99999 backend running ✅"));
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

function makeSignal() {
  if (state.killSwitch || state.dailyLoss >= state.maxDailyLoss) return "BLOCK";
  const r = Math.random();
  if (r > 0.72) return "BUY";
  if (r < 0.28) return "SELL";
  return "WAIT";
}

setInterval(() => {
  const signal = makeSignal();
  state.lastSignal = signal;

  if (signal === "BUY" || signal === "SELL") {
    const profit = Math.round((Math.random() - 0.42) * 250);
    state.pnl += profit;
    if (profit < 0) state.dailyLoss += Math.abs(profit);

    state.trades.unshift({
      time: new Date().toLocaleTimeString(),
      signal,
      profit
    });

    state.trades = state.trades.slice(0, 10);
  }

  io.emit("update", state);
}, 4000);

io.on("connection", socket => socket.emit("update", state));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Running on " + PORT));
