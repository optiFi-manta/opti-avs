<h1 align="center">OptiFi-AVS 👋</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-1.0-blue.svg?cacheSeconds=2592000" />
  <a href="#" target="_blank">
    <img alt="License: (MIT)" src="https://img.shields.io/badge/License-(MIT)-yellow.svg" />
  </a>
</p>

OptiFi AVS provides a streamlined solution for managing and automating tasks in the creator ecosystem.
This project utilizes Solidity, JavaScript, and other technologies to create a comprehensive toolkit for creators.
This application integrates with EigenLayer's Actively Validated Service using zk-fetch technology to securely proof the contract address data for user recommendation staking protocol with EigenLayer.


## Install

```sh
yarn
```

## Usage

```sh
yarn start:anvil
```

## Run tests

```sh
# Setup .env file
cp .env.example .env
cp contracts/.env.example contracts/.env

# Updates dependencies if necessary and builds the contracts 
yarn build

# Deploy the EigenLayer contracts
yarn deploy:core

# Deploy the Hello World AVS contracts
yarn deploy:creator

# (Optional) Update ABIs
yarn extract:abis

# Start the Operator application
yarn start:operator

```

```sh
# Start the createNewTasks application 
yarn start:traffic
```

### Environment Variables

| Variable               | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `RPC_URL`              | JSON-RPC provider URL                                    |
| `PRIVATE_KEY`          | Private key for the wallet                               |
| `APP_ID`               | Reclaim API application ID                               |
| `APP_SECRET`           | Reclaim API secret key                                   |



