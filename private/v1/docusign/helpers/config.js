'use strict';

module.exports = {
	// This is the base path needed to access authentication services at DocuSign
	authBasePath: 'account.docusign.com',

	// This is the 'User ID' of the user to be impersonated. Before you can change this value, the user must allow this app.
	impersonatedUser: '4290a4ec-b2f5-4d90-a6ce-86e532b8156d',

	// This is obtained from the DocuSign admin area under 'API and Keys'. An integration must be created in Sandbox first and then promoted to production.
	integrationKey: 'f5f51cb9-af53-4906-b970-2de1b0a17270',

	// This is obtained from the DocuSign admin area under 'API and Keys' and is only shown once when the key is created. A backup of this key is in LastPass.
	privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEApcD5zBxOPg3B8QmD30ko/PMHWDdVvTf8YqHdRlAGfJQ7olPx
dmLP4P5z3kWVElBgAUuAu2v8S8aYRrZa4WMmnWDyp59As+2P0HBFSyLp3RSjPVrD
pUjJoUbmR4C+D1PtKhp2msFykJoyWo0iB0OSIuMYHcDayb9z06pu2vvuyJ1Qez4W
NlHxFc2TNVUramD5kqRxF9JiqLxppJ07IhxJ8sQlIsbMUju6lVaUpIioTnu1qDrt
nDaaGTTfGi5v959vUCO6tim0HUZArDBVR+p5zaTqs9NKxoLnwHQbVMY7bjVaNjLd
VBdOuNvOeK8WItmWrPysoMUJ5274CoKbM10RFwIDAQABAoIBAAZs4yIO7NeJ9/0s
hcCnmN+pWh0I1BmILI/0P1wk6QN2SZOC1obk0LMjmgFBSEST+gzCzQQ27OpREgEX
u5EmI06RfgaSbVMsP9lwKLd/bHpl/Of5d0EWf75xPacC7hsxAS4TJYrdOeAyIgaR
lwKaE3WnwP0SR0jv04Eeh7qUbo63PlyBLcu5Ns3p10k1AQsCIPnSANWEjYBzNw4G
5hPaO92qUCTRmeO0hn2/nymYd/aQQcfISrlD7dXMOA6eZ2IEJkWS27tete1FNfRi
IuvsPTKjF9SszP1/BWwTBauJdhgkslS23G6g30QZ8qxTFA26z2cYXJ2OwHt4dYIX
9ajQZY0CgYEA6APd18whcWp9f2MTER8W7eJG8Mv4koWgdhpv9uqHMXhPBVmpor1F
oBVmvLeaqBHoKOen0Y19rs4OrxwU6C61baB8eWjRuFe1X+ewKrC7M6IejMjokDWh
iQ8widW3NtROV05Ax64GW8pEpVlfMrNlL+l3hCGBCop2ihS+Yenw7c0CgYEAtuOL
vsCL13mrjeV5wGh+mPhdowIzfoPf5LPZUQonvaWEgqz5nvH6d5TVtAfFYrvS2Pqc
BuP7Q7G5oAMXduoQOAcbQhXTmGq1yWFJKrxaCavsf38h+66n8Mu4ldLIhJDA7H6F
/yDSIYonbp/duyXOrQIe256eIUym6SSgbQDdNnMCgYABMlPokwLxJM105LvqcLCb
lXksMMEdcFb9hPFi4p7D4Iz3yBiZ4EQFqVaYTpIbn8wEuf0hlYs6ZZGp0YlCEUua
PyOlNKcwPjOPRRChh7vPblyd+UNJyx0EKfHkJBgHzlyBEsQ+w2UBADAOckGNb2Ns
NdYJ9mpF9aTa3XSF6MD3WQKBgGCQVlm6Olvj/wOl1RoVUjqccHxADkZPhOixWR3j
2cXVXdjNUeNtaky3RfqPW9Xcy+AKulUdDK7aaOMmnr4HqdabUfYbpiREu4T/m+03
k+alYvKSgrPrrPqD5gsdRwhPkb2MtF1Xy/svgdB0ElPdC3nns7lLz7xPR5Wz5AyJ
t0MnAoGBAKwx4cAztqWqBjrOHgi/12SLGyB5Fv6AZJkWas9cxPI2Y7eAZqjWQd87
mBDS7wv05CZ9X5Q3y8KIX7tBCUuWTdwVLxxsoxUrnnyAbb0d63gBNlhSLOHl7mWI
rbArULLxnQMywWCwDFjGpp/TOFIpu9rs07Ax/2g4xghwMcayD6py
-----END RSA PRIVATE KEY-----`
};