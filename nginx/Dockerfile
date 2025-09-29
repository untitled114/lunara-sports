FROM nginx:alpine

# Install certbot for Let's Encrypt
RUN apk add --no-cache certbot certbot-nginx openssl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directory for certificates
RUN mkdir -p /etc/letsencrypt/live/lunara-api.eastus.azurecontainer.io

# Create self-signed certificates for initial startup
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/lunara-api.eastus.azurecontainer.io/privkey.pem \
    -out /etc/letsencrypt/live/lunara-api.eastus.azurecontainer.io/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=lunara-api.eastus.azurecontainer.io"

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "Starting NGINX with SSL..."' >> /start.sh && \
    echo 'nginx -t && nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80 443

CMD ["/start.sh"]