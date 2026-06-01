import {body} from "express-validator";

const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is reqired")
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lower case")
            .isLength({ min: 3 })
            .withMessage("Username must be at least 3 characters long"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required"),
         body("fullName")
            .optional()
            .trim(),

    ];
};

const userloginValidator = () => {
    return[
        body("email")
            .notEmpty()
            .isEmail()
            .withMessage("Email is invalid"),
            body("password")
                .notEmpty()
                .withMessage("Password is required")

    ];
};

export {userRegisterValidator , userloginValidator};