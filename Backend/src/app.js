const express = require('express');
const aiRoutes = require('./routes/ai.routes');
const cors = require('cors');




const app = express();
app.use(cors());


app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.send('CodeReviewer backend is running');
});

app.post('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, service: 'backend' });
});


app.use('/ai', aiRoutes);

module.exports = app;