FROM node:20.11.1-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends openssl \
    ca-certificates gnupg iputils-ping
#Create app directory
WORKDIR /usr/src/app
RUN sed -i 's/providers = provider_sect/#providers = provider_sect/g' /etc/ssl/openssl.cnf
RUN sed -i 's/^MinProtocol.*/MinProtocol = TLSv1/g' /etc/ssl/openssl.cnf
RUN sed -i 's/^CipherString.*/CipherString = DEFAULT:@SECLEVEL=1/g' /etc/ssl/openssl.cnf

#Create app directory
WORKDIR /usr/src/app

ADD node_modules/rest.portal2 /usr/src/rest.portal/build/src
WORKDIR /usr/src/rest.portal/build/src
RUN npm install
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

RUN ls /usr/src/app/node_modules/rest.portal
ADD build/src /usr/src/app/build/src
WORKDIR /usr/src/app
EXPOSE 9050
USER root
CMD ["npm","run","startdocker"]