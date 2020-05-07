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

## Linting

This repo is configured for linting. Linting rules are defined in the package.json file.

Gitlab pipelines are configured to enforce linting on the server so it is highly suggested to lint before committing otherwise the pipelines will fail. The following steps will set up a pre-commit hooks in your local repository that will run against changed files before they are committed.

1) Install eslint globally with ```npm install -g eslint```

2) In your talage-api root directory, create a new file at ```.git/hooks/pre-commit``` and populate it with the following:
	```
	#!/bin/sh

	STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep ".jsx\{0,1\}$")

	if [[ "$STAGED_FILES" = "" ]]; then
	exit 0
	fi

	PASS=true

	echo "\n\033[96;1mValidating Javascript:\033[0m"

	# Check for eslint
	which eslint &> /dev/null
	if [[ "$?" == 1 ]]; then
	echo "\t\033[41mPlease install ESlint\033[0m"
	exit 1
	fi

	for FILE in $STAGED_FILES
	do
	eslint "$FILE"

	if [[ "$?" != 0 ]]; then
		PASS=false
	fi
	done

	if ! $PASS; then
	echo "\033[41mCOMMIT FAILED:\033[0m \033[96;1mPlease fix the listed issues and commit again..\033[0m\n"
	exit 1
	else
	echo "\033[42mCOMMIT SUCCEEDED\033[0m\n"
	fi

	exit $?
	```

3) Make the file executable with ```chmod 755 .git/hooks/pre-commit```

## Notes:

- If you are running against a local MySQL instance and receive and error regarding incompatibility with "sql_mode=only_full_group_by", please notify someone of it immediately.