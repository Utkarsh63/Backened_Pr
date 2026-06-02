import {User} from "../models/user.models.js";
import {ApiResponse} from "../utils/api-response.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {sendEmail, emailVerificationMailgenContent, forgotPasswordMailgenContent} from "../utils/mail.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const generateAccessandRefreshToken = async (userId) => {
    try{
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave : false});
    return{accessToken , refreshToken};
    }
    catch(error){
        console.log("FULL TOKEN ERROR:", error); // ← add this
        throw new ApiError(500,"something went wrong while generating acces Token");

    }    
};

const registerUser = asyncHandler(async(req,res) => {
    const {email ,username, password} = req.body;

    const existedUser = await User.findOne({
        $or : [{username} , {email}]
    })

    if(existedUser){
        throw new ApiError(409 , "user with email or username already exists" , [])
    }

    const user = await User.create({
        email,
        password,
        username,
        isEmailVerified : false
    })

    const{unHashedToken , hashedToken , tokenExpiry} = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken
    user.emailVerificationExpiry = tokenExpiry

    await user.save({validateBeforeSave : false});

    await sendEmail({
        email : user?.email,
        subject : "please verify ur email",
        mailgenContent : emailVerificationMailgenContent(
            user.username,
            `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`
        ),
    }); 

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry" ,
    );

    if(!createdUser){
        throw new ApiError(500 , "Something went wrong while registering a user")
    }

    return res 
        .status(201)
        .json(
            new ApiResponse(
                200,
                {user : createdUser},
                "User registered successfully and verification email has been sent on ur email"
            )
        )

});

const login = asyncHandler(async(req,res) => {
    const {email , password, username} = req.body;
     console.log("LOGIN ATTEMPT WITH:", email); // ← add this

    if(!email){
        throw new ApiError(400 , "email is required");
        
    }

    const user = await User.findOne({email});

    if(!user){
        throw new ApiError(400 , "user does not exist");
    }

    // if(!user.isEmailVerified){
    //     throw new ApiError(403, "Please verify your email before logging in");
    // }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(400 , "Invalid Credentials");
    } 

    const {accessToken , refreshToken} = await generateAccessandRefreshToken (user._id);

     const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry" ,
    );

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
        .status(200)
        .cookie("accessToken" , accessToken, options)
        .cookie("refreshToken" , refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User loggedIn Successfully"
            )
        )
});

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken: "",
            },
        },
        {
            new : true,
        },
    );
    const options = {
        httpOnly : true,
        secure : true,
    };
    return res
        .status (200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json(new ApiResponse(200, {}, "User logged out"));

});

const verifyEmail = asyncHandler(async(req,res) => {
   const {verificationToken} = req.params;

   if(!verificationToken){
    throw new ApiError(400, "Email verification token is missing");
   }

   let hashedToken = crypto
   .createHash("sha256")
   .update(verificationToken)
   .digest("hex")

   const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry : {$gt:Date.now()}
   })

   if(!user){
        throw new ApiError(400, "Token is invalid or expired");
   }

   user.emailVerificationToken = undefined
   user.emailVerificationExpiry = undefined

   user.isEmailVerified = true;
   await user.save({validateBeforeSave : false});

   return res.status(200).json(new ApiResponse(200,{isEmailVerified : true}, "Email is verified",))

})

const resendEmailVerification = asyncHandler(async(req,res) => {
    const user = await User.findById(req.user?._id);

    if(!user){
        throw new ApiError(404, " User does not exist ")
    }

    if(user.isEmailVerified){
         throw new ApiError(409, " Email already verified ")
    }
    
    const{unHashedToken , hashedToken , tokenExpiry} = user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken
    user.emailVerificationExpiry = tokenExpiry

    await user.save({validateBeforeSave : false});

    await sendEmail({
        email : user?.email,
        subject : "please verify ur email",
        mailgenContent : emailVerificationMailgenContent(
            user.username,
            `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email/${unHashedToken}`
        ),
    }); 

    return res.status(200).json(
        new ApiResponse (
            200 , 
            {},
            "Mail has been sent to your emailId successfully"
        )
    );
})

const CurrentUser = asyncHandler(async(req,res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched Successfully"
            )
        )
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized access")
    }

    try {
        const decodeToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodeToken?._id)
        
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token");
        }
        
        if(incomingRefreshToken !== user?.refreshToken ){
            throw new ApiError(401, "Refresh Token is expired");
        }

        const options = {
            httpOnly : true,
            secure : true
        }

        const {accessToken, refreshToken : newRefreshToken} = await generateAccessandRefreshToken(user._id)
        
        user.refreshToken = newRefreshToken;
        await user.save();

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken: newRefreshToken},
                    "Access Token refreshed"
                )
            )
            

    } catch (error) {
        throw new ApiError(401, "Invalid Refresh Token ");
    }

})

const forgotPassword = asyncHandler(async(req,res) => {
    const {email} = req.body

    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404, "user does not exist")
    }

    const{unHashedToken, hashedToken, tokenExpiry} = user.generateTemporaryToken();

    user.forgotPasswordToken = hashedToken
    user.forgotPasswordExpiry = tokenExpiry

    await user.save({validateBeforeSave : false})

    await sendEmail({
        email : user?.email,
        subject : "Password reset request",
        mailgenContent : forgotPasswordMailgenContent(
            user.username,
            `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
        ),
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password reset mail has beet sent to your email"
            )
        )
})

const resetForgotPassword = asyncHandler(async(req,res) => {
    const {resetToken} = req.params
    const{newPassword} = req.body

    let hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex")

    const user = await User.findOne({
        forgotPasswordToken : hashedToken,
        forgotPasswordExpiry : {$gt : Date.now()}
    })    

    if(!user){
        throw new ApiError(400, "Token is invalid or expired")
    }

    user.forgotPasswordExpiry = undefined
    user.forgotPasswordToken = undefined

    user.password = newPassword

    await user.save({validateBeforeSave : false})

    return res
        .status(200)
        .json(
            new ApiResponse(200, {} , "Password reset Successfully")
        );
});

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id);

    const isPasswordcorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordcorrect){
        throw new ApiError(404, "Invalid Old Password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave : false});

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Password change successfully")
        );
});

export {
    registerUser,
    login,
    logoutUser,
    CurrentUser,
    verifyEmail,
    resendEmailVerification,
    refreshAccessToken,
    forgotPassword,
    resetForgotPassword,
    changeCurrentPassword
};
