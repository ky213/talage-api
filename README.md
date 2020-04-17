# Talage API

Unified API combining public APIs and integrating Private APIs as internal modules.

* Snakecase and CamelCase changed to spinal-case (hyphens) per suggestions in RFC3986 and RESTful conventions
* Removed plurality from top-level namespaces per RESTful conventions

## Building

Ensure you have a valid C and C++ compiler, 'make', 'automake', 'autoconf', and 'libtool' installed on the system. All are required to compile platform-specific npm packages. 

On a Mac, XCode will install the compilers and 'make. You can use homebrew to install the other requirements with ```brew install libtool autoconf automake```.

Once the build pre-requisites are install, run ```npm install``` to install all of the required node packages. This may take a bit on first run due to the encryption library build. 

## Configuring

Settings are loaded from the ```local.env``` file if it exists. Otherwise, settings are loaded from the environment. Use ```local.env.example``` as a template.

## Running

To run the public API, uptime, and private API servers: ```npm run```

## Public API

The default port is 3000. Override with $PUBLIC_API_PORT

```
Registered Endpoints
--------------------------------------------------------------------------------
POST   /v1/auth/agency-portal                   Get Token
GET    /v1/auth/token                           Get Token
GET    /v1/auth/                                Get Token (depr)
GET    /v1/code/activity-codes                  Get Activity Codes
GET    /v1/code/activity_codes                  Get Activity Codes (depr)
GET    /v1/code/industry-categories             Get All Industry Code Categories
GET    /v1/code/industry_categories             Get All Industry Code Categories (depr)
GET    /v1/code/industry-codes                  Get All Industry Codes
GET    /v1/code/industry_codes                  Get All Industry Codes (depr)
GET    /v1/doc/acord-form-wc                    Get Certificate
POST   /v1/doc/certificate                      Get Certificate
GET    /v1/question/list                        Get Questions
GET    /v1/question/v1                          Get Questions (depr)
POST   /v1/quote/application                    Post Application
POST   /v1/quote/                               Post Application (depr)
PUT    /v1/quote/bind                           Bind Quote
GET    /v1/wheelhouse/account                   Get account (auth)
PUT    /v1/wheelhouse/account                   Update account (auth)
GET    /v1/wheelhouse/activities                Get activities (auth)
GET    /v1/wheelhouse/agencies                  Get agencies (auth)
GET    /v1/wheelhouse/agency                    Get Agency (auth)
POST   /v1/wheelhouse/agency                    Post Agency (auth)
GET    /v1/wheelhouse/application               Get application (auth)
POST   /v1/wheelhouse/applications              Get applications (auth)
GET    /v1/wheelhouse/banners                   Get Banners (auth)
PUT    /v1/wheelhouse/change-password           Change Password
PUT    /v1/wheelhouse/changePassword            Change Password (depr)
GET    /v1/wheelhouse/color-schemes             Get Color Schemes (auth)
GET    /v1/wheelhouse/create-agency             Create Agency (auth)
GET    /v1/wheelhouse/landing-page              Get Landing Page (auth)
POST   /v1/wheelhouse/landing-page              Post Landing Page (auth)
PUT    /v1/wheelhouse/landing-page              Put Landing Page (auth)
GET    /v1/wheelhouse/landing-pages             Get Landing Pages (auth)
GET    /v1/wheelhouse/questions                 Get questions (auth)
GET    /v1/wheelhouse/quote-letter              Get Quote Letter (auth)
GET    /v1/wheelhouse/reports                   Get reports (auth)
POST   /v1/wheelhouse/resend-onboarding-email   Resend Onboarding Email (auth)
POST   /v1/wheelhouse/resendOnboardingEmail     Resend Onboarding Email (depr) (auth)
POST   /v1/wheelhouse/reset-password            Reset Password
POST   /v1/wheelhouse/resetPassword             Reset Password (depr)
GET    /v1/wheelhouse/settings                  Get settings (auth)
PUT    /v1/wheelhouse/settings                  Update settings (auth)
PUT    /v1/wheelhouse/terms-of-service          Record Acceptance of TOS (auth)
GET    /v1/wheelhouse/user-info                 Get user information (auth)
GET    /v1/wheelhouse/validate-token            Validate JWT (auth)
GET    /v1/wheelhouse/validateToken             Validate JWT (depr) (auth)
GET    /v1/wheelhouse/wholesale-agreement       Get Wholesale Agreement Link (auth)
GET    /v1/wheelhouse/wholesaleAgreement        Get Wholesale Agreement Link (depr) (auth)
PUT    /v1/wheelhouse/wholesale-agreement       Record Signature of Wholesale Agreement Link (auth)
PUT    /v1/wheelhouse/wholesaleAgreement        Record Signature of Wholesale Agreement Link (depr) (auth)
```

## Uptime Endpoint

The default port is 3008. Override with $UPTIME_PORT

```
Registered Endpoints
--------------------------------------------------------------------------------
GET    /                                        Uptime Check
```

## Private API

The default port is 4000. Override with $PRIVATE_API_PORT.

```
Registered Endpoints
--------------------------------------------------------------------------------
POST   /v1/docusign/embedded                    Create Embedded DocuSign Document
POST   /v1/email/email                          Post Email
POST   /v1/email/                               Post Email (depr)
POST   /v1/encryption/decrypt                   Decrypt
POST   /v1/encryption/encrypt                   Encrypt
POST   /v1/encryption/verify-password           Verify Password
POST   /v1/encryption/verifyPassword            Verify Password (depr)
POST   /v1/encryption/hash                      Hash
POST   /v1/encryption/hash-password             Hash Password
POST   /v1/encryption/hashPassword              Hash Password (depr)
GET    /v1/file/file                            File
GET    /v1/file/                                File (depr)
PUT    /v1/file/file                            File
PUT    /v1/file/                                File (depr)
DELETE /v1/file/file                            File
DELETE /v1/file/                                File (depr)
GET    /v1/file/list                            List Files
POST   /v1/slack/post-to-channel                Post message
```

## Future Development

Future development might include grouping endpoints by object and using path selectors. 

For example, in wheelhouse/:

```
    /agency                            GET (list), PUT (create agency)
    /agency/:agency-id                 GET (agency info)
    /application                       GET (list)
    /application/:application-id       GET (application info)
    /user/:user-id                     GET (user info)
    /user/:user-id/password            PATCH (change password), DELETE (reset password)
    /landing-page                      GET (list)
    /landing-page/:landing-page-id     GET (landing page info)
```
