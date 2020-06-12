'use strict';

module.exports = {
	// This is the base path needed to access authentication services at DocuSign
	"authBasePath": 'account-d.docusign.com',

	// This is the 'User ID' of the user to be impersonated. Before you can change this value, the user must allow this app.
	"impersonatedUser": '19b5fb30-3d75-4381-a44e-88d87c45f89a',

	// This is obtained from the DocuSign admin area under 'API and Keys'. An integration must be created in Sandbox first and then promoted to production.
	"integrationKey": '3c755991-135c-44da-a91a-a2d7bb25b342',

	// This is obtained from the DocuSign admin area under 'API and Keys' and is only shown once when the key is created. A backup of this key is in LastPass.
	"privateKey": `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAp4MKYfTgrsnunTeUgJ6nZ5rBa+K5hxsF9v2gAQLPlrhDntDh
MXY6B3fC9oMvd6OtW0Ac6NIwXgscAqkvido/LDft/+RzMakacMa/XhFyZJs53UfD
z9il8ZDnZcQWs7IzuNnoI29x5b2I++IQQPwK7ZBv2iLDn4ab+iw5lX2jG6lf3A83
BuD7n+iKdb6+WvLIvjKGBV2sV5arOX/+z+EQyGD5nfF5GHjZMCZItq7cqZ48IYBV
MmZaF61mluc+g7lZF95p9Deb0wHeLm0yjkF8T0/OoXJJcZ7BmqeSZQbEvc5GKh9a
VrwD0MIXecvWRzfBBH5SprjADrUk6FCo/hQkKwIDAQABAoIBACdDNq7JF9TALfaZ
rWwMQ86r3kQsSzIYqmg/AD7cas23+NmDuhS+0lEnyAHBs+GF8r8doukLQxz326Pg
Be14wy/ZGCbPZBSyvyjJ3NbunfJo08JC7OmNrS+WuDYJJQ0PasIcCSYtG/QuXao0
TXz91o3iOeVWGqYMhgi4TvL0FMQJqI/GVvN+Hc2ZYWld7MOxWLlCo+ZwvGTxSTbI
yHv7BLe0KBNdx2jTf+WGfhCW+iS47d4nvRYhBtMbADfJz5lamQUAziM9Ftl07I/n
V/F0bpeDS5dd2PVmll3MmC4vMfqTZzK7ca7MBhQmLC1ZWHCd/ePGICBOs+0aF56d
7JBTJDECgYEA5BVy2q8FbgQl2v3q2dS7XPHPsNpxps9i8ztgDaGwRtavbMZvCPHA
Y7IQ4MHtDKGfvRrVoKM/ClP0jDrQ5liMxB409KVwhNFY0xbwJveKuDHyGt5QhiVU
XOhKSOj8szHuuvzNxGWDLXCGSbqtC36vXxv/Y/TcLtbi9DCTJQYiDZkCgYEAvAOx
GOZ/SZ4bdnna9Om1Sg6gLQ+DXVCk8SvOIFTQIi0kS97lEZjqJMfbDM+GhVuWZKSc
88Hdc1Oh3aEy76OuACiDBmoJ7x3cvVmE4XHgcieAJfGa2X4PxIi3v4fQzYm3jM7Y
9Ax95tJsB0i8Zux9aHYvtLU/X6Qlo7cQiljpMmMCgYB8JZCWp510/Jz+Tid+2eQB
+zzpLn2eJlPdwPvPb6rbZA+oTXoyjCQEH/A/5k55CaBA9lJBVZoCrR/3FCyQtLIq
Lab1YveT079dZqbhDuxaxhTZuxhpa/g3edi1RtwFTbB75w65T+fO2+i8SPfXweUD
B+JDLgyLEjwGXko5ZNU0QQKBgF8LVrmJvAsRHDz2ONPaWUUIw7xDvVqs69TnGhqK
BXVhcJnSIeaVcLgLOBbvycccl5hlBtrKxBIK0ybg2IkAK3P1Btd1P3Rbmj02RdBZ
6uaKRWPpESila38kxg7Sr6FX3ywVXONydSr8cJP2FxfIsVTfehpWDaVhq41pe7kU
XT6VAoGAMEzRvEHCyo6hI/GDj61nLRCfr/XNmHqZsF0HTfMI1+uEcTMFJsPmc/B7
96vS7SvCAABS9DGYrrPbChM+MRjOG37qDFRoO5dm2moBgz9ov6Mo4DWksQWBOH6m
og5Ea/XGmopM2N9R9P851BYNN8zXWFi2L16PlQ/T4nk51iXg9vI=
-----END RSA PRIVATE KEY-----`
};