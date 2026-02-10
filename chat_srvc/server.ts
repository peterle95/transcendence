import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import { loadEnvConfig } from '@next/env';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { socketHandler } from './socket/socketHandler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3001;

// Load .env.local before anything else
const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Load SSL certificates
const httpsOptions = {
    key: fs.readFileSync(path.resolve(projectDir, 'certs/key.pem')),
    cert: fs.readFileSync(path.resolve(projectDir, 'certs/cert.pem')),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(httpsOptions, async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new SocketIOServer(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });

    socketHandler(io);

    server.listen(port, () => {
        console.log(`> Ready on https://${hostname}:${port}`);
    });
});
