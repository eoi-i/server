FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server.js ./
EXPOSE 8080
CMD ["npm", "start"]
