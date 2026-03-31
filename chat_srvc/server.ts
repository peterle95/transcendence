import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnvConfig } from '@next/env';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { socketHandler } from './socket/socketHandler';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3001', 10);
const hostname = process.env.HOSTNAME ?? 'localhost';

// Load .env.local before anything else
const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Load SSL certificates (safe lazy-loading/fallback approach)
let httpsOptions: any = undefined;
const keyPath = path.resolve(projectDir, 'certs/key.pem');
const certPath = path.resolve(projectDir, 'certs/cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
    };
} else {
    console.warn(`[WARN] SSL certificates not found at ${keyPath} and ${certPath}. Falling back to HTTP server.`);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const requestHandler = async (req: any, res: any) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    };

    const server = httpsOptions
        ? createHttpsServer(httpsOptions, requestHandler)
        : createHttpServer(requestHandler);

    const defaultOrigins = [`http://${hostname}:${port}`, `https://${hostname}:${port}`];
    const allowedOrigins = process.env.SOCKET_IO_ALLOWLIST
        ? process.env.SOCKET_IO_ALLOWLIST.split(',').map(s => s.trim())
        : defaultOrigins; // if env variable not available it defaults back to localhost

    const io = new SocketIOServer(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"]
            // By setting cors.origin to a strict array, Socket.IO
            // automatically validates the origin, rejecting unlisted incoming 
            // connections while keeping the allowed methods to ["GET", "POST"]
        }
    });

    (global as any).io = io; // Expose io globally for API routes

    socketHandler(io);

    server.listen(port, () => {
        const protocol = httpsOptions ? 'https' : 'http';
        console.log(`> Ready on ${protocol}://${hostname}:${port}`);
    });
});
