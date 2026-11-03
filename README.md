# Server Mariam (Node.js)

A small experimental HTTP server designed for deployment on Fly.io.

## Features

- `GET /` — simple status page
- `GET /health` — health-check JSON
- `GET /api/info` — runtime and server information
- `POST /api/echo` — returns the JSON body you send
- No external npm dependencies

## Run locally

Requires Node.js 22 or newer.

```bash
npm start
```

Open `http://localhost:8080`.

## Deploy using GitHub + Fly.io

1. Create a new GitHub repository named `server-mariam`.
2. Upload the contents of this folder to the repository root. Make sure `Dockerfile` and `fly.toml` are at the root.
3. In Fly.io, open the existing app `server-mariam` and use its deployment flow to connect the GitHub repository, if that option is available.
4. Fly.io builds the included `Dockerfile` and starts the server on port `8080`.

If deploying with Fly CLI instead, run from this folder:

```bash
fly deploy
```

The Fly app name in `fly.toml` is `server-mariam`. If your actual Fly app has a different name, change the `app` value to match it.

## Test the API

Health check:

```bash
curl https://YOUR-APP-NAME.fly.dev/health
```

Echo endpoint:

```bash
curl -X POST https://YOUR-APP-NAME.fly.dev/api/echo \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","number":123}'
```

## Notes

This is a public test server, not a production authentication or database service. Do not send passwords, private keys, or personal data to it. The echo endpoint reflects submitted JSON and is intended only for testing.
