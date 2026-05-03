FROM node:20-slim
WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código
COPY . .

# Build frontend
RUN cd web/client-area && npm install && npm run build && cd ../..

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Rodar SaaS Gateway API
CMD ["node", "api/gateway.mjs"]
