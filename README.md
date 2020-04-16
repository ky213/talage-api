# Talage API

Unified API combining public APIs and integrating Private APIs as internal modules.

* Snakecase and CamelCase changed to spinal-case (hyphens) per suggestions in RFC3986 and RESTful conventions
* Removed plurality from top-level namespaces per RESTful conventions

## Building

Ensure you have a valid C and C++ compiler, 'make', 'automake', 'autoconf', and 'libtool' installed on the system. All are required to compile platform-specific npm packages. 

On a Mac, XCode will install the compilers and 'make. You can use homebrew to install the other requirements with ```brew install libtool autoconf automake```.

Once the build pre-requisites are install, run ```npm install``` to install all of the required node packages. This may take a bit on first run due to the encryption library build. 

## Running

To run the public API: ```npm run public```

To run the private API: ```npm run private```

## Public API

Public URL: ```https://api.talageins.com```

```
/v1/
    wheelhouse/
        account                 GET, PUT
        activities              GET
        agencies                GET
        agency                  GET, POST
        application             GET
        applications            POST
        banners                 GET
        change-password         PUT               (renamed from changePassword)
        color-schemes           GET
        create-agency           GET    
        landing-page            GET, POST, PUT
        landing-pages           GET
        questions               GET
        quote-letter            GET
        reports                 GET
        reset-password          POST              (renamed from resetPassword)
        settings                GET, PUT
        user-info               GET
        validate-token          GET               (renamed from validateToken)
        wholesale-agreement     GET, PUT          (renamed from wholesaleAgreement)
    auth/
        token                   GET
        agency-portal           POST

    code/
        activity-codes          GET               (renamed from activity_codes)
        industry-categories     GET               (renamed from industry_categories)
        industry-codes          GET               (renamed from industry_codes)

    doc/
        acord-form-wc           GET
        certificate             POST

    question/
        list                    GET               (renamed from v1)

    quote/
        application             POST
        bind                    PUT
        async                   SOCKET

    uptime                      GET               (added)
```

## Private API

Private URL: ```http://localhost:4000```
```
/v1/
    docusign/
        embedded               POST
    crypto/
        encrypt                POST
        decrypt                POST
        hash                   POST
        hash-password          POST
        verify-password        POST
    message/
        slack                  POST
        email                  POST
    file/
        file                   GET, PUT, DEL
        list                   GET
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
