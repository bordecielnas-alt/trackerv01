# Étape 1 : Build Vite
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Étape 2 : Serveur Nginx pour les fichiers statiques
FROM nginx:stable-alpine

# Copier le build Vite dans Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Config Nginx pour React Router (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
