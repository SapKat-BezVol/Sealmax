# Sealmax Messenger

Sealmax is a minimal real-time web messenger accessible at `sealmax.desperatio.com`. It provides a simple chat interface that stores messages and the chosen nickname in browser cookies so that conversation history persists between sessions.

## Features

- Node.js backend using Express and Socket.IO for real-time messaging
- Frontend prompts for a nickname and keeps message history in cookies
- Ready-to-use Nginx configuration with SSL placeholders
- Jest tests to verify HTTP and WebSocket functionality

## Getting started

```bash
npm install
npm start
```

The server listens on port `3000`. Open `http://localhost:3000` in a browser to start chatting.

## Running tests

```bash
npm test
```

## Deployment

An example Nginx configuration is provided in `nginx.conf`. It redirects HTTP to HTTPS, serves static files from `public/`, and proxies WebSocket connections to the Node.js backend.

Update the `ssl_certificate` and `ssl_certificate_key` directives with paths to valid certificates before production use.
