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
ENV PORT=4173
EXPOSE 4173 8787

# Rodar SaaS Gateway API (padrão)
# Warmup runtime sobrescreve com seu próprio comando
CMD ["node", "api/gateway.mjs"]
