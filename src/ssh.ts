import fs from 'fs';
import { utils, Server } from 'ssh2';
import { ParsedKey } from 'ssh2-streams';
import net from 'net';
import { timingSafeEqual } from 'crypto';
import { Tunnel, Tunnels } from './types';
import env from './env';

const hostKeys = [fs.readFileSync('ssh_host_key')];
const authorizedKeys = fs
    .readFileSync('authorized_keys', 'utf-8')
    .split('\n')
    .filter(key => key !== '')
    .map(key => utils.parseKey(key))
    .filter(
        (key): key is ParsedKey =>
            !Array.isArray(key) && !(key instanceof Error),
    );

const checkValue = (input: Buffer, allowed: Buffer) => {
    const autoReject = input.length !== allowed.length;
    if (autoReject) {
        // Prevent leaking length information by always making a comparison with the
        // same input when lengths don't match what we expect
        allowed = input;
    }

    const isMatch = timingSafeEqual(Buffer.from(input), Buffer.from(allowed));
    return !autoReject && isMatch;
};

export const sshServer = (tunnels: Tunnels) =>
    new Server({ hostKeys }, client => {
        const tunnel: Tunnel = {};

        client.on('authentication', ctx => {
            if (ctx.method !== 'publickey') {
                return ctx.reject();
            }

            for (const key of authorizedKeys) {
                // TODO: ?
                if (
                    ctx.key.algo !== key.type ||
                    !checkValue(
                        ctx.key.data,
                        Buffer.from(key.getPublicSSH()),
                    ) ||
                    (ctx.signature &&
                        key.verify(ctx.blob, ctx.signature) !== true)
                ) {
                    continue;
                }

                return ctx.accept();
            }

            ctx.reject(['publickey']);
        });

        client.on('error', error => {
            // TODO:
            console.error(error);
        });

        client.on('ready', () => {
            client.on('request', (accept, reject, name, info) => {
                if (name !== 'tcpip-forward' || info.bindPort !== 80) {
                    return reject?.();
                }

                const forwardServer = net.createServer(socket => {
                    socket.setEncoding('utf8');

                    if (socket.remoteAddress && socket.remotePort) {
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
                    }
                });

                forwardServer.listen(0, 'tunnel', () => {
                    const address = forwardServer.address();

                    if (!address || typeof address === 'string') {
                        reject?.();
                    } else {
                        accept?.(address.port);
                        tunnel.port = address.port;
                    }
                });
            });

            client.on('session', (accept, reject) => {
                if (!tunnel.port) {
                    return reject();
                }

                const session = accept();

                session.once('exec', (accept, _reject, info) => {
                    const stream = accept();

                    tunnel.domain = info.command;
                    tunnels.set(info.command, tunnel);

                    stream.write(
                        `✨ tunnel created!\nhttps://${info.command}.${env.TUNNEL_BASE_DOMAIN}\n`,
                    );
                });
            });

            client.on('close', () => {
                if (tunnel.domain) {
                    tunnels.delete(tunnel.domain);
                }
            });
        });
    });
