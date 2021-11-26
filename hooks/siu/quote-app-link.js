const Hook = require('../Hook.js');


module.exports = class AmTrustAppEditHints extends Hook {
    async _process_hook(){
        log.debug(`in SIU quote-app-link ` + __location)
        if(!this.appDoc){
            return;
        }
        //If htmlBody was sent by client.  Email is already customized
        if(this.dataPackageJSON.options?.htmlBody){
            return;
        }
        log.debug(`in SIU quote-app-link Pass data checks ` + __location)
        //if agencyNetwork user requested the link,
        // convert email to link for Agency Portal
        if(this.dataPackageJSON.options?.isAgencyNetworkUser){
            let apDomain = "https://siu.insurancewheelhouse.com"
            switch(global.settings.ENV){
                case "development":
                    apDomain = "http://localhost:8080";
                    break;
                case "awsdev":
                    apDomain = "https://dev.insurancewheelhouse.com";
                    break;
                case "staging":
                    apDomain = "https://sta.insurancewheelhouse.com";
                    break;
                case "demo":
                    apDomain = "https://demo.insurancewheelhouse.com";
                    break;
                case "production":
                    apDomain = "https://siu.insurancewheelhouse.com";
                    break;
                default:
                    // dont send the email
                    log.error(`Failed to generating application link, invalid environment. ${__location}`);
                    return;
            }

            const subjectText = `${this.dataPackageJSON.appDoc.businessName} SIU Cross-Sell Alert`
            const link = `${apDomain}/applications/application/${this.appDoc.applicationId}`;
            let htmlBody = `
                <p>
                    Hello${this.dataPackageJSON.options.firstName ? ` ${this.dataPackageJSON.options.firstName}` : ""}${this.dataPackageJSON.options.lastName ? ` ${this.dataPackageJSON.options.lastName}` : ""},
                </p>
                <p>
                We noticed that we currently have a policy on the books for one of your insureds and would like to offer a competitive <STRONG>workers’ compensation</STRONG> quote with a few clicks of a button! We know you are busy, so we went ahead and prefilled the application with the information we had on file. All you have to do is click the link below to validate the prefilled policy information and click submit to instantly receive multiple premium indications or bindable quotes.
                </p>
                <p>Need Help? Email wcsupport@siuins.com or call call 678.498.4594.</p>
                
                <p align="center"><em>(Password reset instructions below. If you received this email we have already
                    registered your email in to our new comparative rating portal)</em></p>
                <p align="center"><STRONG>Click The Button Below to Review your insured’s Workers’ Compensation Application</STRONG></p>
                
                <div align="center">
                    <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-spacing: 0; border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;font-family:arial,helvetica,sans-serif;"><tr><td style="font-family:arial,helvetica,sans-serif;" align="center"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="" style="height:45px; v-text-anchor:middle; width:120px;" arcsize="9%" stroke="f" fillcolor="#3AAEE0"><w:anchorlock/><center style="color:#FFFFFF;font-family:arial,helvetica,sans-serif;"><![endif]-->
                    <a href="{{link}}" target="_blank" style="box-sizing: border-box;display: inline-block;font-family:arial,helvetica,sans-serif;text-decoration: none;-webkit-text-size-adjust: none;text-align: center;color: #FFFFFF; background-color: #3AAEE0; border-radius: 4px; -webkit-border-radius: 4px; -moz-border-radius: 4px; width:auto; max-width:100%; overflow-wrap: break-word; word-break: break-word; word-wrap:break-word; mso-border-alt: none;">
                        <span style="display:block;padding:10px 20px;line-height:120%;"><span style="font-size: 14px; line-height: 16.8px;">Open Application</span></span>
                    </a>
                    <!--[if mso]></center></v:roundrect></td></tr></table><![endif]-->
                </div>

                <p align="center">
                If the button does not work try pasting this link into your browser:
                <br/>
                    <a href="${link}" target="_blank">
                        ${link}
                    </a>
                </p>
                <p><STRONG>Password Reset:</STRONG>
                </p>
                <p>If you do not have your password go to https://siu.insurancewheelhouse.com/ and click “forgot password” and a password reset will be sent to your account.</p>
                

                <p align="center"><STRONG>Become A Digital Agency Today </STRONG>
                </p>

                <p align="center"><STRONG>No Acords Needed, Multi-Carrier Pricing & Unlimited Agency Branded Insured Facing Landing Pages for Target Marketing or Agency Website Rating  
                </STRONG>
                </p>
            `
            htmlBody = htmlBody.replace(/{{link}}/g, link);

            this.dataPackageJSON.htmlBody = htmlBody
            this.dataPackageJSON.emailSubject = subjectText
            this.dataPackageJSON.branding = ''
            this.dataPackageJSON.link = link
            log.debug(`in SIU quote-app-link Finished update ` + __location);
            return;
        }


    }
}