"use strict";
const axios = require("axios");
const moment = require("moment");
const serverHelper = global.requireRootPath("server.js");

const ApplicationUpload = global.mongoose.ApplicationUpload;
const Agency = global.mongoose.Agency;
const AgencyLocation = global.mongoose.AgencyLocation;
const IndustryCode = global.mongoose.IndustryCode;

const ocrResult = [
  {
    question: "Page 1",
    questionTag: "Page 1",
    answer: "Page 1 of 4",
    page: 0,
  },
  {
    question: "Form",
    questionTag: "Form",
    answer: "ACORD 130 (2017/05)",
    page: 0,
  },
  {
    question: "Date",
    questionTag: "Date",
    answer: "03/03/2022",
    page: 0,
  },
  {
    question: "Agency Name And Address",
    questionTag: "Agency Name And Address",
    answer: "AmTrust WC QA\n300 South Wells Ave\nRENO NV 89502",
    page: 0,
  },
  {
    question: "Producer Name",
    questionTag: "Producer Name",
    answer: "Scott Fritzinger",
    page: 0,
  },
  {
    question: "CS Representative Name",
    questionTag: "CS Representative Name",
    answer: "",
    page: 0,
  },
  {
    question: "Agency Office Phone",
    questionTag: "Agency Office Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Agency Mobile Phone",
    questionTag: "Agency Mobile Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Agency Fax",
    questionTag: "Agency Fax",
    answer: "",
    page: 0,
  },
  {
    question: "Agency Email",
    questionTag: "Agency Email",
    answer: "scott+amtrust-wc-ga@talageins.com",
    page: 0,
  },
  {
    question: "Code",
    questionTag: "Code",
    answer: "",
    page: 0,
  },
  {
    question: "Sub Code",
    questionTag: "Sub Code",
    answer: "",
    page: 0,
  },
  {
    question: "Agency Customer ID",
    questionTag: "Agency Customer ID",
    answer: "",
    page: 0,
  },
  {
    question: "Company",
    questionTag: "Company",
    answer: "AmTrust",
    page: 0,
  },
  {
    question: "Underwriter",
    questionTag: "Underwriter",
    answer: "",
    page: 0,
  },
  {
    question: "Applicant Name",
    questionTag: "Applicant Name",
    answer: "Jim's | Deli & Restaurant |",
    page: 0,
  },
  {
    question: "Applicant Office Phone",
    questionTag: "Applicant Office Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Applicant Mobile Phone",
    questionTag: "Applicant Mobile Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Applicant Mailing Address",
    questionTag: "Applicant Mailing Address",
    answer: "371 Washington Street\nBoston MA 02135",
    page: 0,
  },
  {
    question: "Years In Business",
    questionTag: "Years In Business",
    answer: "",
    page: 0,
  },
  {
    question: "SIC",
    questionTag: "SIC",
    answer: "8721",
    page: 0,
  },
  {
    question: "NAICS",
    questionTag: "NAICS",
    answer: "541219",
    page: 0,
  },
  {
    question: "Website",
    questionTag: "Website",
    answer: "http://jimsdelitogo.com/",
    page: 0,
  },
  {
    question: "Email",
    questionTag: "Email",
    answer: "pdimaria+wh@talageins.com",
    page: 0,
  },
  {
    question: "Sole Proprietor",
    questionTag: "Sole Proprietor",
    answer: "",
    page: 0,
  },
  {
    question: "Partnership",
    questionTag: "Partnership",
    answer: "",
    page: 0,
  },
  {
    question: "Corporation",
    questionTag: "Corporation",
    answer: "",
    page: 0,
  },
  {
    question: "S Corp",
    questionTag: "S Corp",
    answer: "",
    page: 0,
  },
  {
    question: "LLC",
    questionTag: "LLC",
    answer: "",
    page: 0,
  },
  {
    question: "Joint Venture",
    questionTag: "Joint Venture",
    answer: "",
    page: 0,
  },
  {
    question: "Trust",
    questionTag: "Trust",
    answer: "",
    page: 0,
  },
  {
    question: "Entity Other",
    questionTag: "Entity Other",
    answer: "X",
    page: 0,
  },
  {
    question: "Unicorporated Association",
    questionTag: "Unicorporated Association",
    answer: "",
    page: 0,
  },
  {
    question: "Entity Other Desc",
    questionTag: "Entity Other Desc",
    answer: "",
    page: 0,
  },
  {
    question: "Credit Bureau",
    questionTag: "Credit Bureau",
    answer: "",
    page: 0,
  },
  {
    question: "ID Number",
    questionTag: "ID Number",
    answer: "",
    page: 0,
  },
  {
    question: "FEIN",
    questionTag: "FEIN",
    answer: "554444444",
    page: 0,
  },
  {
    question: "NCCI Risk ID Number",
    questionTag: "NCCI Risk ID Number",
    answer: "",
    page: 0,
  },
  {
    question: "Other Rating Bureau ID",
    questionTag: "Other Rating Bureau ID",
    answer: "",
    page: 0,
  },
  {
    question: "Status Quote",
    questionTag: "Status Quote",
    answer: "X",
    page: 0,
  },
  {
    question: "Status Bound",
    questionTag: "Status Bound",
    answer: "",
    page: 0,
  },
  {
    question: "Status Assigned Risk",
    questionTag: "Status Assigned Risk",
    answer: "",
    page: 0,
  },
  {
    question: "Status Issue Policy",
    questionTag: "Status Issue Policy",
    answer: "",
    page: 0,
  },
  {
    question: "Billing Agency",
    questionTag: "Billing Agency",
    answer: "",
    page: 0,
  },
  {
    question: "Billing Direct",
    questionTag: "Billing Direct",
    answer: "X",
    page: 0,
  },
  {
    question: "Payment Annual",
    questionTag: "Payment Annual",
    answer: "",
    page: 0,
  },
  {
    question: "Payment Semi-Annual",
    questionTag: "Payment Semi-Annual",
    answer: "",
    page: 0,
  },
  {
    question: "Payment Quarterly",
    questionTag: "Payment Quarterly",
    answer: "",
    page: 0,
  },
  {
    question: "Payment Other",
    questionTag: "Payment Other",
    answer: "",
    page: 0,
  },
  {
    question: "Payment % Down",
    questionTag: "Payment % Down",
    answer: "",
    page: 0,
  },
  {
    question: "Audit At Expiration",
    questionTag: "Audit At Expiration",
    answer: "",
    page: 0,
  },
  {
    question: "Audit Semi-Annual",
    questionTag: "Audit Semi-Annual",
    answer: "",
    page: 0,
  },
  {
    question: "Audit Quarterly",
    questionTag: "Audit Quarterly",
    answer: "",
    page: 0,
  },
  {
    question: "Audit Monthly",
    questionTag: "Audit Monthly",
    answer: "",
    page: 0,
  },
  {
    question: "Audit Other",
    questionTag: "Audit Other",
    answer: "",
    page: 0,
  },
  {
    question: "Location 1 Number",
    questionTag: "Location 1 Number",
    answer: "1",
    page: 0,
  },
  {
    question: "Location 1 Highest Floor",
    questionTag: "Location 1 Highest Floor",
    answer: "",
    page: 0,
  },
  {
    question: "Location 1 Address",
    questionTag: "Location 1 Address",
    answer: "371 Washington Street\nMA 02135",
    page: 0,
  },
  {
    question: "Location 2 Number",
    questionTag: "Location 2 Number",
    answer: "",
    page: 0,
  },
  {
    question: "Location 2 Highest Floor",
    questionTag: "Location 2 Highest Floor",
    answer: "",
    page: 0,
  },
  {
    question: "Location 2 Address",
    questionTag: "Location 2 Address",
    answer: "",
    page: 0,
  },
  {
    question: "Location 3 Number",
    questionTag: "Location 3 Number",
    answer: "",
    page: 0,
  },
  {
    question: "Location 3 Highest Floor",
    questionTag: "Location 3 Highest Floor",
    answer: "",
    page: 0,
  },
  {
    question: "Location 3 Address",
    questionTag: "Location 3 Address",
    answer: "",
    page: 0,
  },
  {
    question: "Policy Proposed Eff Date",
    questionTag: "Policy Proposed Eff Date",
    answer: "12/28/2021",
    page: 0,
  },
  {
    question: "Proposed Exp Date",
    questionTag: "Proposed Exp Date",
    answer: "12/28/2022",
    page: 0,
  },
  {
    question: "Rating Eff Date",
    questionTag: "Rating Eff Date",
    answer: "",
    page: 0,
  },
  {
    question: "Anniversary Rating Date",
    questionTag: "Anniversary Rating Date",
    answer: "",
    page: 0,
  },
  {
    question: "Policy Participating",
    questionTag: "Policy Participating",
    answer: "",
    page: 0,
  },
  {
    question: "Policy Non-Participating",
    questionTag: "Policy Non-Participating",
    answer: "",
    page: 0,
  },
  {
    question: "Retro Plan",
    questionTag: "Retro Plan",
    answer: "",
    page: 0,
  },
  {
    question: "Workers Comp States",
    questionTag: "Workers Comp States",
    answer: "MA",
    page: 0,
  },
  {
    question: "Liability Each Accident",
    questionTag: "Liability Each Accident",
    answer: "100,000",
    page: 0,
  },
  {
    question: "Liability Disease Limit",
    questionTag: "Liability Disease Limit",
    answer: "500,000",
    page: 0,
  },
  {
    question: "Liability Disease Employee",
    questionTag: "Liability Disease Employee",
    answer: "100,000",
    page: 0,
  },
  {
    question: "Other States Insurance",
    questionTag: "Other States Insurance",
    answer: "",
    page: 0,
  },
  {
    question: "Deductable Medical",
    questionTag: "Deductable Medical",
    answer: "",
    page: 0,
  },
  {
    question: "Deductable Indemnity",
    questionTag: "Deductable Indemnity",
    answer: "",
    page: 0,
  },
  {
    question: "Deductable Other",
    questionTag: "Deductable Other",
    answer: "",
    page: 0,
  },
  {
    question: "Deductable Amount",
    questionTag: "Deductable Amount",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages USLH",
    questionTag: "Other Coverages USLH",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages Voluntary Comp",
    questionTag: "Other Coverages Voluntary Comp",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages Foreign Comp",
    questionTag: "Other Coverages Foreign Comp",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages Managed Care",
    questionTag: "Other Coverages Managed Care",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages Other 1",
    questionTag: "Other Coverages Other 1",
    answer: "",
    page: 0,
  },
  {
    question: "Other Coverages Other 2",
    questionTag: "Other Coverages Other 2",
    answer: "",
    page: 0,
  },
  {
    question: "Divident Plan",
    questionTag: "Divident Plan",
    answer: "",
    page: 0,
  },
  {
    question: "Additional Company Info",
    questionTag: "Additional Company Info",
    answer: "",
    page: 0,
  },
  {
    question: "Additional Coverages",
    questionTag: "Additional Coverages",
    answer: "",
    page: 0,
  },
  {
    question: "Total All States Annual Premium",
    questionTag: "Total All States Annual Premium",
    answer: "",
    page: 0,
  },
  {
    question: "Total All States Minimum Premium",
    questionTag: "Total All States Minimum Premium",
    answer: "",
    page: 0,
  },
  {
    question: "Total All States Deposit Premium",
    questionTag: "Total All States Deposit Premium",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Inspection Name",
    questionTag: "Contact Inspection Name",
    answer: "Peter DiMaria",
    page: 0,
  },
  {
    question: "Contact Inspection Office Phone",
    questionTag: "Contact Inspection Office Phone",
    answer: "(617) 787-2626",
    page: 0,
  },
  {
    question: "Contact Inspection Mobile Phone",
    questionTag: "Contact Inspection Mobile Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Inspection Email",
    questionTag: "Contact Inspection Email",
    answer: "pdimaria+wh@talageins.com",
    page: 0,
  },
  {
    question: "Contact Accounting Name",
    questionTag: "Contact Accounting Name",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Accounting Office Phone",
    questionTag: "Contact Accounting Office Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Accounting Mobile Phone",
    questionTag: "Contact Accounting Mobile Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Accounting Email",
    questionTag: "Contact Accounting Email",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Claims Name",
    questionTag: "Contact Claims Name",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Claims Office Phone",
    questionTag: "Contact Claims Office Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Claims Mobile Phone",
    questionTag: "Contact Claims Mobile Phone",
    answer: "",
    page: 0,
  },
  {
    question: "Contact Claims Email",
    questionTag: "Contact Claims Email",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 1 State",
    questionTag: "Individual 1 State",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 1 Location",
    questionTag: "Individual 1 Location",
    answer: "1",
    page: 0,
  },
  {
    question: "Individual 1 Name",
    questionTag: "Individual 1 Name",
    answer: "Peter DiMaria",
    page: 0,
  },
  {
    question: "Individual 1 DOB",
    questionTag: "Individual 1 DOB",
    answer: "12/11/2021",
    page: 0,
  },
  {
    question: "Individual 1 Title",
    questionTag: "Individual 1 Title",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 1 Ownership",
    questionTag: "Individual 1 Ownership",
    answer: "100",
    page: 0,
  },
  {
    question: "Individual 1 Duties",
    questionTag: "Individual 1 Duties",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 1 Inc Exc",
    questionTag: "Individual 1 Inc Exc",
    answer: "EXC",
    page: 0,
  },
  {
    question: "Individual 1 Class Code",
    questionTag: "Individual 1 Class Code",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 1 Remuneration",
    questionTag: "Individual 1 Remuneration",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 State",
    questionTag: "Individual 2 State",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Location",
    questionTag: "Individual 2 Location",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Name",
    questionTag: "Individual 2 Name",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 DOB",
    questionTag: "Individual 2 DOB",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Title",
    questionTag: "Individual 2 Title",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Ownership",
    questionTag: "Individual 2 Ownership",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Duties",
    questionTag: "Individual 2 Duties",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Inc Exc",
    questionTag: "Individual 2 Inc Exc",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Class Code",
    questionTag: "Individual 2 Class Code",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 2 Remuneration",
    questionTag: "Individual 2 Remuneration",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 State",
    questionTag: "Individual 3 State",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Location",
    questionTag: "Individual 3 Location",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Name",
    questionTag: "Individual 3 Name",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 DOB",
    questionTag: "Individual 3 DOB",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Title",
    questionTag: "Individual 3 Title",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Ownership",
    questionTag: "Individual 3 Ownership",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Duties",
    questionTag: "Individual 3 Duties",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Inc Exc",
    questionTag: "Individual 3 Inc Exc",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Class Code",
    questionTag: "Individual 3 Class Code",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 3 Remuneration",
    questionTag: "Individual 3 Remuneration",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 State",
    questionTag: "Individual 4 State",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Location",
    questionTag: "Individual 4 Location",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Name",
    questionTag: "Individual 4 Name",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 DOB",
    questionTag: "Individual 4 DOB",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Title",
    questionTag: "Individual 4 Title",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Ownership",
    questionTag: "Individual 4 Ownership",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Duties",
    questionTag: "Individual 4 Duties",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Inc Exc",
    questionTag: "Individual 4 Inc Exc",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Class Code",
    questionTag: "Individual 4 Class Code",
    answer: "",
    page: 0,
  },
  {
    question: "Individual 4 Remuneration",
    questionTag: "Individual 4 Remuneration",
    answer: "",
    page: 0,
  },
  {
    question: "Page 2",
    questionTag: "Page 2",
    answer: "Page 2 of 4",
    page: 1,
  },
  {
    question: "Rating 1 Location",
    questionTag: "Rating 1 Location",
    answer: "1",
    page: 1,
  },
  {
    question: "Rating 1 Class Code",
    questionTag: "Rating 1 Class Code",
    answer: "8803-00",
    page: 1,
  },
  {
    question: "Rating 1 Description Code",
    questionTag: "Rating 1 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 1 Categories",
    questionTag: "Rating 1 Categories",
    answer: "Auditor, Accountant or Factory Cost or\nOffice Systematizer—Traveling",
    page: 1,
  },
  {
    question: "Rating 1 Employees Fulltime",
    questionTag: "Rating 1 Employees Fulltime",
    answer: "1",
    page: 1,
  },
  {
    question: "Rating 1 Employees Parttime",
    questionTag: "Rating 1 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 1 SIC",
    questionTag: "Rating 1 SIC",
    answer: "8721",
    page: 1,
  },
  {
    question: "Rating 1 NAICS",
    questionTag: "Rating 1 NAICS",
    answer: "541219",
    page: 1,
  },
  {
    question: "Rating 1 Annual Remuneration",
    questionTag: "Rating 1 Annual Remuneration",
    answer: "$1000",
    page: 1,
  },
  {
    question: "Rating 1 Rate",
    questionTag: "Rating 1 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 1 Annual Premium",
    questionTag: "Rating 1 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Location",
    questionTag: "Rating 2 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Class Code",
    questionTag: "Rating 2 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Description Code",
    questionTag: "Rating 2 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Categories",
    questionTag: "Rating 2 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Employees Fulltime",
    questionTag: "Rating 2 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Employees Parttime",
    questionTag: "Rating 2 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 SIC",
    questionTag: "Rating 2 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 NAICS",
    questionTag: "Rating 2 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Annual Remuneration",
    questionTag: "Rating 2 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Rate",
    questionTag: "Rating 2 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 2 Annual Premium",
    questionTag: "Rating 2 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Location",
    questionTag: "Rating 3 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Class Code",
    questionTag: "Rating 3 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Description Code",
    questionTag: "Rating 3 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Categories",
    questionTag: "Rating 3 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Employees Fulltime",
    questionTag: "Rating 3 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Employees Parttime",
    questionTag: "Rating 3 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 SIC",
    questionTag: "Rating 3 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 NAICS",
    questionTag: "Rating 3 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Annual Remuneration",
    questionTag: "Rating 3 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Rate",
    questionTag: "Rating 3 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 3 Annual Premium",
    questionTag: "Rating 3 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Location",
    questionTag: "Rating 4 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Class Code",
    questionTag: "Rating 4 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Description Code",
    questionTag: "Rating 4 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Categories",
    questionTag: "Rating 4 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Employees Fulltime",
    questionTag: "Rating 4 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Employees Parttime",
    questionTag: "Rating 4 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 SIC",
    questionTag: "Rating 4 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 NAICS",
    questionTag: "Rating 4 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Annual Remuneration",
    questionTag: "Rating 4 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Rate",
    questionTag: "Rating 4 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 4 Annual Premium",
    questionTag: "Rating 4 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Location",
    questionTag: "Rating 5 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Class Code",
    questionTag: "Rating 5 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Description Code",
    questionTag: "Rating 5 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Categories",
    questionTag: "Rating 5 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Employees Fulltime",
    questionTag: "Rating 5 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Employees Parttime",
    questionTag: "Rating 5 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 SIC",
    questionTag: "Rating 5 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 NAICS",
    questionTag: "Rating 5 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Annual Remuneration",
    questionTag: "Rating 5 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Rate",
    questionTag: "Rating 5 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 5 Annual Premium",
    questionTag: "Rating 5 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Location",
    questionTag: "Rating 6 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Class Code",
    questionTag: "Rating 6 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Description Code",
    questionTag: "Rating 6 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Categories",
    questionTag: "Rating 6 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Employees Fulltime",
    questionTag: "Rating 6 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Employees Parttime",
    questionTag: "Rating 6 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 SIC",
    questionTag: "Rating 6 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 NAICS",
    questionTag: "Rating 6 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Annual Remuneration",
    questionTag: "Rating 6 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Rate",
    questionTag: "Rating 6 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 6 Annual Premium",
    questionTag: "Rating 6 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Location",
    questionTag: "Rating 7 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Class Code",
    questionTag: "Rating 7 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Description Code",
    questionTag: "Rating 7 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Categories",
    questionTag: "Rating 7 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Employees Fulltime",
    questionTag: "Rating 7 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Employees Parttime",
    questionTag: "Rating 7 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 SIC",
    questionTag: "Rating 7 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 NAICS",
    questionTag: "Rating 7 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Annual Remuneration",
    questionTag: "Rating 7 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Rate",
    questionTag: "Rating 7 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 7 Annual Premium",
    questionTag: "Rating 7 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Location",
    questionTag: "Rating 8 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Class Code",
    questionTag: "Rating 8 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Description Code",
    questionTag: "Rating 8 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Categories",
    questionTag: "Rating 8 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Employees Fulltime",
    questionTag: "Rating 8 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Employees Parttime",
    questionTag: "Rating 8 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 SIC",
    questionTag: "Rating 8 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 NAICS",
    questionTag: "Rating 8 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Annual Remuneration",
    questionTag: "Rating 8 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Rate",
    questionTag: "Rating 8 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 8 Annual Premium",
    questionTag: "Rating 8 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Location",
    questionTag: "Rating 9 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Class Code",
    questionTag: "Rating 9 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Description Code",
    questionTag: "Rating 9 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Categories",
    questionTag: "Rating 9 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Employees Fulltime",
    questionTag: "Rating 9 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Employees Parttime",
    questionTag: "Rating 9 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 SIC",
    questionTag: "Rating 9 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 NAICS",
    questionTag: "Rating 9 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Annual Remuneration",
    questionTag: "Rating 9 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Rate",
    questionTag: "Rating 9 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 9 Annual Premium",
    questionTag: "Rating 9 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Location",
    questionTag: "Rating 10 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Class Code",
    questionTag: "Rating 10 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Description Code",
    questionTag: "Rating 10 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Categories",
    questionTag: "Rating 10 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Employees Fulltime",
    questionTag: "Rating 10 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Employees Parttime",
    questionTag: "Rating 10 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 SIC",
    questionTag: "Rating 10 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 NAICS",
    questionTag: "Rating 10 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Annual Remuneration",
    questionTag: "Rating 10 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Rate",
    questionTag: "Rating 10 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 10 Annual Premium",
    questionTag: "Rating 10 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Location",
    questionTag: "Rating 11 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Class Code",
    questionTag: "Rating 11 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Description Code",
    questionTag: "Rating 11 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Categories",
    questionTag: "Rating 11 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Employees Fulltime",
    questionTag: "Rating 11 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Employees Parttime",
    questionTag: "Rating 11 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 SIC",
    questionTag: "Rating 11 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 NAICS",
    questionTag: "Rating 11 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Annual Remuneration",
    questionTag: "Rating 11 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Rate",
    questionTag: "Rating 11 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 11 Annual Premium",
    questionTag: "Rating 11 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Location",
    questionTag: "Rating 12 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Class Code",
    questionTag: "Rating 12 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Description Code",
    questionTag: "Rating 12 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Categories",
    questionTag: "Rating 12 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Employees Fulltime",
    questionTag: "Rating 12 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Employees Parttime",
    questionTag: "Rating 12 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 SIC",
    questionTag: "Rating 12 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 NAICS",
    questionTag: "Rating 12 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Annual Remuneration",
    questionTag: "Rating 12 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Rate",
    questionTag: "Rating 12 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 12 Annual Premium",
    questionTag: "Rating 12 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Location",
    questionTag: "Rating 13 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Class Code",
    questionTag: "Rating 13 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Description Code",
    questionTag: "Rating 13 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Categories",
    questionTag: "Rating 13 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Employees Fulltime",
    questionTag: "Rating 13 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Employees Parttime",
    questionTag: "Rating 13 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 SIC",
    questionTag: "Rating 13 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 NAICS",
    questionTag: "Rating 13 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Annual Remuneration",
    questionTag: "Rating 13 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Rate",
    questionTag: "Rating 13 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 13 Annual Premium",
    questionTag: "Rating 13 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Location",
    questionTag: "Rating 14 Location",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Class Code",
    questionTag: "Rating 14 Class Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Description Code",
    questionTag: "Rating 14 Description Code",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Categories",
    questionTag: "Rating 14 Categories",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Employees Fulltime",
    questionTag: "Rating 14 Employees Fulltime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Employees Parttime",
    questionTag: "Rating 14 Employees Parttime",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 SIC",
    questionTag: "Rating 14 SIC",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 NAICS",
    questionTag: "Rating 14 NAICS",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Annual Remuneration",
    questionTag: "Rating 14 Annual Remuneration",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Rate",
    questionTag: "Rating 14 Rate",
    answer: "",
    page: 1,
  },
  {
    question: "Rating 14 Annual Premium",
    questionTag: "Rating 14 Annual Premium",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Total Factor",
    questionTag: "Premium Total Factor",
    answer: "N/A",
    page: 1,
  },
  {
    question: "Premium Total Amount",
    questionTag: "Premium Total Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Other1 Factor",
    questionTag: "Premium Other1 Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Other1 Amount",
    questionTag: "Premium Other1 Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Increased Limits Factor",
    questionTag: "Premium Increased Limits Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Increased Limits Amount",
    questionTag: "Premium Increased Limits Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Schedule Rating Factor",
    questionTag: "Premium Schedule Rating Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Schedule Rating Amount",
    questionTag: "Premium Schedule Rating Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Deductable Factor",
    questionTag: "Premium Deductable Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Deductable Amount",
    questionTag: "Premium Deductable Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium CCPAP Factor",
    questionTag: "Premium CCPAP Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium SCCPAP Amount",
    questionTag: "Premium SCCPAP Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Experience Factor",
    questionTag: "Premium Experience Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Experience Amount",
    questionTag: "Premium Experience Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Standard Factor",
    questionTag: "Premium Standard Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Standard Amount",
    questionTag: "Premium Standard Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Terrorism Factor",
    questionTag: "Premium Terrorism Factor",
    answer: "N/A",
    page: 1,
  },
  {
    question: "Premium Terrorism Amount",
    questionTag: "Premium Terrorism Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Discount Factor",
    questionTag: "Premium Discount Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Discount Amount",
    questionTag: "Premium Discount Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Catastrophe Factor",
    questionTag: "Premium Catastrophe Factor",
    answer: "N/A",
    page: 1,
  },
  {
    question: "Premium Catastrophe Amount",
    questionTag: "Premium Catastrophe Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Expense Factor",
    questionTag: "Premium Expense Factor",
    answer: "N/A",
    page: 1,
  },
  {
    question: "Premium Expense Amount",
    questionTag: "Premium Expense Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Assigned Risk Factor",
    questionTag: "Premium Assigned Risk Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Assigned Risk Amount",
    questionTag: "Premium Assigned Risk Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Taxes Factor",
    questionTag: "Premium Taxes Factor",
    answer: "N/A",
    page: 1,
  },
  {
    question: "Premium Taxes Amount",
    questionTag: "Premium Taxes Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium ARAP Factor",
    questionTag: "Premium ARAP Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium ARAP Amount",
    questionTag: "Premium ARAP Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Other2 Factor",
    questionTag: "Premium Other2 Factor",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Other2 Amount",
    questionTag: "Premium Other2 Amount",
    answer: "$",
    page: 1,
  },
  {
    question: "Premium Total Estimated",
    questionTag: "Premium Total Estimated",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Total Minimum",
    questionTag: "Premium Total Minimum",
    answer: "",
    page: 1,
  },
  {
    question: "Premium Total Deposit",
    questionTag: "Premium Total Deposit",
    answer: "",
    page: 1,
  },
  {
    question: "Remarks",
    questionTag: "Remarks",
    answer: "",
    page: 1,
  },
  {
    question: "Page 3",
    questionTag: "Page 3",
    answer: "Page 3 of 4",
    page: 2,
  },
  {
    question: "Prior Policy 1 Year",
    questionTag: "Prior Policy 1 Year",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Premium",
    questionTag: "Prior Policy 1 Premium",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 MOD",
    questionTag: "Prior Policy 1 MOD",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Num Claims",
    questionTag: "Prior Policy 1 Num Claims",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Amount Paid",
    questionTag: "Prior Policy 1 Amount Paid",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Reserve",
    questionTag: "Prior Policy 1 Reserve",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Company",
    questionTag: "Prior Policy 1 Company",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 1 Policy Num",
    questionTag: "Prior Policy 1 Policy Num",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Year",
    questionTag: "Prior Policy 2 Year",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Premium",
    questionTag: "Prior Policy 2 Premium",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 MOD",
    questionTag: "Prior Policy 2 MOD",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Num Claims",
    questionTag: "Prior Policy 2 Num Claims",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Amount Paid",
    questionTag: "Prior Policy 2 Amount Paid",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Reserve",
    questionTag: "Prior Policy 2 Reserve",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Company",
    questionTag: "Prior Policy 2 Company",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 2 Policy Num",
    questionTag: "Prior Policy 2 Policy Num",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Year",
    questionTag: "Prior Policy 3 Year",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Premium",
    questionTag: "Prior Policy 3 Premium",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 MOD",
    questionTag: "Prior Policy 3 MOD",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Num Claims",
    questionTag: "Prior Policy 3 Num Claims",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Amount Paid",
    questionTag: "Prior Policy 3 Amount Paid",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Reserve",
    questionTag: "Prior Policy 3 Reserve",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Company",
    questionTag: "Prior Policy 3 Company",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 3 Policy Num",
    questionTag: "Prior Policy 3 Policy Num",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Year",
    questionTag: "Prior Policy 4 Year",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Premium",
    questionTag: "Prior Policy 4 Premium",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 MOD",
    questionTag: "Prior Policy 4 MOD",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Num Claims",
    questionTag: "Prior Policy 4 Num Claims",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Amount Paid",
    questionTag: "Prior Policy 4 Amount Paid",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Reserve",
    questionTag: "Prior Policy 4 Reserve",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Company",
    questionTag: "Prior Policy 4 Company",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 4 Policy Num",
    questionTag: "Prior Policy 4 Policy Num",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Year",
    questionTag: "Prior Policy 5 Year",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Premium",
    questionTag: "Prior Policy 5 Premium",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 MOD",
    questionTag: "Prior Policy 5 MOD",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Num Claims",
    questionTag: "Prior Policy 5 Num Claims",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Amount Paid",
    questionTag: "Prior Policy 5 Amount Paid",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Reserve",
    questionTag: "Prior Policy 5 Reserve",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Company",
    questionTag: "Prior Policy 5 Company",
    answer: "",
    page: 2,
  },
  {
    question: "Prior Policy 5 Policy Num",
    questionTag: "Prior Policy 5 Policy Num",
    answer: "",
    page: 2,
  },
  {
    question: "Nature of Business",
    questionTag: "Nature of Business",
    answer: "Other Accounting Services",
    page: 2,
  },
  {
    question: "1. DOES APPLICANT OWN, OPERATE OR LEASE AIRCRAFT / WATERCRAFT?",
    questionTag: "Q1",
    answer: "",
    page: 2,
  },
  {
    question:
      "2. DO/HAVE PAST, PRESENT OR DISCONTINUED OPERATIONS INVOLVE(D) STORING, TREATING, DISCHARGING, APPLYING, DISPOSING, OR\nTRANSPORTING OF HAZARDOUS MATERIAL? (e.g. landfills, wastes, fuel tanks, etc)",
    questionTag: "Q2",
    answer: "",
    page: 2,
  },
  {
    question: "3. ANY WORK PERFORMED UNDERGROUND OR ABOVE 15 FEET?",
    questionTag: "Q3",
    answer: "",
    page: 2,
  },
  {
    question: "4. ANY WORK PERFORMED ON BARGES, VESSELS, DOCKS, BRIDGE OVER WATER?",
    questionTag: "Q4",
    answer: "",
    page: 2,
  },
  {
    question: "5. IS APPLICANT ENGAGED IN ANY OTHER TYPE OF BUSINESS?",
    questionTag: "Q5",
    answer: "",
    page: 2,
  },
  {
    question: '6. ARE SUB-CONTRACTORS USED? (If "YES", give % of work subcontracted)',
    questionTag: "Q6",
    answer: "",
    page: 2,
  },
  {
    question:
      '7. ANY WORK SUBLET WITHOUT CERTIFICATES OF INSURANCE? (If "YES", payroll for this work must be included in the State Rating Worksheet on Page 2)',
    questionTag: "Q7",
    answer: "",
    page: 2,
  },
  {
    question: "8. ISAWRITTEN SAFETY PROGRAM IN OPERATION?",
    questionTag: "Q8",
    answer: "",
    page: 2,
  },
  {
    question: "9. ANY GROUP TRANSPORTATION PROVIDED?",
    questionTag: "Q9",
    answer: "",
    page: 2,
  },
  {
    question: "10. ANY EMPLOYEES UNDER 16 OR OVER 60 YEARS OF AGE?",
    questionTag: "Q10",
    answer: "",
    page: 2,
  },
  {
    question: "11. ANY SEASONAL EMPLOYEES?",
    questionTag: "Q11",
    answer: "",
    page: 2,
  },
  {
    question: '12. IS THERE ANY VOLUNTEER OR DONATED LABOR? (If "YES", please specify)',
    questionTag: "Q12",
    answer: "",
    page: 2,
  },
  {
    question: "13. ANY EMPLOYEES WITH PHYSICAL HANDICAPS?",
    questionTag: "Q13",
    answer: "",
    page: 2,
  },
  {
    question: '14, DO EMPLOYEES TRAVEL OUT OF STATE? (If "YES", indicate state(s) of travel and frequency)',
    questionTag: "Q14",
    answer: "",
    page: 2,
  },
  {
    question: "15. ARE ATHLETIC TEAMS SPONSORED?",
    questionTag: "Q15",
    answer: "",
    page: 2,
  },
  {
    question: "16. ARE PHYSICALS REQUIRED AFTER OFFERS OF EMPLOYMENT ARE MADE?",
    questionTag: "Q16",
    answer: "",
    page: 2,
  },
  {
    question: "Page 4",
    questionTag: "Page 4",
    answer: "Page 4 of 4",
    page: 3,
  },
  {
    question: "17. ANY OTHER INSURANCE WITH THIS INSURER?",
    questionTag: "Q17",
    answer: "",
    page: 3,
  },
  {
    question:
      "18. ANY PRIOR COVERAGE DECLINED / CANCELLED / NON-RENEWED IN THE LAST THREE (3) YEARS? (Missouri Applicants - Do not answer this question)",
    questionTag: "Q18",
    answer: "",
    page: 3,
  },
  {
    question: "19. ARE EMPLOYEE HEALTH PLANS PROVIDED?",
    questionTag: "Q19",
    answer: "",
    page: 3,
  },
  {
    question: "20. DO ANY EMPLOYEES PERFORM WORK FOR OTHER BUSINESSES OR SUBSIDIARIES?",
    questionTag: "Q20",
    answer: "",
    page: 3,
  },
  {
    question: "21. DO YOU LEASE EMPLOYEES TO OR FROM OTHER EMPLOYERS?",
    questionTag: "Q21",
    answer: "",
    page: 3,
  },
  {
    question: '22. DO ANY EMPLOYEES PREDOMINANTLY WORK AT HOME? If "YES", # of Employees:',
    questionTag: "Q22",
    answer: "",
    page: 3,
  },
  {
    question: '23. ANY TAX LIENS OR BANKRUPTCY WITHIN THE LAST FIVE (5) YEARS? (If "YES", please specify)',
    questionTag: "Q23",
    answer: "",
    page: 3,
  },
  {
    question:
      "24. ANY UNDISPUTED AND UNPAID WORKERS COMPENSATION PREMIUM DUE FROM YOU OR ANY COMMONLY MANAGED OR OWNED ENTERPRISES?\nIF YES, EXPLAIN INCLUDING ENTITY NAME(S) AND POLICY NUMBER(S).",
    questionTag: "Q24",
    answer: "",
    page: 3,
  },
  {
    question: "Does business have more than 50 people working at one location at a time?",
    questionTag: "Q1",
    answer: "No",
    page: 4,
  },
  {
    question: "Does business currently have workers compensation coverage in effect?",
    questionTag: "Q2",
    answer: "Yes",
    page: 4,
  },
  {
    question:
      "In the past 2 years has business had 2 or more Workers Compensation\nclaims, a single Workers Compensation claim over 20K, or any employee\nwho ciiffered a waork related initirv reaniirina mare than 2 dave off of work?",
    questionTag: "Q3",
    answer: "No",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q4",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q5",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q6",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q7",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q8",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q9",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q10",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q11",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q12",
    answer: "",
    page: 4,
  },
  {
    question: "-",
    questionTag: "Q13",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q14",
    answer: "",
    page: 4,
  },
  {
    question: "S",
    questionTag: "Q15",
    answer: "",
    page: 4,
  },
];

/**
 * Validates data
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]}   arrary of acord files
 */
function validateFiles(files) {
  for (const file of files) {
    //Check emptiness
    if (!file.data) {
      file.valid = false;
      file.error = "empty file";

      continue;
    }

    //Check data type
    if (typeof file.data !== "string") {
      file.valid = false;
      file.error = "file data type should be of String type";

      continue;
    }

    //Check file extension
    if (!file.fileName.endsWith(".pdf") && file.extension !== "pdf") {
      file.valid = false;
      file.error = "file extension is not supported. Only pdf is suported";

      continue;
    }

    //Check file size
    const buffer = Buffer.from(file.data);

    if (buffer.byteLength > 2_000_000) {
      //2 MBs max
      file.valid = false;
      file.error = "file size should not exceed 2 MBs";

      continue;
    }
    // else {
    //     file.data = buffer.toString("binary");
    // }

    file.valid = true;
  }

  return files;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} files - arrary of acord files
 *
 * @returns {object[]} - arrary of acord files meta data with requestId
 */
async function submitacordsForRecognition(files) {
  for await (const file of files) {
    try {
      const response = await axios.request({
        method: "POST",
        url: "https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/queue/pdf/acord130/201705",
        data: Buffer.from(file.data, "base64"),
        headers: { "Content-Type": "application/pdf" },
      });
      file.requestId = response.data?.requestId;
    } catch (error) {
      file.error = error.message;
      log.error(`Error processing file: ${file.fileName}`, __location);
    }

    file.data = null;
  }

  return files;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object} ocrResult -  OCR result object
 *
 * @returns {object} - application object
 */
async function mapResultToApplicationObject() {
  // normalize data
  const data = {};
  for (const element of ocrResult) {
    if (element.answer) {
      if (element.answer === "X") {
        data[element.question] = element.question;
      } else {
        data[element.question] = element.answer;
      }
    }
  }

  const applicationUpload = new ApplicationUpload();
  const address = data["Agency Name And Address"];
  const [agencyName, addressLine1, addressLine2] = address?.split("\n");
  const [city, state, zipcode] = addressLine2.split(" ");

  try {
    const agency = await Agency.findOne({ name: agencyName }).exec();

    if (agency) {
      const agencyLocation = await AgencyLocation.findOne({
        agencyId: agency.systemId,
        city: city,
        state: state,
        zipcode: zipcode,
      }).exec();
      const industryCode = await IndustryCode.findOne({ sic: data["SIC"] }).exec();

      applicationUpload.agencyId = agency.systemId;
      applicationUpload.agencyNetworkId = agency.agencyNetworkId;
      applicationUpload.agencyLocationId = agencyLocation?.systemId;
      applicationUpload.industryCode = industryCode?.industryCodeId;
    } else {
      return { success: false, error: "agency not found" };
    }
  } catch (error) {
    log.error(`Error mapping OCR result :${error.message}`, __location);
    return { succes: false, message: "Error mapping OCR result" };
  }

  // entity type
  const entityTypeAnswer =
    data["Sole Proprietor"] ||
    data["Partnership"] ||
    data["Corporation"] ||
    data["S Corp"] ||
    data["LLC"] ||
    data["Joint Venture"] ||
    data["Trust"] ||
    "Other";

  applicationUpload.entityType = entityTypeAnswer;

  // business info
  applicationUpload.businessName = data["Applicant Name"];
  applicationUpload.hasEin = Boolean(data["FEIN"]);
  applicationUpload.ein = Boolean(data["FEIN"]);
  const [streetAddress, region] = data["Applicant Mailing Address"]?.split("\n");
  const [businessCity, businessState, businessZipCode] = region?.split(" ");
  applicationUpload.mailingAddress = streetAddress;
  applicationUpload.mailingCity = businessCity;
  applicationUpload.mailingState = businessState;
  applicationUpload.mailingZipcode = businessZipCode;
  applicationUpload.website = data["Website"];

  // business owners
  const businessOwners = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith("Individual")) {
      const [_, ownerIndex, field] = key.split(" ");
      let owner = businessOwners[ownerIndex - 1];

      if (!owner) {
        owner = {};
        businessOwners[ownerIndex - 1] = owner;
      }

      switch (field) {
        case "Name":
          const [fname, lname] = value.split(" ");
          owner.fname = fname;
          owner.lname = lname;
          break;
        case "DOB":
          owner.birthdate = moment(value).format();
          break;
        case "Ownership":
          owner.ownership = Number(value);
          break;
        case "Inc":
          owner.include = value === "INC";
          break;
        default:
          break;
      }
    }
  });

  applicationUpload.numOwners = businessOwners.length;
  applicationUpload.owners = businessOwners;


  return agency;
}

/**
 * Sends the valid acords list to aws OCR endpoint
 *
 * @param {object[]} resultObjects - arrary of OCR acord files objects
 *
 * @returns {void}
 */
async function saveApplications(resultObjects) {
  // map result to application object
  const applicationObjects = [];

  for (const object of resultObjects) {
    if (object.data?.status === "SUCCESS" && object.data?.ocrResponse?.length !== 0) {
      applicationObjects.push(mapResultToApplicationObject(object));
    }
  }
  // save application
}

/**
 * Get the acord status and data after OCR request submission
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordsStatuses(req, res, next) {
  const files = req.body.acords;
  // Check for data
  if (!files?.length) {
    log.info("Bad Request: No data received" + __location);
    return next(serverHelper.requestError("Bad Request: No data received"));
  }

  for (const file of files) {
    try {
      const response = await axios.request({
        method: "GET",
        url: `https://ufg7wet2m3.execute-api.us-east-1.amazonaws.com/production/ocr/status/${file.requestId}`,
      });

      file.data = response?.data;
    } catch (error) {
      file.data = null;
      file.error = error.message;
      log.error(`Error getting file status: ${file.fileName}`, __location);
    }
  }

  res.send(files);
  next();
}

/**
 * Receives a list of scanned acord files, parse them with an OCR api and then send back the json format version.
 *
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {function} next - The next function to execute
 *
 * @returns {void}
 */
async function getacordOCR(req, res, next) {
  await mapResultToApplicationObject();
  // Check for data
  if (!req.body.files?.length) {
    log.info("Bad Request: No data received" + __location);
    return next(serverHelper.requestError("Bad Request: No data received"));
  }

  // Check for number of files
  if (req.body.files.length > 10) {
    log.info("Bad Request: exceeded number of files (10)" + __location);
    return next(serverHelper.requestError("Bad Request: Max number of files is 10"));
  }

  //validateFiles
  const acords = validateFiles(req.body.files);
  const validFiles = acords.filter(({ valid }) => valid);

  if (validFiles.length === 0) {
    log.info("Bad Request: No valid files received" + __location);
    return next(serverHelper.requestError("Bad Request: No valid files received"));
  }

  // submit acords for OCR recognition
  const result = await submitacordsForRecognition(validFiles);

  //save application
  await saveApplications(result);

  res.send(result);

  next();
}

exports.registerEndpoint = (server, basePath) => {
  server.addPostAuth("POST acord files for OCR", `${basePath}/acord-ocr`, getacordOCR);
  server.addPostAuth("GET acord files statuses", `${basePath}/acord-ocr/status`, getacordsStatuses);
};
