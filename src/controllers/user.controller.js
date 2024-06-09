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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new apiError(400, "Invalid old Password");

    user.password = newPassword;
    user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new apiResponse(
            200,
            {},
            "Password Changed Successfully"
        )
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "Current User fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) throw new apiError(400, "fields are required");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("password")

    return res.status(200).json(
        new apiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) throw new apiError(400, "Avatar file is missing");

    //TODO: delete old image - assignment, after updating the avatar delete the old avatar image by creating an utility funciton.

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) throw new apiError(400, "Error while uploading avatar");

    const user = await User.findByIdAndDelete(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(
            new apiResponse(200, user, " Avatar Updated")
        )
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) throw new apiError(400, "Cover Image file is missing");

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) throw new apiError(400, "Error while uploading cover image");

    const user = await User.findByIdAndDelete(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(
            new apiResponse(200, user, "Cover Image Updated")
        )
})

const gertUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new apiError(400, "username is missing")
    }

    //agregation-pipeline
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "subscribers"
                },
                channelSubscribedToCount: {
                    $size: "subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1, 
                avatar: 1, 
                coverImage: 1, 
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new apiError(404, "Channel does not exists");
    }

    return res
        .status(200)
        .json(
            new apiResponse(200, channel[0], "User channel fetched successfully")
        ) 
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "User",
                            localField: "owner",
                            foreignField: "_id",
                            as : "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }    
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new apiResponse(200, user[0].watchHistory, "Watch History fetched successfully")
        )
}) 

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAcessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    gertUserChannelProfile,
    getWatchHistory
};