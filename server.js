require("dotenv").config();
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Email configuration - You'll need to set up these environment variables
const createEmailTransporter = () => {
    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};


// Function to extract emails from Excel file
const extractEmailsFromExcel = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const emails = [];
        
        // Look for email addresses in all cells
        data.forEach(row => {
            row.forEach(cell => {
                if (typeof cell === 'string') {
                    // Extract email addresses using regex
                    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
                    const foundEmails = cell.match(emailRegex);
                    if (foundEmails) {
                        emails.push(...foundEmails);
                    }
                }
            });
        });
        
        // Remove duplicates and filter valid emails
        const uniqueEmails = [...new Set(emails)].filter(email => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        });
        
        return uniqueEmails;
    } catch (error) {
        console.error('Error reading Excel file:', error);
        return [];
    }
};

// Main route to serve the HTML file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to send emails
app.post("/send-emails", upload.fields([
    { name: 'excelFile', maxCount: 1 },
    { name: 'resumeFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const { subject, message } = req.body;
        const excelFile = req.files.excelFile[0];
        const resumeFile = req.files.resumeFile[0];
        
        // Extract emails from Excel file
        const emails = extractEmailsFromExcel(excelFile.path);
        
        if (emails.length === 0) {
            return res.status(400).json({ 
                error: 'No valid email addresses found in the Excel file. Please check your Excel file format.' 
            });
        }
        
        // Create email transporter
        const transporter = createEmailTransporter();
        
        // Send emails to all HR contacts
        let successCount = 0;
        const failedEmails = [];
        
        for (const email of emails) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER || 'your-email@gmail.com',
                    to: email,
                    subject: subject || 'Job Application - Resume',
                    text: message || 'Please find attached my resume.',
                    attachments: [
                        {
                            filename: resumeFile.originalname,
                            path: resumeFile.path
                        }
                    ]
                };
                
                await transporter.sendMail(mailOptions);
                successCount++;
                console.log(`Email sent successfully to ${email}`);
                
                // Add delay between emails to avoid spam detection
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send email to ${email}:`, error);
                failedEmails.push(email);
            }
        }
        
        // Clean up uploaded files
        fs.unlinkSync(excelFile.path);
        fs.unlinkSync(resumeFile.path);
        
        if (successCount > 0) {
            res.json({
                success: true,
                message: `Successfully sent ${successCount} emails out of ${emails.length}`,
                emailCount: successCount,
                emails: emails.filter(email => !failedEmails.includes(email)),
                failedEmails: failedEmails
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to send any emails. Please check your email configuration.' 
            });
        }
        
    } catch (error) {
        console.error('Error in send-emails endpoint:', error);
        res.status(500).json({ 
            error: 'Server error: ' + error.message 
        });
    }
});

// Test endpoint to verify email configuration
app.get("/test-email", async (req, res) => {
    try {
        const transporter = createEmailTransporter();
        await transporter.verify();
        res.json({ success: true, message: 'Email configuration is working' });
    } catch (error) {
        res.status(500).json({ error: 'Email configuration error: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 HR Email Automation Server running on port ${PORT}`);
    console.log(`📧 Open http://localhost:${PORT} to start sending emails`);
    console.log(`\n⚠️  IMPORTANT: Make sure to set up your email credentials in .env file:`);
    console.log(`   EMAIL_USER=your-email@gmail.com`);
    console.log(`   EMAIL_PASS=your-app-password`);
});
