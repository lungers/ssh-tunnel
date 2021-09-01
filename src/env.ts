import { cleanEnv, port, str } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export default cleanEnv(process.env, {
    SSH_PORT: port({ default: 8022 }),
    HTTP_PORT: port({ default: 9984 }),
    TUNNEL_BASE_DOMAIN: str({ example: 'tunnel.example.com' }),
});
