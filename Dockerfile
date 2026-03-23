# Étape 1 : Builder TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Installer les dépendances
COPY package*.json ./
RUN npm install

# Copier le code
COPY . .

# Compiler le TypeScript
RUN npm run build

# Étape 2 : Image finale, légère
FROM node:20-alpine

WORKDIR /app

# Copier uniquement le build et les dépendances prod
COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
