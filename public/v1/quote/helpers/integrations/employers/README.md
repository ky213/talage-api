# Employers API Integration

Current API Version supported: v3.2.15

Online Documentation: https://eigservices.atlassian.net/wiki/spaces/DUG/overview

Examples:

- [New Business Quote Example 1](https://eigservices.atlassian.net/wiki/spaces/DUG/pages/321093679)

- [New Business Quote Example 2](https://eigservices.atlassian.net/wiki/spaces/DUG/pages/316310094)

- [New Business Quote Example 3](https://eigservices.atlassian.net/wiki/spaces/DUG/pages/323158655)

## Running single tests

``` curl -X POST -H "Content-Type: text/xml" --data "@test.xml" https://api-qa.employers.com/DigitalAgencyServices/ws/AcordServices ```

where 'test.xml' contains the updated xml document you want to test. For convenience, you can install 'xmlformat' (```brew install xmlformat```) and then pipe the curl output to it.

```curl -is -X PUT -H "Content-Type: application/xml" -H "Accept: application/xml" -H "appKey: TALAGE" -H "appToken: 6e4fe5b9-c2ed-4286-a1ce-66ca49d4d379"  -d "@test2.xml" https://api-qa.employers.com/DigitalAgencyServices/acord```

## Changelog

- **2012-01-24 Scott**
	
	- Removed ```<GeneralPartyInfo>``` from ```<Producer>```. ```<ProducerInfo>``` is preferred

	- ```<CreditOrSurcharge>``` had children named the same instead of ```<NumericValue>``` as indicated by comments and spec (typo)
	
	- ```<Location>``` attribute 'id' changed to upper-case 'L' prefix (strict)
	
	- ```<WorkCompLocInfo><LocationRef>``` attribute 'LocationRef' changed to upper-case 'L' prefix (strict)
	
	- Moved ```<WorkCompLossOrPriorPolicy>``` under ```<WorkCompLineBusiness>``` instead of ```<Policy>```
	
	- Renamed ```experience_modififer``` to ```experience_modifier``` (typo)



