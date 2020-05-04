# Talage API

Unified API combining public APIs and integrating Private APIs as internal modules.

* Snakecase and CamelCase changed to spinal-case (hyphens) per suggestions in RFC3986 and RESTful conventions
* Removed plurality from top-level namespaces per RESTful conventions

## Pre-Requisites

### Mac OSX:
	- Install X Code from the App Store, the install the command-line utilities:
```
		xcode-select --install
```

	- Install [Node 12](https://nodejs.org/en/)
```
		brew install node@12
```
		NOTE: if the ```node``` command can not be found, run 
```
		brew link node@12 --force
```
	- Install build tools using [Homebrew](https://brew.sh/):
```
		brew install libtool autoconf automake
```

### Linux (Amazon/CentOS):
	- Install the build system and Node 12:
```
	sudo yum group install "Development Tools"
	curl -sL https://rpm.nodesource.com/setup_12.x | sudo bash -
	sudo yum install -y nodejs
```

## Building

Once the build pre-requisites are install, run ```npm install``` to install all of the required node packages. This may take a bit on first run due to the encryption library build. 

## Configuring

Settings are loaded from the ```local.env``` file if it exists. Otherwise, settings are loaded from the environment. Use ```local.env.example``` as a template.

## Running

To run the public API, uptime, and private API servers: ```npm run serve```

For development, it may be convenient to use 'nodemon' to automatically hot reload the server when files are changed. Install 'nodemon' using ```npm install -g nodemon``` and run the server with ```nodemon index.js```.

For deployment with pm2, run ```pm2 start --name "Talage API" index.js && pm2 save```

## Notes:

- If you are running against a local MySQL instance and receive and error regarding incompatibility with "sql_mode=only_full_group_by", please make a note of it and workaround it by running this query locally: ```SET GLOBAL sql_mode='';```