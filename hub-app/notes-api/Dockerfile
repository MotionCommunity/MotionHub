FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY api ./api
COPY lib ./lib
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

CMD ["npm", "start"]

