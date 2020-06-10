FROM node:10.18.1
WORKDIR /HOME

# prepare dependency
COPY . /HOME/gazelle
WORKDIR /HOME/gazelle
RUN npm i
RUN npm run bootstrap
RUN npm run build


# start aggregator process
WORKDIR /HOME/e2e-tests

COPY ./integration-test/e2e-tests/package.json package.json
COPY ./integration-test/e2e-tests/config.local.json config.local.json
COPY ./integration-test/e2e-tests/tokenConfig.local.json tokenConfig.local.json
COPY ./integration-test/e2e-tests/tsconfig.json tsconfig.json

RUN npm i

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
  && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
  && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

CMD dockerize -wait tcp://ganache:8545 -wait tcp://aggregator:3000 npm test
