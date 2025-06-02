const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

const CACHE_DIR = path.join(__dirname, 'cache');
const config = require('./config.json');

const api = config.endpoint + "/api";
const assets = config.endpoint + "/assets/";
const cdn = config.cdnendpoint;

fs.ensureDirSync(CACHE_DIR); // Check cache folder

app.use(express.raw({type: '*/*'}), compression(), helmet({contentSecurityPolicy: false}));

// Middleware to check the cache
async function checkCache(req, res, next) {
	const file = req.params.file; 
	const cacheFilePath = path.join(CACHE_DIR, file);
	if (await fs.pathExists(cacheFilePath)) { 
		return res.sendFile(cacheFilePath);
	} else {next()};
};

app.get('/assets/:file', checkCache, async (req, res, next) => {
	const file = req.params.file; const cacheFilePath = path.join(CACHE_DIR, file);
  	if (file.endsWith('.map')) {next()} else {
		const url = assets + file;
		try {
			const response = await axios.get(url, { responseType: 'arrayBuffer' });
			await fs.outputFile(cacheFilePath, response.data);
			res.header('Cache-Control', 'public, max-age=86400').sendFile(cacheFilePath);
		} catch (error) {
			console.error('Failed fetching:', url);
			res.status(500).json({ error: 'Internal server error', details: error.message });
		};
	};
});

app.get('/cdn/*', async (req, res) => {
	const path = req.originalUrl.replace('/cdn', '');
	const url = cdn + path;
		await axios.get(url, {responseType: 'arraybuffer'})
			.then((response) => {
				res.header('Cache-Control', 'public, max-age=86400').send(response.data);
			})
			.catch(function(error) {
				console.log(error);
				res.status(500).json({ message: 'Internal server error (proxy)', code: 500, error: error.message });
			});
});

app.use((req, res, next) => { // Ignore Discord tracker
	if (req.originalUrl.includes('/science')){res.sendStatus(403)};
	next();
});

app.use('/api*', async (req, res) => {
	const path = req.originalUrl.replace('/api', ''); 
	const url = api + path;
	const method = req.method.toLowerCase();
	const data = (method !== 'get' && method !== 'head') ? (req.body) : null;
	
	delete req.headers['host'];
	delete req.headers['origin'];

	await axios(url, { method, data, headers: req.headers})
		.then((response) => {
			res.status(response.status).header('Content-Type', response.headers.get('content-type')).send(response.data);
		})
		.catch (function (error) {
			if (error.request) {
				res.status(error.response.status).send(error.response.data);
			} else {
				console.error('Error forwarding request:', url);
				res.status(500).json({ message: 'Internal server error (proxy)', code: 500, error: error.message });
			};
		});
});

app.use('/developers*', async (req, res) => {res.sendFile(path.join(__dirname, 'public', 'developers.html'))});
app.use('/popout*', async (req, res) => { res.sendFile(path.join(__dirname, 'public', 'popout.html'))});
app.use('/', express.static(path.join('public'), {maxAge: '30m'})); // Static folder
app.use((req, res) => {res.status(404).sendFile(path.join(__dirname, 'public', 'client.html'))}); // Loads index.html as 404 page

app.listen(config.port, () => {console.log(`Server is running on port ${config.port}`)}); // Start webserver
