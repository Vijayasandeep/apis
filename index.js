import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 Enable body parsers before anything else
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔍 Log every incoming request (method, path, headers, body)
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// ✅ Basic GET route
app.get('/', (req, res) => {
  console.log('✔️ GET request received onvvx /');
  res.send('Hello, World!');
});

// ✅ POST route to receive data from devices
app.post('/getall', (req, res) => {
  const data = req.body;
  console.log('📥 Data received on /getall:', data);
  res.json({
    message: 'Data received successfully',
    data: data
  });
});

// ✅ Catch-all for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ✅ Start server on 0.0.0.0 to accept LAN/external traffic
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
