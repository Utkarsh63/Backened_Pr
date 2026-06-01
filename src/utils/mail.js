import Mailgen from  "mailgen" ;
import nodemailer from "nodemailer" ;

// creating an email just (below code)

// Creating Mailgen instance
const sendEmail = async (options) => {
    const mailGenerator = new Mailgen ({
        theme : "default",
        product : {
            name : "TaskManager",
            link : "https://taskmanagelink.com"
        }
    })

    const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);

    const emailHtml = mailGenerator.generate(options.mailgenContent);

    // setup of SMTP
    const transporter = nodemailer.createTransport({
        host : process.env.MAIL_TRAP_SMTP_HOST,
        port : Number(process.env.MAIL_TRAP_SMTP_PORT) ,
        auth : {
            user : process.env.MAIL_TRAP_SMTP_USER ,
            pass : process.env.MAIL_TRAP_SMTP_PASS 
        }
    });

    // Mail object (Actual email)    
    const mail = {
        from : "mail.taskmanager@example.com",
        to : options.email,
        subject : options.subject,
        text : emailTextual,
        html : emailHtml

    }

    //Sending the email (async + try/catch)
    try {
        const info = await transporter.sendMail(mail);
        console.log("✅ Email sent to:", options.email);
        console.log("📨 messageId:", info.messageId);
    } catch (error) {
        console.log(`Email service failed silently , Make sure that u have provide your
              Mailtrap credentials int he .env file `);
        
        console.log("Error" , error);
              

    }

};


// Email Content Generators
const emailVerificationMailgenContent = (username , verificationUrl) => {
    return {
        body : {
            name : username,
            intro : "Welcome to our we are excited to have u on board!",
            action : {
                instruction : "To verify ur email pls click on below button",
                button : {
                    color : "#22BC66",
                    text: 'verify ur email',
                    link: verificationUrl,
                },
            },
            outro : `Need help  or have questions? Just reply to this email-we"d love to help.`,
        },
    };
};

const forgotPasswordMailgenContent = (username , passwordResetUrl) => {
    return {
        body : {
            name : username,
            intro : "We got a request to resest the password of ur account",
            action : {
                instruction : "To verify ur email pls click on below button",
                button : {
                    color : "#22BC66",
                    text: 'reset password',
                    link: passwordResetUrl,
                },
            },
            outro : `Need help  or have questions? Just reply to this email-we"d love to help.`,
        },
    };
};

export {
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent, 
    sendEmail,
};