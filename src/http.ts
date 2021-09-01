import http from 'http';
import { Tunnels } from './types';

export const httpServer = (tunnels: Tunnels) =>
    http.createServer((req, res) => {
        const subdomain = req.headers['x-tunnel-subdomain'];
        delete req.headers['x-tunnel-subdomain'];

        if (!subdomain || Array.isArray(subdomain)) {
            res.statusCode = 400;
            res.end('invalid tunnel subdomain');
            return;
        }

        const tunnel = tunnels.get(subdomain);
        if (!tunnel) {
            res.statusCode = 404;
            res.end('tunnel not found');
            return;
        }

        const options = {
            hostname: 'tunnel',
            port: tunnel.port,
            path: req.url,
            method: req.method,
            headers: req.headers,
        };

        const proxy = http.request(options, proxyRes => {
            res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxy.on('error', error => {
            console.error(error);
        });

        req.pipe(proxy, { end: true });
    });
