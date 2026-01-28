const express = require('express');
const app = express();
app.get('*', (req, res) => res.send('Wildcard'));
app.use('*', (req, res) => res.send('Wildcard Use'));
app.all('*', (req, res) => res.send('Wildcard All'));
