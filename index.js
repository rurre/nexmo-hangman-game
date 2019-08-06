require('dotenv').config();

const Hapi = require('hapi');
const SetupRoutes = require('./routes');

const server = Hapi.server
	({
		port: process.env.PORT || 5000,
		address: process.env.HOST || 'localhost'
	});

async function Init() 
{
	SetupRoutes(server);

	await server.start();
	console.log(`Server running at: ${server.info.uri}`);
}

Init();