FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install production dependencies (including pg) during image build.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# The server reads index.html from the application directory at startup.
COPY --chown=node:node server.js index.html ./
RUN chown -R node:node /app

USER node
EXPOSE 8080

CMD ["node", "server.js"]
