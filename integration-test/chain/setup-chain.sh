#!/bin/bash
set -m

# start chain with db
ganache-cli --mnemonic "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" --db /HOME/db &
GANACHE_PID=$!

# deploy contracts to chain
npm i
npm run build
npm run deploy:dev
npm run deployToken:dev

# kill chain process
kill $GANACHE_PID