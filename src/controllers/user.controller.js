import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async (userId) => {
    console.log("ID : ", userId)
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });  //validateBeforeSave: false -> don't apply any validation on the database, only save the refresh token.

        return { accessToken, refreshToken }

    } catch (error) {
        throw new apiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for image, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in database
    // check for user creation
    // remove password and refresh-token field from response
    // return response

    const { username, email, fullName, password } = req.body;
    if ([username, email, fullName, password].some((field) => field?.trim() === ""))
        throw new apiError(400, "All fields are required");

    const userExist = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (userExist) throw new apiError(409, "User already exist");

    const avatarLocalPath = req.files?.avatar[0]?.path;
    if (!avatarLocalPath) throw new apiError(400, "Avatar is required");  //avatar is mandatory

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("CoverImage : ", coverImage)
    if (!avatar) throw new apiError(400, "Avatar is required");

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    console.log("Test : ", user);
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) throw new apiError(500, "Something went wrong while registering the user")

    return res.status(201).json(
        new apiResponse(200, createdUser, "User register successfully")
    )
});

const loginUser = asyncHandler(async (req, res) => {
    // req.body -> bring data
    // check 'username' or 'email' is given or not
    // if present, find the user
    // check the password is correct or not
    // generate access and refresh token (new-concept)
    // save refresh-token into database
    // send secure cookie (new-concept)

    const { username, email, password } = req.body;
    if (!username && !email) throw new apiError(400, "username or email is required");

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) throw new apiError(404, "User does not exist");

    const isPasswordValid = await user.isPasswordCorrect(password);     //we will take isPasswordCorrect() function from 'user - line 72' not 'User - not from database'
    if (!isPasswordValid) throw new apiError(401, "Invalid User");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    //options for cookie
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged In Successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    // clear all the cookies
    // reset refresh-token

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined }
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new apiResponse(200, {}, "User logged out"))
});

//refreshAcessToken - help user to login without providing login-password multiple times
const refreshAcessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) throw new apiError(401, "unauthorized request");

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id);
        if (!user) throw new apiError(401, "Invalid refresh token");

        if (incomingRefreshToken !== user?.refreshToken)
            throw new apiError(401, "Refresh token is expired or used")

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }


})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAcessToken
};