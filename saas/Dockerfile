FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install --production
ENV NODE_ENV=production
ENV WARMUP_RUNTIME_PORT=4173
EXPOSE 4173
CMD ["node", "modules/warmup-core/server.mjs"]
