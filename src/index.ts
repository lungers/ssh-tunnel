import env from './env';
import { sshServer } from './ssh';
import { httpServer } from './http';
import { Tunnels } from './types';

const tunnels: Tunnels = new Map();

sshServer(tunnels).listen(env.SSH_PORT, () => {
    console.log('SSH server listening on port', env.SSH_PORT);
});

httpServer(tunnels).listen(env.HTTP_PORT, function () {
    console.log('HTTP server listening on port', env.HTTP_PORT);
});
