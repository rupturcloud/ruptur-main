#!/bin/bash

###############################################################################
# 🚀 DEPLOY RUPTUR SAAS EM PRODUÇÃO (Google Cloud Run)
###############################################################################

set -e

PROJECT_ID="ruptur-jarvis-v1-68358"
SERVICE_NAME="ruptur-saas"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ 🚀 DEPLOY RUPTUR SAAS — PRODUÇÃO                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar gcloud
echo "📍 Verificando gcloud..."
gcloud auth list | head -3
echo ""

# Configurar projeto
echo "🔧 Configurando projeto Google Cloud..."
gcloud config set project $PROJECT_ID
echo "✅ Projeto: $PROJECT_ID"
echo ""

# Build Docker image
echo "🔨 Compilando Docker image..."
docker build -t $IMAGE_NAME .
echo "✅ Image compilada: $IMAGE_NAME"
echo ""

# Configurar Docker para GCP
echo "🔐 Configurando autenticação Docker..."
gcloud auth configure-docker
echo "✅ Docker autenticado"
echo ""

# Push para Google Container Registry
echo "📤 Enviando imagem para Google Container Registry..."
docker push $IMAGE_NAME
echo "✅ Image enviada"
echo ""

# Deploy em Cloud Run
echo "🚀 Fazendo deploy em Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=3001 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --max-instances 10 \
  --min-instances 1

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!                             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 URLs:"
echo "   API: https://api.ruptur.cloud"
echo "   Dashboard: https://app.ruptur.cloud"
echo ""
echo "📊 Status:"
gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
echo ""
echo "📋 Logs em tempo real:"
echo "   gcloud run logs read $SERVICE_NAME --region $REGION --follow"
