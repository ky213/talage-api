

## Get authorization token:
### Request
```
curl -X POST -H "Accept: application/json" -H "Content-Type: application/x-www-form-urlencoded" -d "client_id=X34Ta24BKwqB88nAwCFVAvWNXpRo3QPQ&client_secret=P7TwlBvyEk3Tk6GJ" "https://sdbx.hiscox.com/toolbox/auth/accesstoken"
```

### Response
```json
{
	"refresh_token_expires_in" : "0",
	"api_product_list" : "[ToolboxAPIs, DPD-Partner-v3, Pay_and_Bind]",
	"api_product_list_json" : [ "ToolboxAPIs", "DPD-Partner-v3", "Pay_and_Bind" ],
	"organization_name" : "hiscox-us",
	"developer.email" : "Matt@talageins.com",
	"token_type" : "Bearer",
	"issued_at" : "1586543407846",
	"client_id" : "X34Ta24BKwqB88nAwCFVAvWNXpRo3QPQ",
	"access_token" : "nGyB3MD0C61u2R855tnO5bVVcu0J",
	"application_name" : "f439c002-1727-4e3a-a855-cd73ac267da6",
	"scope" : "READ WRITE",
	"expires_in" : "3599",
	"refresh_count" : "0",
	"status" : "approved"
}
```

### Get current supported states:
### Request
```sh
curl -X GET -H "Accept: application/json" -H "Authorization: Bearer nGyB3MD0C61u2R855tnO5bVVcu0J" "https://sdbx.hiscox.com/partner/v1/states/"
```
### Response
```json
{
	"States": {
		"State": [
			{"name": "Alabama", "code": "AL"}
			{"name": "Alaska", "code": "AK"}
			{"name": "Arizona", "code": "AZ"}
			{"name": "Arkansas", "code": "AR"}
			{"name": "California", "code": "CA"}
			{"name": "Colorado", "code": "CO"}
			{"name": "Connecticut", "code": "CT"}
			{"name": "Delaware", "code": "DE"}
			{"name": "District Of Columbia", "code": "DC"}
			{"name": "Florida", "code": "FL"}
			{"name": "Georgia", "code": "GA"}
			{"name": "Hawaii", "code": "HI"}
			{"name": "Idaho", "code": "ID"}
			{"name": "Illinois", "code": "IL"}
			{"name": "Indiana", "code": "IN"}
			{"name": "Iowa", "code": "IA"}
			{"name": "Kansas", "code": "KS"}
			{"name": "Kentucky", "code": "KY"}
			{"name": "Louisiana", "code": "LA"}
			{"name": "Maine", "code": "ME"}
			{"name": "Maryland", "code": "MD"}
			{"name": "Massachusetts", "code": "MA"}
			{"name": "Michigan", "code": "MI"}
			{"name": "Minnesota", "code": "MN"}
			{"name": "Mississippi", "code": "MS"}
			{"name": "Missouri", "code": "MO"}
			{"name": "Montana", "code": "MT"}
			{"name": "Nebraska", "code": "NE"}
			{"name": "Nevada", "code": "NV"}
			{"name": "New Hampshire", "code": "NH"}
			{"name": "New Jersey", "code": "NJ"}
			{"name": "New Mexico", "code": "NM"}
			{"name": "New York", "code": "NY"}
			{"name": "North Carolina", "code": "NC"}
			{"name": "North Dakota", "code": "ND"}
			{"name": "Ohio", "code": "OH"}
			{"name": "Oklahoma", "code": "OK"}
			{"name": "Oregon", "code": "OR"}
			{"name": "Pennsylvania", "code": "PA"}
			{"name": "Rhode Island", "code": "RI"}
			{"name": "South Carolina", "code": "SC"}
			{"name": "South Dakota", "code": "SD"}
			{"name": "Tennessee", "code": "TN"}
			{"name": "Texas", "code": "TX"}
			{"name": "Utah", "code": "UT"}
			{"name": "Vermont", "code": "VT"}
			{"name": "Virginia", "code": "VA"}
			{"name": "Washington", "code": "WA"}
			{"name": "West Virginia", "code": "WV"}
			{"name": "Wisconsin", "code": "WI"}
			{"name": "Wyoming", "code": "WY"}
		]
	}
}
```

### Get a quote:
### Request
```sh
curl -X POST -H "Content-Type: application/xml" -H "Accept: application/json" -H "Authorization: Bearer nGyB3MD0C61u2R855tnO5bVVcu0J" "https://sdbx.hiscox.com/partner/v3/quote"
```

* Need to specify POST body listed below
* Ensure CoverageStartDate is in the future

```xml
<?xml version="1.0" encoding="UTF-8"?>
<InsuranceSvcRq>
	<SignonRq>
		<ClientApp>
			<Org>Test Org</Org>
			<Name>Test Name</Name>
			<Version>Test Ver</Version>
		</ClientApp>
	</SignonRq>
	<QuoteRq>
		<RqUID>134</RqUID>
		<QuoteID/>
		<QuoteRqDt>2020-05-01</QuoteRqDt>
		<StateOrProvCd>CT</StateOrProvCd>
		<ClassOfBusinessCd>DEE</ClassOfBusinessCd>
		<ProducerInfo>
			<ProducerUID>Test ProducerUID</ProducerUID>
			<ProducerType>Test Agent</ProducerType>
			<ProducerRegionalOffice>Atlanta</ProducerRegionalOffice>
			<ProducerAgency>Test ProducerAgencyTBD</ProducerAgency>
			<ProducerAgentID>Test ProducerAgentID</ProducerAgentID>
			<PersonName>
				<Title>Mrs.</Title>
				<Suffix>I</Suffix>
				<FirstName>Phillip</FirstName>
				<LastName>Smith</LastName>
			</PersonName>
			<CommunicationsInfo>
				<PhoneInfo>
					<PhoneNumber>6785551212</PhoneNumber>
					<PhoneExtension>1100</PhoneExtension>
				</PhoneInfo>
				<EmailInfo>
					<EmailAddr>SmithJames@hello.cf</EmailAddr>
				</EmailInfo>
			</CommunicationsInfo>
		</ProducerInfo>
		<BusinessInfo>
			<CommercialName>HISCOX TESTING</CommercialName>
			<PersonName>
				<Title>Mrs.</Title>
				<FirstName>Phillip</FirstName>
				<LastName>Smith</LastName>
			</PersonName>
			<CommunicationsInfo>
				<PhoneInfo>
					<PhoneNumber>8009998888</PhoneNumber>
					<PhoneExtension>1100</PhoneExtension>
				</PhoneInfo>
				<EmailInfo>
					<EmailAddr>uspittstoptesting@hiscox.nonprod</EmailAddr>
				</EmailInfo>
			</CommunicationsInfo>
			<Locations>
				<Primary>
					<AddrInfo>
						<Addr1>10 Downy St</Addr1>
						<City>Bristol</City>
						<StateOrProvCd>CT</StateOrProvCd>
						<PostalCode>06001</PostalCode>
						<Country>US</Country>
					</AddrInfo>
				</Primary>
				<Secondary>
					<AddrInfo>
						<Addr1>123 Needle way</Addr1>
						<City>Bristol</City>
						<StateOrProvCd>CT</StateOrProvCd>
						<PostalCode>06001</PostalCode>
						<Country>US</Country>
					</AddrInfo>
					<AddrInfo>
						<Addr1>123 Rain Alley</Addr1>
						<City>Bristol</City>
						<StateOrProvCd>CT</StateOrProvCd>
						<PostalCode>06001</PostalCode>
						<Country>US</Country>
					</AddrInfo>
				</Secondary>
			</Locations>
		</BusinessInfo>
		<ProductQuoteRqs>
			<GeneralLiabilityQuoteRq>
				<ProductId>CGL</ProductId>
				<RatingInfo>
					<OperatedFromHome>No</OperatedFromHome>
					<NumOfEmployees>21</NumOfEmployees>
					<SupplyManufactDistbtGoodsOrProducts>No</SupplyManufactDistbtGoodsOrProducts>
					<TangibleGoodWork>No</TangibleGoodWork>
					<HardwareWork>No</HardwareWork>
					<AdditionalLocation>2</AdditionalLocation>
					<BusinessOwnershipStructure>Limited liability company</BusinessOwnershipStructure>
					<SimilarInsurance>No</SimilarInsurance>
					<CoverageStartDate>2020-12-01</CoverageStartDate>
					<EstmtdPayrollExpense>500000</EstmtdPayrollExpense>
					<AgreeDisagreeToStatements>I have read and agree with these statements</AgreeDisagreeToStatements>
					<EmailConsent>Yes</EmailConsent>
					<InformationConfirmAgreement>Yes</InformationConfirmAgreement>
                                        <HireNonOwnVehclUse>Yes</HireNonOwnVehclUse>
				</RatingInfo>
				<GeneralLiabilityCoverQuoteRq>
					<CoverId>CGL</CoverId>
					<RatingInfo>
						<AggLOI>2000000</AggLOI>
						<LOI>1000000</LOI>
						<Deductible>0</Deductible>
					</RatingInfo>
				</GeneralLiabilityCoverQuoteRq>
				<TRIACoverQuoteRq>
					<CoverId>TRIA</CoverId>
				</TRIACoverQuoteRq>
			</GeneralLiabilityQuoteRq>
		</ProductQuoteRqs>
	</QuoteRq>
</InsuranceSvcRq>

```
### Request
```json
{
    "InsuranceSvcRs": {
        "SignonRs": {
            "ClientApp": {
                "Org": "Test Org",
                "Name": "Test Name",
                "Version": "Test Ver"
            }
        },
        "QuoteRs": {
            "RqUID": 134,
            "QuoteRqDt": "2020-05-01",
            "QuoteID": 9210474,
            "StateOrProvCd": "CT",
            "ClassOfBusinessCd": "DEE",
            "RetrieveURL": "https://uat.quote.hiscox.com/portalserver/partner-agent/partneragentdemo/quote-and-bind#?shortcut=retrieve&refid=523DEEB1-2170-4CEC-ABD1-46544F9F2B39",
            "ProductQuoteRs": {
                "Premium": {
                    "Annual": 901,
                    "Surcharge": 0,
                    "Monthly": 75.08,
                    "Downpayment": 150.2,
                    "NumberOfInstallments": 10
                },
                "GeneralLiabilityQuoteRs": {
                    "Premium": {
                        "Annual": 901
                    },
                    "TRIACoverageQuoteRs": {
                        "Premium": {
                            "Annual": 9
                        }
                    },
                    "RatingResult": {
                        "AggLOI": 2000000,
                        "LOI": 1000000,
                        "Deductible": 0
                    }
                }
            }
        }
    }
}
```