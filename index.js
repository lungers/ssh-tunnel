const fs = require('fs');
const http = require('http');
const net = require('net');
const { timingSafeEqual } = require('crypto');
const {
    utils: { parseKey },
    Server,
} = require('ssh2');

const hostKeys = [fs.readFileSync('ssh_host_key')];
const authorizedKeys = fs
    .readFileSync('authorized_keys', 'utf-8')
    .split('\n')
    .filter(key => key !== '')
    .map(key => parseKey(key));

const config = {
    hostKeys,
    // banner: 'welcome to my tunnel!\n',
};

const tunnels = new Map();

const checkValue = (input, allowed) => {
    const autoReject = input.length !== allowed.length;
    if (autoReject) {
        // Prevent leaking length information by always making a comparison with the
        // same input when lengths don't match what we expect
        allowed = input;
    }
    const isMatch = timingSafeEqual(input, allowed);
    return !autoReject && isMatch;
};

const sshServer = new Server(config, (client, info) => {
    client.on('authentication', ctx => {
        if (ctx.method !== 'publickey') {
            return ctx.reject();
        }

        for (const key of authorizedKeys) {
            // TODO: ?
            if (
                ctx.key.algo !== key.type ||
                !checkValue(ctx.key.data, key.getPublicSSH()) ||
                (ctx.signature && key.verify(ctx.blob, ctx.signature) !== true)
            ) {
                continue;
            }

            return ctx.accept();
        }

        ctx.reject(['publickey']);
    });

    client.on('ready', () => {
        client.on('request', (accept, reject, name, info) => {
            if (name !== 'tcpip-forward' || info.bindPort !== 80) {
                return reject();
            }

            const forwardServer = net.createServer(socket => {
                socket.setEncoding('utf8');

                client.forwardOut(
                    info.bindAddr,
                    info.bindPort,
                    socket.remoteAddress,
                    socket.remotePort,
                    (error, upstream) => {
                        if (error) {
                            socket.end();
                            console.error(error);
                            return;
                        }

                        upstream.pipe(socket).pipe(upstream);
                    },
                );
            });

            forwardServer.listen(0, 'tunnel', () => {
                const { port } = forwardServer.address();

                accept(port);
                client.tunnel = { port };
            });
        });

        client.on('session', (accept, reject) => {
            if (!client.tunnel) {
                return reject();
            }

            const session = accept();

            session.once('exec', (accept, reject, info) => {
                const stream = accept();

                client.tunnel.domain = info.command;
                tunnels.set(info.command, client);

                stream.write(
                    `✨ tunnel created!\nhttps://${info.command}.tunnel.lungers.com\n`,
                );
            });
        });

        client.on('close', () => {
            tunnels.delete(client.tunnel.domain);
        });
    });
});

sshServer.listen(8022, () => {
    console.log('Listening on port ' + sshServer.address().port);
});

const httpServer = http.createServer((req, clientRes) => {
    const subdomain = req.headers['x-tunnel-subdomain'];
    delete req.headers['x-tunnel-subdomain'];

    const client = tunnels.get(subdomain);

    if (!client) {
        clientRes.statusCode = 404;
        clientRes.end('tunnel not found');
        return;
    }

    const options = {
        hostname: 'tunnel',
        port: client.tunnel.port,
        path: req.url,
        method: req.method,
        headers: req.headers,
    };

    const proxy = http.request(options, res => {
        clientRes.writeHead(res.statusCode, res.headers);
        res.pipe(clientRes, { end: true });
    });

    proxy.on('error', error => {
        console.error(error);
    });

    req.pipe(proxy, { end: true });
});

httpServer.listen(9984, () => {
    console.log('http server listening on port', httpServer.address().port);
});
