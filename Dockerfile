# ---=== Base Build ===--- #

# Based on Alpine because of it's super small image size
FROM node:12.16.2-alpine AS base

# Create app directory
WORKDIR /home/node

# Get the package JSON
COPY . .

# Install python, sodium, and other dependencies, then insttall the app and remove gyp
RUN apk update \
	&& apk add --no-cache --virtual .gyp python make g++ automake autoconf libtool libsodium \
	&& npm install pm2 -g \
	&& npm install \
	&& apk del .gyp

# Expose the port on which our app runs
EXPOSE 3000 3008 4000

# Run the command to start the app
CMD ["pm2-runtime", "start", "pm2.json", "--watch"]