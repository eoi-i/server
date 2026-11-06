FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY --chown=node:node package.json server.js ./
COPY --chown=node:node public ./public

USER node
EXPOSE 8080

CMD ["npm", "start"]
