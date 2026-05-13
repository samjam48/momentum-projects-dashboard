FROM node:20-alpine

WORKDIR /app

EXPOSE 3000

# Placeholder runtime until the Vite app and dependency install land.
CMD ["node", "-e", "require('http').createServer((_, res) => { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('Momentum frontend scaffold'); }).listen(3000, '0.0.0.0')"]
