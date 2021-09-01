import { Connection } from 'ssh2';

interface Tunnel {
    domain?: string;
    port?: number;
}

export type Tunnels = Map<string, Tunnel>;
