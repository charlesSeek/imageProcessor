#  image processor lambda function

This is image processor lambda function which generates image thumbnails

## Requirements

* AWS CLI already configured with at least PowerUser permission
* [NodeJS 10.x+ installed](https://nodejs.org/en/download/)
* [Docker installed](https://www.docker.com/community-edition)

## Setup process

### Installing dependencies

```bash
cd image_processor
npm install
cd ../
```

### lambda deployment

```bash
make deploy ENV=[environment] #environment: dev, staging, uat, prod
```