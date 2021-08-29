# SSH Tunnel

## NGINX Config

```nginx
server {
    server_name ~^(?<tunnel>[\w-]+)\.your\.domain\.com$;

    listen [::]:443 ssl;
    listen 443 ssl;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Tunnel-Subdomain $tunnel;
        proxy_pass http://localhost:9984/;
    }
}
```
