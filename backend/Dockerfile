# Etapa 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias solo de producción
RUN npm ci --only=production

# Etapa 2: Producción
FROM node:18-alpine AS production

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001

# Copiar dependencias desde builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar archivos del backend 
COPY --chown=nodejs:nodejs server.js ./ 
COPY --chown=nodejs:nodejs package*.json ./

# Exponer puerto (coincide con tu server.js)
EXPOSE 3000

# Cambiar a usuario no-root
USER nodejs

# Health check (usa el mismo puerto que tu app)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando para iniciar la aplicación
CMD ["npm", "start"]
