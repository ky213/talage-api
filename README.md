# Talage API

The Talage API is a unified set of services/endpoints used by the Talage system.


## Existing Talage Endpoints

### Public APIs
```
agency-portal/api (URL set in envvar $AGENCY_API_URL and replaced in the distribution files at startup)
	/account					GET, PUT
	/activities					GET
	/agencies					GET
	/agency						GET, POST
	/application				GET
	/applications				POST
	/banners					GET
	/changePassword				PUT
	/color-schemes				GET
	/create-agency				GET
	/landing-page				GET, POST, PUT
	/landing-pages				GET
	/questions					GET
	/quote-letter				GET
	/reports					GET
	/resetPassword				POST
	/settings					GET, PUT
	/uptime						GET
	/user-info					GET
	/validateToken				GET
	/wholesaleAgreement			GET, PUT

auth-api (auth.api.talageins.com)
	/							GET
	/token						GET						(alias of '/')
	/agency-portal				POST
	/uptime						GET

code-api (codes.api.talageins.com)
	/activity_codes				GET
	/industry_categories		GET
	/industry_codes				GET
	/uptime						GET

docs-api (docs.api.talageins.com)
	/acord-form-wc				GET
	/certificate				POST
	/uptime						GET

question-api (questions.api.talageins.com)
	/v1							GET
	/uptime						GET

quote-api (quotes.api.talageins.com)
	/							POST					(deprecated)
	/application				POST					(deprecated, alias of '/')
	/bind						PUT
	/uptime						GET
	/async						SOCKET

slack-api (slack.api.talageins.com)
	/post-to-channel			POST
	/uptime						GET
```

### Private APIs
```
docusign-service (http://docusign$NETWORK)
	/embedded					POST

email-service (http://email$NETWORK)
	/email						POST					(updated from '/')

encryption-service (http://encryption$NETWORK)
	/decrypt					POST
	/encrypt					POST
	/hash						POST
	/hashPassword				POST
	/verifyPassword				POST

file-service (http://file$NETWORK)
	/file						GET, DEL, PUT			(updated from '/')
	/list						GET
```

## Combined Talage Endpoints

Unified API combining public APIs and integrating Private APIs as internal modules

* Snakecase and CamelCase changed to spinal-case (hyphens) per suggestions in RFC3986 and RESTful conventions
* Removed plurality from top-level namespaces per RESTful conventions
```
/v1/
	wheelhouse/
		account						GET, PUT
		activities					GET
		agencies					GET
		agency						GET, POST
		application					GET
		applications				POST
		banners						GET
		change-password				PUT				(renamed from changePassword)
		color-schemes				GET
		create-agency				GET	
		landing-page				GET, POST, PUT
		landing-pages				GET
		questions					GET
		quote-letter				GET
		reports						GET
		reset-password				POST			(renamed from resetPassword)
		settings					GET, PUT
		user-info					GET
		validate-token				GET				(renamed from validateToken)
		wholesale-agreement			GET, PUT		(renamed from wholesaleAgreement)
	auth/
		token						GET
		agency-portal				POST
		uptime						GET

	code/
		activity-codes				GET				(renamed from activity_codes)
		industry-categories			GET				(renamed from industry_categories)
		industry-codes				GET				(renamed from industry_codes)
		uptime						GET

	doc/
		acord-form-wc				GET
		certificate					POST
		uptime						GET

	question/
		v1							GET				(renamed from v1)

	quote/
		application					POST
		bind						PUT
		async						SOCKET

	slack/
		post-to-channel				POST

	uptime							GET				(added)
```

## Future Development

Future development might include grouping endpoints by object and using path selectors. 

For example, in wheelhouse/:

```
	/agency							GET (list), PUT (create agency)
	/agency/:agency-id				GET (agency info)
	/application					GET (list)
	/application/:application-id	GET (application info)
	/user/:user-id					GET (user info)
	/user/:user-id/password			PATCH (change password), DELETE (reset password)
	/landing-page					GET (list)
	/landing-page/:landing-page-id	GET (landing page info)
```
