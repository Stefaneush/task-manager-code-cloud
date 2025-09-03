# Dockerfile para el frontend con nginx
FROM nginx:alpine

# Copiar archivos estáticos
COPY public/ /usr/share/nginx/html/

# Copiar configuración personalizada de nginx
COPY ./nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Exponer puerto 80
EXPOSE 80

# Comando por defecto de nginx
CMD ["nginx", "-g", "daemon off;"]
