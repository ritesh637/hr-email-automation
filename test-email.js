require("dotenv").config();
const nodemailer = require("nodemailer");

async function testEmailConfig() {
    console.log("Testing email configuration...");
    console.log("Email user:", process.env.EMAIL_USER);
    console.log("Email pass:", process.env.EMAIL_PASS ? "***CONFIGURED***" : "NOT SET");
    
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        console.log("Verifying transporter...");
        await transporter.verify();
        console.log("✅ Email configuration is working!");
        
        // Test sending a test email
        const testMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself for testing
            subject: "Test Email - HR Automation System",
            text: "This is a test email from your HR automation system. If you receive this, your email configuration is working correctly!"
        };
        
        console.log("Sending test email...");
        await transporter.sendMail(testMailOptions);
        console.log("✅ Test email sent successfully!");
        
    } catch (error) {
        console.error("❌ Email configuration error:");
        console.error("Error details:", error.message);
        
        if (error.code === 'EAUTH') {
            console.log("\n🔧 Possible solutions:");
            console.log("1. Make sure 2-factor authentication is enabled on your Gmail account");
            console.log("2. Create an App Password at: https://myaccount.google.com/apppasswords");
            console.log("3. Use the App Password (not your regular password) in the .env file");
            console.log("4. Make sure 'Less secure app access' is NOT required when using App Passwords");
        }
    }
}

testEmailConfig();
