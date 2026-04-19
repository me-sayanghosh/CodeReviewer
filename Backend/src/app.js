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

app.post('/', (req, res) => {
    res.send('Hello World!');
});


app.use('/ai', aiRoutes);

module.exports = app;