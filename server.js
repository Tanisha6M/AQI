const express = require('express');
const { WebSocketServer } = require('ws');
const cors    = require('cors');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let latest  = {};
let history = [];
const clients = new Set();

const getAQI = (gas) =>
  gas < 300 ? 'SAFE' : gas < 700 ? 'MODERATE' : 'DANGEROUS';

app.post('/api/data', (req, res) => {
  console.log('Received:', req.body);
  const data = {
    ...req.body,
    timestamp: new Date().toISOString(),
    aqi: getAQI(req.body.gas)
  };
  latest = data;
  history.push(data);
  if (history.length > 200) history.shift();

  const msg = JSON.stringify({ type: 'update', data });
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
  res.json({ ok: true });
});

app.get('/api/latest',  (req, res) => res.json(latest));
app.get('/api/history', (req, res) => res.json(history.slice(-100)));

const server = app.listen(PORT, () =>
  console.log(`AirGuard running on port ${PORT}`)
);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  clients.add(ws);
  if (latest.gas !== undefined)
    ws.send(JSON.stringify({ type: 'init', data: latest }));
  ws.on('close', () => clients.delete(ws));
});
