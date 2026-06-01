import {User} from "../models/user.models.js";
import {ApiResponse} from "../utils/api-response.js";
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";
import {sendEmail, emailVerificationMailgenContent} from "../utils/mail.js";
import jwt from "jsonwebtoken";

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
    const {email ,username, password, role} = req.body;

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
        role,
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
        throw new ApiError(500 , "Something ent wrong while registering a user")
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

   const user = await user.findOne({
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
    const user = await user.findById(req.user?._id);

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

    if(!refreshAccessToken){
        throw new ApiResponse(401, "Unauthorized access")
    }

    try {
        const decodeToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodeToken?._id)
        
        if(!user){
            throw new ApiResponse(401, "Invalid Refresh Token");
        }
        
        if(incomingRefreshToken !== user?.refreshToken ){
            throw new ApiResponse(401, "Refresh Token is expired");
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
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken: newRefreshToken},
                    "Access Token refreshed"
                )
            )
            

    } catch (error) {
        throw new ApiResponse(401, "Invalid Refresh Token ");
    }

})


export {registerUser , login, logoutUser, CurrentUser, verifyEmail, resendEmailVerification, refreshAccessToken};
