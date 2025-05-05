const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');
const compression = require('compression');

const app = express();

const CACHE_DIR = path.join(__dirname, 'cache');
const config = require('./config.json');
const api = config.apiendpoint;
const assets = config.assetsendpoint;
fs.ensureDirSync(CACHE_DIR); // Check cache folder

app.use(bodyParser.json());
app.use(compression());

// Middleware to check the cache
async function checkCache(req, res, next) {
	const file = req.params.file; const cacheFilePath = path.join(CACHE_DIR, file);
	if (await fs.pathExists(cacheFilePath)) { return res.sendFile(cacheFilePath) } else { next() };
}

app.get('/assets/:file', checkCache, async (req, res, next) => {
	const file = req.params.file; const cacheFilePath = path.join(CACHE_DIR, file);
  	if (file.endsWith('.map')) {next()}
	  else {
		try {
			const url = assets + file;
			const response = await axios.get(url, { responseType: 'arraybuffer' });
			await fs.outputFile(cacheFilePath, response.data); 
  			res.header('Cache-Control', 'public, max-age=86400').sendFile(cacheFilePath);
		} catch (error) { console.error('Failed fetching:', assets + file); res.status(500).json({ error: 'Internal server error', details: error.message })}
	}
});

app.use((req, res, next) => { // Ignore Discord tracker
	if (req.path.startsWith('/api/') && req.path.endsWith('/science')) {
		return res.end(); // Returns 200 (OK) with blank message
	} next();
});

app.use('/api*', async (req, res) => {
	const path = req.originalUrl.replace('/api', ''); const url = `${api}${path}`;
	const method = req.method; const body = (req.method !== 'GET' && req.method !== 'HEAD') ? (req.body) : null;

	try {
		const response = await fetch(url, { method, body, headers: { 
				'Content-type': req.headers['content-type'], 
				'Authorization': req.headers['authorization'],
				'X-Captcha-Key': req.headers['x-captcha-key'],
				'X-Captcha-Rqtoken': req.headers['x-captcha-rqtoken'],
				'X-Super-Properties': req.headers['x-super-properties']
		}});
		const responseBody = await response.text();
		const contentType = response.headers.get('content-type');

		res.status(response.status).header('Content-Type', contentType).send(responseBody);
	} catch (error) {
		console.error('Error forwarding request:', url);
		res.status(500).json({ error: 'Internal server error', details: error.message });
	}
});

app.use('/developers*', async (req, res) => {res.sendFile(path.join(__dirname, 'public', 'developers.html'))});
app.use('/popout*', async (req, res) => { res.sendFile(path.join(__dirname, 'public', 'popout.html'))});
app.use('/', express.static(path.join('public'), {maxAge: '1d'})); // Static folder
app.use((req, res) => {res.status(404).sendFile(path.join(__dirname, 'public', 'client.html'))}); // Loads index.html as 404 page

app.listen(config.port, () => {console.log(`Server is running on port ${config.port}`)}); // Start webserver
