# SSH Tunnel

ssh tunnel is a typescript project that allows you to expose your local ports to the public using ssh. it provides a convenient way to create tunnels between your local machine and a remote server, enabling access to local services over the internet.

## Configuration

ssh tunnel uses environment variables for configuration. create a .env file in the root of the project and provide the following variables:

-   `SSH_PORT` (optional, default: 8022) - the port to run the ssh server on
-   `HTTP_PORT` (optional, default: 9984) - the port to run the http server on
-   `TUNNEL_BASE_DOMAIN` - the base domain to display in the logs when someone creates a tunnel

## Generate a host key

to generate a host key, you can use the following ssh-keygen command:

```bash
ssh-keygen -f ssh_host_key
```

this command will generate a private key file (`ssh_host_key`) and a corresponding public key file (`ssh_host_key.pub`).

**note:** ensure that you properly secure and manage your host key files. do not share your private key with unauthorized individuals.

## Usage

ssh tunnel provides the following scripts in the project's package.json:

-   `build` - compile the typescript to javascript
-   `start` - start the ssh and http servers
-   `dev` - start the ssh and http servers with hot-reloading
-   `test` - run typescript with `--noEmit`

## NGINX config

if you're using nginx, you can configure it to work with the ssh tunnel with these instructions:

1. open your nginx configuration file in a text editor.
2. add the following server block:

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

replace `your.domain.com` with the domain you want to use for the tunnels. this configuration sets up a reverse proxy that forwards incoming requests to the http server. 3. save the configuration file and restart nginx for the changes to take effect.

```bash
sudo service nginx restart
```

## Creating a tunnel

1. run the following command:

    ```bash
    ssh -R 80:localhost:{your-local-port} your-ssh-server-host -p 8022 {subdomain-name}
    ```

    - replace `{your-local-port}` with the port of your local service that you want to expose. for example, if your local service is running on port `3000`, replace `{your-local-port}` with `3000`.
    - replace `your-ssh-server-host` with the hostname or ip address of your ssh server.
    - replace `{subdomain-name}` with the desired subdomain name that will be used to access your local service.
      example:

    ```bash
    ssh -R 80:localhost:3000 example.com -p 8022 example-tunnel
    ```

2. once the tunnel is created, you can access your local service using the subdomain and domain configured in the nginx server block. in the example mentioned earlier, you can access your local service at https://example-tunnel.your.domain.com.

<!-- thanks chatgpt for the readme :D -->
