FROM node:14

RUN apt update && apt install -y

WORKDIR /usr/app

COPY . .

RUN npm install -g node-pre-gyp@0.10.0 typescript ts-node
ENV HIDDEN_SERVICE_SECRET=PT0gZWQyNTUxOXYxLXNlY3JldDogdHlwZTAgPT0AAAAQkgFVlORzGDm3lqox4kSq9fUNFEA3vvByA5t/QzlieuHgUB94sNTFAeh+UKjgAjH3EG49nq4pEarji/s/mlXM
RUN npm install

CMD ["ts-node", "src/test.ts"]
