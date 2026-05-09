FROM node:20-slim
WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código (exceto node_modules do frontend que será ignorado)
COPY . .

# Nota: dist-client já deve estar buildado localmente
# Se não estiver, vite build falhará aqui - isso é intencional para catching builds incompletos
RUN [ -d "dist-client" ] || (echo "❌ ERRO: dist-client não encontrado. Execute: npm run build" && exit 1)

ENV NODE_ENV=production
ENV PORT=4173
ENV PORT_API=4173
EXPOSE 4173 8787

# Rodar SaaS Gateway API (padrão)
# Warmup runtime sobrescreve com seu próprio comando
CMD ["node", "api/gateway.mjs"]
