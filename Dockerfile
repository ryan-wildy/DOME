FROM node:22-slim

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
COPY docs ./docs
RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
